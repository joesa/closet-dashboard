/**
 * The visual half of the swap test.
 *
 * FULL_REDESIGN_DESIGN_SYSTEM and the build prompt both carry a long list of
 * banned AI defaults — SaaS gradients, glassmorphism, floating orbs, dot-grid,
 * three identical icon cards, Inter/Poppins/Roboto, emoji in UI. Until now that
 * list existed only as prose sent to the model: nothing measured whether the
 * emitted artifact actually honoured it, so a run that ignored the instruction
 * looked exactly like a run that followed it. specificityGate.ts closed the same
 * hole for copy; this closes it for the design.
 *
 * What this can and cannot do: it detects the *mechanical* signatures of the
 * banned defaults — a hue range, a co-occurring set of CSS declarations, a
 * repeated DOM shape. It cannot tell a beautiful page from an ugly one, and a
 * page can pass every check here and still be dull. But nothing that fails these
 * checks is bespoke, and every check corresponds to a line the prompt already
 * claims is non-negotiable.
 *
 * Every check is brief-exempt: a default the admin explicitly asked for is a
 * decision, not a tell. Pass the admin seed plus the optimized brief as
 * `briefText` and the relevant checks stand down.
 *
 * Pure and offline — no model call, no network — so it can run on every
 * checkpoint of a Full redesign without changing the job's cost profile.
 */

import * as cheerio from 'cheerio'
import {
  tellSeverity,
  type DesignTellCode,
} from '@/lib/validation/designGuardPolicy'
import {
  analyzeSpecificity,
  analyzeToneBalance,
  stripToText,
  type SpecificityCode,
} from '@/lib/validation/specificityGate'
import type { UnitQualityReport } from '@/lib/ai/generateWithQualityRetry'

export type { DesignTellCode }

/**
 * Everything a full artifact scan can report: the visual/structural tells owned
 * by this module, plus the copy codes owned by specificityGate. Keeping them in
 * one union is what lets the orchestrator, the repair loop and the publish gate
 * all speak about "findings" without caring which half produced them.
 */
export type ArtifactTellCode = DesignTellCode | SpecificityCode

export type DesignTellFinding = {
  code: ArtifactTellCode
  /** GLOBAL_CSS_UNIT_ID or a page path — decides which unit gets repaired. */
  unitId: string
  severity: 'error' | 'warning'
  message: string
  /** One imperative sentence, handed verbatim to the repair model. */
  fix: string
  samples: string[]
  meta?: Record<string, unknown>
}

export type CustomPageLike = {
  html?: string
  css?: string
  title?: string
  description?: string
}

export type DesignTellScanInput = {
  globalCss: string
  pages: Record<string, CustomPageLike>
  /** Admin seed + optimized brief. A default the brief asks for is not a tell. */
  briefText?: string | null
  businessName?: string | null
  locality?: string | null
  /** Owner-supplied copy, exempt from the copy ban list. */
  sourceText?: string | null
}

/** Unit id for the shared stylesheet, which belongs to no single page. */
export const GLOBAL_CSS_UNIT_ID = 'globalCss'

/** Codes owned by globalCss — never attributed to a page. */
const GLOBAL_CSS_CODES: readonly DesignTellCode[] = [
  'design_saas_gradient_hue',
  'design_gradient_instead_of_palette',
  'design_dark_neon_skin',
  'design_cream_terracotta_skin',
  'design_glassmorphism',
  'design_floating_orbs',
  'design_dot_grid_texture',
  'design_banned_font_family',
  'design_no_design_tokens',
]

/** Codes that need the whole site to judge — skipped on single-unit scans. */
const WHOLE_SITE_CODES: readonly ArtifactTellCode[] = [
  'design_missing_font_link',
  'design_thin_home',
  'copy_uniform_positivity',
]

// ── colour ──────────────────────────────────────────────────────────────────

/**
 * HSL plus absolute chroma (max-min).
 *
 * Chroma matters because HSL saturation is misleading at the ends of the
 * lightness range: cream (#f7f4ef) reports s≈0.33 despite being all but
 * colourless, so a "low saturation" test would never recognise it. Chroma says
 * what the eye says — 0.03 of colour in it.
 */
export function hexToHsl(
  hex: string
): { h: number; s: number; l: number; c: number } | null {
  const raw = hex.trim().replace(/^#/, '')
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw.length === 8
        ? raw.slice(0, 6)
        : raw
  if (!/^[0-9a-f]{6}$/i.test(full)) return null
  const r = parseInt(full.slice(0, 2), 16) / 255
  const g = parseInt(full.slice(2, 4), 16) / 255
  const b = parseInt(full.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return { h: 0, s: 0, l, c: 0 }
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return { h: h * 360, s, l, c: d }
}

const ROOT_TOKEN_RE = /--([a-zA-Z][\w-]*)\s*:\s*(#[0-9a-fA-F]{3,8})\b/g

/** `--name: #hex` pairs, in source order. */
export function extractRootColorTokens(
  css: string
): Array<{ name: string; hex: string }> {
  const out: Array<{ name: string; hex: string }> = []
  for (const match of (css || '').matchAll(ROOT_TOKEN_RE)) {
    out.push({ name: match[1].toLowerCase(), hex: match[2].toLowerCase() })
  }
  return out
}

const BACKGROUND_ROLE_RE = /^(?:bg|background|surface|paper|ground|canvas|base)\b/
const ACCENT_ROLE_RE = /^(?:acc|accent|brand|primary|cta|highlight)/

function findRoleToken(
  tokens: Array<{ name: string; hex: string }>,
  role: RegExp
): { name: string; hex: string } | undefined {
  return tokens.find((t) => role.test(t.name))
}

// ── typography ──────────────────────────────────────────────────────────────

const BANNED_FONT_RE =
  /\b(?:Inter|Poppins|Roboto(?!\s+Slab)|Space\s+Grotesk|Syne|Big\s+Shoulders(?:\s+Display)?)\b/i

/**
 * Serif detection for the cream/terracotta skin check. The generic `serif`
 * keyword is not enough: a Google Fonts link says "Libre+Baskerville", never
 * "serif", so a family-name list is what actually catches the cliché.
 */
const SERIF_FAMILY_RE =
  /\b(?:serif|Baskerville|Playfair|Fraunces|Lora|Merriweather|Georgia|Cormorant|Spectral|Bitter|Crimson|Garamond|DM\s+Serif|Source\s+Serif|Noto\s+Serif|PT\s+Serif|Domine|Vollkorn|Zilla\s+Slab|Libre\s+Caslon|Cardo|Newsreader)\b/i

const FONT_DECL_RE =
  /(?:--(?:df|bf|font-display|font-body)\s*:|(?:^|[\s,{>])(?:body|h1)\s*\{[^}]*?font-family\s*:)\s*([^;}\n]+)/gi

/** Font families named by the design tokens, the base rules, and the Fonts link. */
export function extractFontFamilies(
  css: string,
  html: string
): { display: string; body: string; all: string[] } {
  const all: string[] = []
  for (const match of (css || '').matchAll(FONT_DECL_RE)) {
    const first = match[1]
      .split(',')[0]
      .replace(/['"]/g, '')
      .trim()
    if (first && !first.startsWith('var(')) all.push(first)
  }
  for (const match of (html || '').matchAll(
    /fonts\.googleapis\.com\/css2\?([^"'\s>]+)/gi
  )) {
    for (const fam of match[1].matchAll(/family=([^&:]+)/gi)) {
      all.push(decodeURIComponent(fam[1].replace(/\+/g, ' ')).trim())
    }
  }
  const unique = Array.from(new Set(all.filter(Boolean)))
  return { display: unique[0] || '', body: unique[1] || unique[0] || '', all: unique }
}

// ── CSS rule-block helpers ──────────────────────────────────────────────────

/** Split a stylesheet into rule bodies so co-occurring declarations can be tested. */
function ruleBlocks(css: string): string[] {
  const blocks: string[] = []
  for (const match of (css || '').matchAll(/\{([^{}]*)\}/g)) {
    const body = match[1].trim()
    if (body) blocks.push(body)
  }
  return blocks
}

function briefMentions(briefText: string | null | undefined, re: RegExp): boolean {
  return !!briefText && re.test(briefText)
}

/**
 * True when copy names nothing this business owns — no measurement, no material,
 * no place. Delegates to specificityGate so the visual and copy gates cannot
 * disagree about what counts as a real detail.
 *
 * The padding exists because analyzeSpecificity deliberately ignores anything
 * under 40 words (a bare contact stub has nothing to judge), while the strings
 * we hand it here are a headline or a card sentence. Repeating the text reaches
 * that floor without changing the answer: repetition cannot introduce a
 * measurement or a proper noun that was not already there.
 */
function looksGenericCopy(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  const words = trimmed.split(/\s+/).length
  const padded = `${trimmed} `.repeat(Math.max(1, Math.ceil(60 / Math.max(1, words))))
  return analyzeSpecificity({ text: padded }).some(
    (f) => f.code === 'copy_no_proprietary_detail'
  )
}

// ── the checks ──────────────────────────────────────────────────────────────

function finding(
  code: DesignTellCode,
  unitId: string,
  message: string,
  fix: string,
  samples: string[] = [],
  meta?: Record<string, unknown>
): DesignTellFinding {
  return { code, unitId, severity: tellSeverity(code), message, fix, samples, meta }
}

function scanGlobalCss(
  css: string,
  briefText: string | null | undefined,
  /** All page HTML, so font-family evidence in the Google Fonts link counts. */
  typeSource = ''
): DesignTellFinding[] {
  const out: DesignTellFinding[] = []
  if (!css?.trim()) return out
  const blocks = ruleBlocks(css)
  const tokens = extractRootColorTokens(css)

  // A design system at all. Three is the floor a system can be built on —
  // surface, ink, accent — not an aspiration.
  const customProps = css.match(/--[a-zA-Z][\w-]*\s*:/g) || []
  if (customProps.length < 3) {
    out.push(
      finding(
        'design_no_design_tokens',
        GLOBAL_CSS_UNIT_ID,
        'globalCss defines almost no design tokens, so there are no CSS variables to be consistent with — surfaces, text and accent are written inline per rule.',
        'Emit a :root token set (background, ink, muted, line, accent at minimum) and reference it with var() throughout.',
        customProps.slice(0, 4)
      )
    )
  }

  // Gradients.
  const gradientDecls = css.match(/(?:linear|radial|conic)-gradient\s*\(/gi) || []
  if (!briefMentions(briefText, /gradient/i)) {
    const saasStops: string[] = []
    for (const match of css.matchAll(
      /(?:linear|radial|conic)-gradient\s*\(([^)]*(?:\([^)]*\))?[^)]*)\)/gi
    )) {
      for (const hex of match[1].matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
        const hsl = hexToHsl(hex[0])
        if (hsl && hsl.h >= 220 && hsl.h <= 300 && hsl.s > 0.35) saasStops.push(hex[0])
      }
    }
    if (saasStops.length > 0) {
      out.push(
        finding(
          'design_saas_gradient_hue',
          GLOBAL_CSS_UNIT_ID,
          'A gradient runs through the indigo/violet band that every AI-generated SaaS page uses. The brief did not ask for it.',
          'Delete the violet/indigo gradient and use a flat surface from the locked palette instead.',
          Array.from(new Set(saasStops)).slice(0, 6)
        )
      )
    }
    if (gradientDecls.length >= 3 && tokens.length < 4) {
      out.push(
        finding(
          'design_gradient_instead_of_palette',
          GLOBAL_CSS_UNIT_ID,
          `${gradientDecls.length} gradients carry the design but fewer than four colour tokens are defined — gradients are standing in for a palette decision that was never made.`,
          'Decide a real palette as :root hex tokens, then keep at most one gradient as a deliberate accent.',
          [],
          { gradientCount: gradientDecls.length, tokenCount: tokens.length }
        )
      )
    }
  }

  // Glassmorphism: blur + translucency in the same rule.
  if (!briefMentions(briefText, /glass|frosted/i)) {
    const glass = blocks.filter(
      (b) =>
        /(?:-webkit-)?backdrop-filter\s*:[^;]*blur\s*\(/i.test(b) &&
        /background[^;]*(?:rgba?\s*\([^)]*?,\s*0?\.\d+\s*\)|#[0-9a-fA-F]{6}(?:[0-9a-e][0-9a-f]|[0-9a-f][0-9a-e]))/i.test(
          b
        )
    )
    if (glass.length > 0) {
      out.push(
        finding(
          'design_glassmorphism',
          GLOBAL_CSS_UNIT_ID,
          'Glassmorphism cards (backdrop blur over a translucent fill) are on the banned-defaults list and the brief did not ask for them.',
          'Remove backdrop-filter and the translucent fills; give the cards a solid surface token and a hairline border.',
          glass.slice(0, 2).map((b) => b.slice(0, 120))
        )
      )
    }
  }

  // Floating blurred orbs: round + blurred/radial + taken out of flow.
  if (!briefMentions(briefText, /orb|blob/i)) {
    const orbs = blocks.filter(
      (b) =>
        /border-radius\s*:\s*(?:50%|9999px|999px)/i.test(b) &&
        /(?:filter\s*:[^;]*blur\s*\(|background(?:-image)?\s*:[^;]*radial-gradient)/i.test(b) &&
        /position\s*:\s*(?:absolute|fixed)/i.test(b)
    )
    if (orbs.length > 0) {
      out.push(
        finding(
          'design_floating_orbs',
          GLOBAL_CSS_UNIT_ID,
          'Floating blurred orbs are decoration with no subject behind them — the single most recognisable AI-generated background.',
          'Delete the orb elements and their CSS. If the section needs atmosphere, derive it from the trade (paper grain, a photo bleed, a hairline grid).',
          orbs.slice(0, 2).map((b) => b.slice(0, 120))
        )
      )
    }
  }

  // Dot-grid used as default texture.
  if (!briefMentions(briefText, /dot[- ]?grid|dotted|halftone/i)) {
    const dots = blocks.filter(
      (b) =>
        /background(?:-image)?\s*:[^;]*radial-gradient\s*\(\s*circle[^;]*?\d+(?:px|rem)[^;]*transparent/i.test(
          b
        ) && /background-size\s*:/i.test(b)
    )
    if (dots.length > 0) {
      out.push(
        finding(
          'design_dot_grid_texture',
          GLOBAL_CSS_UNIT_ID,
          'A dot-grid is being used as default background texture. It reads as a template placeholder, not as a choice about this business.',
          'Remove the dot-grid background. Leave the surface plain or use a texture that comes from the trade itself.',
          dots.slice(0, 2).map((b) => b.slice(0, 120))
        )
      )
    }
  }

  // Skins: dark + neon, and cream + terracotta.
  const bg = findRoleToken(tokens, BACKGROUND_ROLE_RE)
  const acc = findRoleToken(tokens, ACCENT_ROLE_RE)
  const bgHsl = bg ? hexToHsl(bg.hex) : null
  const accHsl = acc ? hexToHsl(acc.hex) : null
  if (
    bgHsl &&
    accHsl &&
    bgHsl.l < 0.18 &&
    accHsl.s > 0.75 &&
    accHsl.l >= 0.45 &&
    accHsl.l <= 0.75 &&
    ((accHsl.h >= 60 && accHsl.h <= 110) || // lime
      (accHsl.h >= 165 && accHsl.h <= 200) || // cyan
      (accHsl.h >= 40 && accHsl.h < 60)) && // acid gold
    !briefMentions(briefText, /dark\s*mode|neon|charcoal|lime|cyan|blackout|midnight/i)
  ) {
    out.push(
      finding(
        'design_dark_neon_skin',
        GLOBAL_CSS_UNIT_ID,
        'Near-black surface with a single neon accent is the "auto shop AI" default skin. The brief did not ask for a dark design.',
        'Move to a light or mid surface derived from the trade, and drop the accent saturation to something a sign painter would mix.',
        [bg!.hex, acc!.hex]
      )
    )
  }
  if (
    bgHsl &&
    accHsl &&
    bgHsl.l > 0.9 &&
    bgHsl.h >= 20 &&
    bgHsl.h <= 60 &&
    bgHsl.c < 0.1 &&
    accHsl.h >= 10 &&
    accHsl.h <= 35 &&
    accHsl.s > 0.5 &&
    SERIF_FAMILY_RE.test(`${css}\n${typeSource}`) &&
    !briefMentions(briefText, /cream|terracotta|warm clay|paper|serif/i)
  ) {
    out.push(
      finding(
        'design_cream_terracotta_skin',
        GLOBAL_CSS_UNIT_ID,
        'Cream paper, a high-contrast serif and a terracotta accent is the habit skin every AI tool reaches for when told "artisanal". The brief did not ask for it.',
        'Replace the cream/terracotta pair with a palette taken from this trade’s real materials, and pick a display face that is not a Didone-style serif.',
        [bg!.hex, acc!.hex]
      )
    )
  }

  // Banned font families.
  const fonts = extractFontFamilies(css, '')
  const bannedFonts = fonts.all.filter((f) => BANNED_FONT_RE.test(f))
  const systemUiFirst = /font-family\s*:\s*system-ui/i.test(css)
  if (
    (bannedFonts.length > 0 || systemUiFirst) &&
    !briefMentions(briefText, BANNED_FONT_RE)
  ) {
    out.push(
      finding(
        'design_banned_font_family',
        GLOBAL_CSS_UNIT_ID,
        'The type is set in a family the design system bans by habit (Inter / Poppins / Roboto / Space Grotesk / Syne / Big Shoulders / system-ui as the primary face).',
        'Choose a display and body pairing that suits this trade specifically, and load them from Google Fonts. Keep system-ui only as the last fallback.',
        systemUiFirst ? [...bannedFonts, 'system-ui'] : bannedFonts
      )
    )
  }

  return out
}

const EMOJI_RE = /\p{Extended_Pictographic}/u
const EMOJI_GLOBAL_RE = /\p{Extended_Pictographic}/gu

function scanPageHtml(
  path: string,
  html: string,
  briefText: string | null | undefined
): DesignTellFinding[] {
  const out: DesignTellFinding[] = []
  if (!html?.trim()) return out

  // Emoji in UI copy or in CSS content:.
  const visible = stripToText(html)
  const emoji = [
    ...(visible.match(EMOJI_GLOBAL_RE) || []),
    ...(html.match(/content\s*:\s*["'][^"']*["']/gi) || [])
      .filter((decl) => EMOJI_RE.test(decl))
      .flatMap((decl) => decl.match(EMOJI_GLOBAL_RE) || []),
  ]
  if (emoji.length > 0) {
    out.push(
      finding(
        'design_emoji_in_ui',
        path,
        'Emoji appear in the interface copy. Real trade businesses do not label their services with pictographs; it is a chat-assistant habit.',
        'Remove every emoji. If an icon is genuinely needed, use a drawn mark that comes from the trade.',
        Array.from(new Set(emoji)).slice(0, 6)
      )
    )
  }

  // Em-dash stacking.
  const $ = cheerio.load(html, null, false)
  let stackedNode = ''
  let totalDashes = 0
  $('*')
    .contents()
    .each((_i, node) => {
      if (node.type !== 'text') return
      const text = (node.data || '').trim()
      const count = (text.match(/—/g) || []).length
      totalDashes += count
      if (count >= 2 && !stackedNode) stackedNode = text.slice(0, 120)
    })
  if (stackedNode || totalDashes >= 3) {
    out.push(
      finding(
        'design_em_dash_stack',
        path,
        'Copy leans on stacked em dashes. Two in a sentence, or a page full of them, is the punctuation signature of generated marketing prose.',
        'Rewrite those sentences with full stops or commas. Keep at most one em dash on the page.',
        stackedNode ? [stackedNode] : [],
        { total: totalDashes }
      )
    )
  }

  // Document-metadata CTA labels (moved verbatim from siteArtifactValidator).
  const specCtas = html.match(/>\s*(?:view|read|open)\s+(?:protocol|dossier|case file)\s*</gi)
  if (specCtas) {
    out.push(
      finding(
        'spec_sheet_cta',
        path,
        `${path}: Replace document-style CTA labels with a natural customer action.`,
        'Rename those links to the action a customer would take, e.g. "View services" or "See the work".',
        specCtas.map((sample) => sample.slice(1, -1).trim()),
        { path }
      )
    )
  }

  // Standalone zero-padded counters are visual decoration, not useful content.
  // Contextual numbers such as measurements, prices, dates and quantities do not
  // match this deliberately narrow rule.
  const numberedMarkers = html.match(
    /<(span|div|p|small|strong|b)\b[^>]*>\s*(?:step\s*)?0[1-9]\s*<\/\1>/gi
  )
  if (numberedMarkers) {
    out.push(
      finding(
        'decorative_numbered_list',
        path,
        `${path}: Remove standalone zero-padded counters; they make the page read like a spec sheet.`,
        'Delete the numeric marker and preserve hierarchy with semantic order, spacing, connectors, or descriptive titles. Keep real measurements, prices, dates, quantities, and reference numbers only when supplied facts require them.',
        numberedMarkers.map((sample) => sample.replace(/<[^>]+>/g, '').trim()),
        { path, count: numberedMarkers.length }
      )
    )
  }

  // Three identical icon-title-sentence cards.
  const triplet = findIconCardTriplet($)
  if (triplet && !briefMentions(briefText, /three\s+cards|icon\s+cards/i)) {
    out.push(
      finding(
        'design_triplet_icon_cards',
        path,
        'A row of three identical icon-title-sentence cards whose copy carries no measurement, material or named place. This block could describe any business in any trade.',
        'Replace the card row with content specific to this business — real numbers, named materials, or the trade’s own document — or cut it.',
        triplet.samples
      )
    )
  }

  return out
}

/** Cheerio: a parent with >= 3 same-shaped children that say nothing concrete. */
function findIconCardTriplet(
  $: cheerio.CheerioAPI
): { samples: string[] } | null {
  let result: { samples: string[] } | null = null
  $('*').each((_i, el) => {
    if (result) return
    const children = $(el).children()
    if (children.length < 3) return
    const shaped: string[] = []
    children.each((_j, child) => {
      const $c = $(child)
      const hasIcon =
        $c.find('svg, i[class]').length > 0 ||
        EMOJI_RE.test($c.children().first().text() || '')
      const headings = $c.find('h1,h2,h3,h4,h5,h6').length
      const paras = $c.find('p')
      if (hasIcon && headings === 1 && paras.length === 1) {
        shaped.push(paras.first().text().trim())
      }
    })
    if (
      shaped.length >= 3 &&
      shaped.every((text) => text.length > 12 && looksGenericCopy(text))
    ) {
      result = { samples: shaped.slice(0, 3) }
    }
  })
  return result
}

/**
 * Hero archetype: exactly two CTAs, a decorative blob, and a headline that names
 * nothing. Any one of those alone is fine; together they are the stock hero.
 */
function scanHero(
  path: string,
  html: string,
  css: string,
  briefText: string | null | undefined
): DesignTellFinding[] {
  if (path !== '/' && path !== '') return []
  const $ = cheerio.load(html, null, false)
  const hero = $('section, header').first()
  if (hero.length === 0) return []
  const ctas = hero.find('a[href]').filter((_i, el) => {
    const cls = ($(el).attr('class') || '').toLowerCase()
    return /btn|button|cta/.test(cls)
  })
  if (ctas.length !== 2) return []
  // A decorative shape declared inline on the hero, or an orb-shaped rule in the
  // stylesheet the hero can be drawing on. Either is enough alongside the other
  // two signals; neither is a tell on its own.
  const heroHtml = hero.html() || ''
  const hasBlob =
    /border-radius\s*:\s*(?:50%|9999px)/i.test(heroHtml) ||
    /blur\s*\(/i.test(heroHtml) ||
    /(?:linear|radial)-gradient/i.test(heroHtml) ||
    ruleBlocks(css).some(
      (b) =>
        /border-radius\s*:\s*(?:50%|9999px)/i.test(b) &&
        /(?:blur\s*\(|radial-gradient)/i.test(b)
    )
  if (!hasBlob) return []
  const h1 = hero.find('h1').first().text().trim()
  if (!h1) return []
  if (!looksGenericCopy(h1) || briefMentions(briefText, /two\s+(?:buttons|ctas)/i)) return []
  return [
    finding(
      'design_hero_two_button_blob',
      path,
      'The hero is the stock template: a headline that names nothing, two buttons, and a decorative gradient/blur shape. Ten AI tools produce this hero.',
      'Make the headline state one concrete promise for this business, keep a single primary CTA, and replace the decorative shape with the trade’s own artifact or a real photo.',
      [h1.slice(0, 120)]
    ),
  ]
}

/** Two lanes offered side by side when the business has one discipline. */
const EXPLICIT_DUAL_LANE_RE = [
  /\b(dual[- ]?(lane|offer|audience)|two (disciplines|lanes|sides|businesses)|under one roof\b.{0,40}\b(and|plus)\b)/i,
  /\b(wrap|ppf|tint|aesthetic).{0,50}(mech|mechanical|brake|repair|maintenance)\b/i,
  /\b(mech|mechanical|brake|repair|maintenance).{0,50}(wrap|ppf|tint|aesthetic)\b/i,
]

function scanDualLane(
  path: string,
  html: string,
  briefText: string | null | undefined
): DesignTellFinding[] {
  if (path !== '/' && path !== '') return []
  if (EXPLICIT_DUAL_LANE_RE.some((re) => re.test(briefText || ''))) return []
  const $ = cheerio.load(html, null, false)
  const sections = $('section').slice(0, 2)
  let hit: string[] | null = null
  sections.each((_i, section) => {
    if (hit) return
    const lanes = $(section)
      .children()
      .filter((_j, child) => $(child).find('a[href]').length >= 1)
    if (lanes.length !== 2) return
    const headings = lanes
      .map((_j, lane) => $(lane).find('h2,h3').first().text().trim())
      .get()
      .filter(Boolean)
    if (headings.length === 2) hit = headings
  })
  if (!hit) return []
  return [
    finding(
      'design_dual_lane_gateway',
      path,
      'The page opens with a two-lane "pick your side" gateway, but the brief does not describe two distinct disciplines. Several related services are one catalog, not two lanes.',
      'Merge the two lanes into a single services catalog with one accent and one primary CTA.',
      hit
    ),
  ]
}

// ── entry points ────────────────────────────────────────────────────────────

/** Visual + structural tells only. No copy checks. */
export function scanDesignTells(input: DesignTellScanInput): DesignTellFinding[] {
  const entries = Object.entries(input.pages || {})
  const allHtml = entries.map(([, page]) => page?.html || '').join('\n')
  const out: DesignTellFinding[] = [
    ...scanGlobalCss(input.globalCss, input.briefText, allHtml),
  ]

  for (const [path, page] of entries) {
    const html = page?.html || ''
    out.push(...scanPageHtml(path, html, input.briefText))
    out.push(...scanHero(path, html, `${input.globalCss}\n${page?.css || ''}`, input.briefText))
    out.push(...scanDualLane(path, html, input.briefText))
  }

  const hasFontsLink = entries.some(([, page]) =>
    /fonts\.googleapis\.com/i.test(page?.html || '')
  )
  if (entries.length > 0 && !hasFontsLink) {
    out.push(
      finding(
        'design_missing_font_link',
        GLOBAL_CSS_UNIT_ID,
        'No Google Fonts <link> on any page, so the display/body pairing falls back to system fonts and the type decision never reaches the browser.',
        'Add the Google Fonts stylesheet <link> as the first node of every page html.'
      )
    )
  }

  const home = input.pages?.['/']?.html || input.pages?.['']?.html || ''
  if (home) {
    const sectionCount = (home.match(/<section\b/gi) || []).length
    const landmarkCount =
      sectionCount + (home.match(/<(header|main|footer)\b/gi) || []).length
    if (sectionCount < 4 && landmarkCount < 5) {
      out.push(
        finding(
          'design_thin_home',
          '/',
          'Home is thin — too few sections to carry the hero → services → proof → conversion rhythm.',
          'Add the missing beats using facts already in the brief; do not pad with adjectives.',
          [],
          { sectionCount, landmarkCount }
        )
      )
    }
  }

  return out
}

/** Design tells plus the copy gate, unit-attributed, for a whole artifact. */
export function scanArtifactTells(input: DesignTellScanInput): DesignTellFinding[] {
  const out = scanDesignTells(input)

  const pageTexts: string[] = []
  for (const [path, page] of Object.entries(input.pages || {})) {
    const text = [page?.title, page?.description, page?.html].filter(Boolean).join(' ')
    pageTexts.push(text)
    for (const f of analyzeSpecificity({
      text,
      businessName: input.businessName,
      locality: input.locality,
      sourceText: input.sourceText,
    })) {
      out.push({
        code: f.code,
        unitId: path,
        severity: 'error',
        message: `${path}: ${f.message}`,
        fix: 'Rewrite the flagged copy with facts from the brief: named materials, real measurements, a place smaller than the city.',
        samples: f.samples,
        meta: { path, ...(f.samples.length > 0 ? { samples: f.samples } : {}) },
      })
    }
  }

  for (const f of analyzeToneBalance(pageTexts)) {
    out.push({
      code: f.code,
      unitId: '/',
      severity: 'error',
      message: f.message,
      fix: 'Add one honest limit somewhere on the site: what you do not do, a lead time, or something that went wrong and was put right.',
      samples: f.samples,
    })
  }

  return out
}

/**
 * Scan one in-flight unit mid-generation. Skips globalCss-owned and whole-site
 * checks so a page is never blamed for a palette or a missing font link it does
 * not own — the finalize pass catches those against the full artifact.
 */
export function scanUnitTells(
  unitId: string,
  unit: CustomPageLike,
  ctx: Omit<DesignTellScanInput, 'pages' | 'globalCss'> & { globalCss?: string }
): DesignTellFinding[] {
  const findings = scanArtifactTells({
    globalCss: '',
    pages: { [unitId]: unit },
    briefText: ctx.briefText,
    businessName: ctx.businessName,
    locality: ctx.locality,
    sourceText: ctx.sourceText,
  })
  return findings.filter(
    (f) =>
      !GLOBAL_CSS_CODES.includes(f.code as DesignTellCode) &&
      !WHOLE_SITE_CODES.includes(f.code)
  )
}

/** Numbered violation list for a repair prompt. */
export function describeDesignTellsForPrompt(findings: DesignTellFinding[]): string {
  return findings
    .map((f, i) => {
      const samples = f.samples.length
        ? ` Offending: ${f.samples.slice(0, 3).map((s) => JSON.stringify(s)).join(', ')}.`
        : ''
      return `${i + 1}. [${f.unitId}] ${f.message}${samples} FIX: ${f.fix}`
    })
    .join('\n')
}

/** Adapter into generateWithQualityRetry's report shape. */
export function toUnitQualityReport(findings: DesignTellFinding[]): UnitQualityReport {
  const blocking = findings.filter((f) => f.severity === 'error')
  return {
    status: blocking.length > 0 ? 'failed' : 'passed',
    findings: findings.map((f) => ({
      unitId: f.unitId,
      code: f.code,
      message: f.message,
      samples: f.samples,
    })),
    failedUnitIds: Array.from(new Set(blocking.map((f) => f.unitId))),
  }
}

export function hasAnyBlockingTell(findings: DesignTellFinding[]): boolean {
  return findings.some((f) => f.severity === 'error')
}
