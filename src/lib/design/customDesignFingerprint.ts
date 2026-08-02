/**
 * A comparable design signature for Full redesign artifacts.
 *
 * catalog/designFingerprint.ts already guarantees engine sites do not duplicate
 * each other, but it works from a *seed* — it describes the design the renderer
 * is about to build. Full redesign has no seed: it emits freeform HTML and CSS,
 * so the only place its design exists is in the artifact itself. This module
 * reads the design back out of what was emitted.
 *
 * Five axes are extracted and jointly compared. Exact/near skeleton reuse is
 * always a collision; otherwise a weighted visual score catches the same skin
 * after superficial reordering or recoloring.
 *
 * Skeleton comparison is normalized LCS rather than exact match, deliberately:
 * inserting one section into an otherwise identical rhythm should still count as
 * the same design, or the check would be trivial to slip past by accident.
 *
 * Pure — no DB, no network. designAvoidList.ts owns persistence.
 */

import { hashSeed } from '@/lib/catalog/designFingerprint'
import type { CustomSiteConfig } from '@/lib/customSite'
import {
  extractFontFamilies,
  extractRootColorTokens,
  hexToHsl,
} from '@/lib/validation/designTellScanner'
import {
  SKELETON_COLLISION_THRESHOLD,
  VISUAL_COLLISION_THRESHOLD,
  type FingerprintAxis,
} from '@/lib/validation/designGuardPolicy'

/**
 * Bump when an extractor changes shape. Rows written by an older version are
 * ignored rather than mis-compared — a fingerprint is only meaningful against
 * others produced the same way.
 */
export const CUSTOM_FINGERPRINT_VERSION = 1

export type CustomDesignFingerprint = {
  version: number
  /** Role-sorted hue/lightness/chroma buckets, e.g. 'bg:h11-l9-c0'. */
  paletteBuckets: string[]
  fonts: { display: string; body: string }
  /** Ordered home section types, capped at MAX_SKELETON. */
  skeleton: string[]
  /** Dominant radius + border weight + shadow presence, e.g. 'r2-b1-s1'. */
  shape: string
  /** Chrome motifs present, sorted. */
  motifs: string[]
  hash: string
}

const MAX_SKELETON = 12

// ── buckets ─────────────────────────────────────────────────────────────────

/** 12 hue buckets of 30°, 10 lightness, 8 chroma. Coarse on purpose: two
 *  designs a human calls "the same green" must land in the same bucket. */
function colorBucket(hex: string): string | null {
  const hsl = hexToHsl(hex)
  if (!hsl) return null
  const h = hsl.c < 0.04 ? 12 : Math.floor(hsl.h / 30) % 12 // 12 == neutral
  const l = Math.min(9, Math.floor(hsl.l * 10))
  const c = Math.min(7, Math.floor(hsl.c * 8))
  return `h${String(h).padStart(2, '0')}-l${l}-c${c}`
}

/** Canonical registry key for a named palette before CSS is generated. */
export function paletteFingerprintKey(
  colors: readonly { role: string; hex: string }[]
): string {
  return colors
    .map(({ role, hex }) => {
      const bucket = colorBucket(hex)
      return bucket ? `${role.trim().toLowerCase()}:${bucket}` : ''
    })
    .filter(Boolean)
    .join('|') || 'none'
}

const PALETTE_ROLES: Array<{ role: string; re: RegExp }> = [
  { role: 'bg', re: /^(?:bg|background|surface|paper|ground|canvas|base)\b/ },
  { role: 'ink', re: /^(?:ink|text|fg|foreground|body)\b/ },
  { role: 'muted', re: /^(?:muted|subtle|secondary|dim)\b/ },
  { role: 'line', re: /^(?:line|border|rule|divider|hairline)\b/ },
  { role: 'acc', re: /^(?:acc|accent|brand|primary|cta|highlight)/ },
]

function extractPaletteBuckets(css: string): string[] {
  const tokens = extractRootColorTokens(css)
  const out: string[] = []
  for (const { role, re } of PALETTE_ROLES) {
    const token = tokens.find((t) => re.test(t.name))
    if (!token) continue
    const bucket = colorBucket(token.hex)
    if (bucket) out.push(`${role}:${bucket}`)
  }
  if (out.length > 0) return out

  // No named roles: fall back to the most-used hexes so an artifact that writes
  // colour inline still produces something comparable rather than nothing.
  const counts = new Map<string, number>()
  for (const match of css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    const hex = match[0].toLowerCase()
    counts.set(hex, (counts.get(hex) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([hex], i) => {
      const bucket = colorBucket(hex)
      return bucket ? `c${i}:${bucket}` : ''
    })
    .filter(Boolean)
}

// ── skeleton ────────────────────────────────────────────────────────────────

/**
 * Classify one home section by what it structurally is. Ordering matters: the
 * first rule that matches wins, most specific first.
 */
function classifySection(html: string, index: number): string {
  const lower = html.toLowerCase()
  const imgs = (lower.match(/<img\b/g) || []).length
  const headings = (lower.match(/<h[1-6]\b/g) || []).length
  const links = (lower.match(/<a\b/g) || []).length
  const listItems = (lower.match(/<li\b/g) || []).length
  const paras = (lower.match(/<p\b/g) || []).length
  const text = lower.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

  if (/closet_widget|widget-mount/i.test(html)) return 'engage'
  if (index === 0 && /<h1\b/.test(lower)) return 'hero'
  if (/<details\b|faq/i.test(lower)) return 'faq'
  if (/<form\b|tel:|mailto:/.test(lower) && paras <= 4) return 'contact'
  if (imgs >= 4) return 'gallery'
  if (/testimonial|review|quote|said/i.test(text) && paras >= 2) return 'proof'
  if (/step|process|how it works|stage/i.test(text) && (listItems >= 3 || headings >= 3)) {
    return 'process'
  }
  if (headings >= 3) return `grid${Math.min(6, headings)}`
  if (imgs >= 1 && paras >= 1 && headings <= 2) return 'split'
  if (links >= 1 && paras <= 1 && headings <= 1) return 'band'
  if (listItems >= 3) return 'list'
  if (paras >= 1) return 'prose'
  return 'block'
}

function extractSkeleton(homeHtml: string): string[] {
  if (!homeHtml?.trim()) return []
  const sections = homeHtml.match(/<section\b[\s\S]*?<\/section>/gi) || []
  const source =
    sections.length > 0
      ? sections
      : homeHtml.match(/<(?:main|article|div)\b[\s\S]*?<\/(?:main|article|div)>/gi)?.slice(0, MAX_SKELETON) ||
        []
  return source.slice(0, MAX_SKELETON).map((html, i) => classifySection(html, i))
}

// ── shape + motifs ──────────────────────────────────────────────────────────

function extractShape(css: string): string {
  const radii = Array.from(css.matchAll(/border-radius\s*:\s*([^;}\n]+)/gi))
    .map((m) => m[1].trim())
    .filter((v) => !/50%|9999px|999px/.test(v))
  const px = radii
    .map((v) => parseFloat(v))
    .filter((n) => Number.isFinite(n))
  const median = px.length ? px.sort((a, b) => a - b)[Math.floor(px.length / 2)] : 0
  const r = median === 0 ? 0 : median <= 4 ? 1 : median <= 12 ? 2 : 3
  const borders = (css.match(/border(?:-\w+)?\s*:\s*\d/gi) || []).length
  const b = borders === 0 ? 0 : borders <= 6 ? 1 : 2
  const s = /box-shadow\s*:\s*(?!none)/i.test(css) ? 1 : 0
  return `r${r}-b${b}-s${s}`
}

const MOTIF_RULES: Array<{ id: string; test: (css: string, html: string) => boolean }> = [
  { id: 'sticky-header', test: (css) => /position\s*:\s*sticky/i.test(css) },
  { id: 'eyebrow', test: (_css, html) => /class="[^"]*eyebrow/i.test(html) },
  { id: 'uppercase-chrome', test: (css) => /text-transform\s*:\s*uppercase/i.test(css) },
  { id: 'wide-tracking', test: (css) => /letter-spacing\s*:\s*0?\.\d+em/i.test(css) },
  {
    id: 'hairline-grid',
    // Both the shorthand and the per-side form; a 1px rule is the motif either way.
    test: (css) => /border(?:-(?:top|bottom|left|right))?\s*:\s*1px/i.test(css),
  },
  { id: 'photo-bleed', test: (css) => /object-fit\s*:\s*cover/i.test(css) },
  { id: 'rule-divider', test: (_css, html) => /<hr\b/i.test(html) },
  { id: 'reveal-motion', test: (css) => /@keyframes/i.test(css) },
  { id: 'details-disclosure', test: (_css, html) => /<details\b/i.test(html) },
  { id: 'mono-detail', test: (css) => /font-family[^;}]*mono/i.test(css) },
]

function extractMotifs(css: string, html: string): string[] {
  return MOTIF_RULES.filter((r) => r.test(css, html)).map((r) => r.id)
}

// ── extraction ──────────────────────────────────────────────────────────────

export function extractCustomDesignFingerprint(
  config: CustomSiteConfig
): CustomDesignFingerprint {
  const globalCss = config.globalCss || ''
  const home = config.pages?.['/']?.html || config.pages?.['']?.html || ''
  const allHtml = Object.values(config.pages || {})
    .map((p) => p?.html || '')
    .join('\n')

  const fontsFound = extractFontFamilies(globalCss, allHtml)
  const fonts = {
    display: (fontsFound.display || '').toLowerCase(),
    body: (fontsFound.body || '').toLowerCase(),
  }
  const paletteBuckets = extractPaletteBuckets(globalCss)
  const skeleton = extractSkeleton(home)
  const shape = extractShape(globalCss)
  const motifs = extractMotifs(globalCss, allHtml).sort()

  const normalized = JSON.stringify({
    v: CUSTOM_FINGERPRINT_VERSION,
    paletteBuckets,
    fonts,
    skeleton,
    shape,
    motifs,
  })

  return {
    version: CUSTOM_FINGERPRINT_VERSION,
    paletteBuckets,
    fonts,
    skeleton,
    shape,
    motifs,
    hash: hashSeed(normalized).toString(36),
  }
}

// ── comparison ──────────────────────────────────────────────────────────────

/** Longest common subsequence length of two ordered sequences. */
function lcsLength(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  let prev = new Array<number>(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i += 1) {
    const cur = new Array<number>(b.length + 1).fill(0)
    for (let j = 1; j <= b.length; j += 1) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1])
    }
    prev = cur
  }
  return prev[b.length]
}

function jaccard(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 && b.length === 0) return 1
  const sa = new Set(a)
  const sb = new Set(b)
  let shared = 0
  for (const v of sa) if (sb.has(v)) shared += 1
  const union = sa.size + sb.size - shared
  return union === 0 ? 1 : shared / union
}

/**
 * The blocking axis. Normalized against the longer sequence so that a short
 * skeleton fully contained in a longer one does not score a perfect 1.
 */
export function skeletonSimilarity(
  a: CustomDesignFingerprint,
  b: CustomDesignFingerprint
): number {
  if (a.version !== b.version) return 0
  if (a.skeleton.length === 0 || b.skeleton.length === 0) return 0
  return lcsLength(a.skeleton, b.skeleton) / Math.max(a.skeleton.length, b.skeleton.length)
}

/** Per-axis scores. Reported as warnings and used to build the avoid list. */
export function axisSimilarities(
  a: CustomDesignFingerprint,
  b: CustomDesignFingerprint
): Record<FingerprintAxis, number> {
  if (a.version !== b.version) {
    return { palette: 0, fonts: 0, skeleton: 0, shape: 0, motifs: 0 }
  }
  const fontsScore =
    (a.fonts.display && a.fonts.display === b.fonts.display ? 0.6 : 0) +
    (a.fonts.body && a.fonts.body === b.fonts.body ? 0.4 : 0)
  return {
    palette: jaccard(a.paletteBuckets, b.paletteBuckets),
    fonts: fontsScore,
    skeleton: skeletonSimilarity(a, b),
    shape: a.shape === b.shape ? 1 : 0,
    motifs: jaccard(a.motifs, b.motifs),
  }
}

/**
 * Human-perceived similarity across the artifact's visual system. Skeleton is
 * deliberately not dominant: two sites with reordered sections still look like
 * the same template when their palette, type, geometry and recurring chrome
 * are unchanged.
 */
export function visualSimilarity(
  a: CustomDesignFingerprint,
  b: CustomDesignFingerprint
): number {
  const scores = axisSimilarities(a, b)
  return (
    scores.skeleton * 0.4 +
    scores.palette * 0.2 +
    scores.fonts * 0.15 +
    scores.shape * 0.1 +
    scores.motifs * 0.15
  )
}

export function isSkeletonCollision(
  a: CustomDesignFingerprint,
  b: CustomDesignFingerprint,
  threshold: number = SKELETON_COLLISION_THRESHOLD
): boolean {
  return skeletonSimilarity(a, b) >= threshold
}

export function isDesignCollision(
  a: CustomDesignFingerprint,
  b: CustomDesignFingerprint,
  visualThreshold = VISUAL_COLLISION_THRESHOLD
): boolean {
  return isSkeletonCollision(a, b) || visualSimilarity(a, b) >= visualThreshold
}

/** Index keys mirrored into the registry's indexed columns. */
export function fingerprintKeys(fp: CustomDesignFingerprint): {
  paletteKey: string
  fontKey: string
  skeletonKey: string
  shapeKey: string
  motifKey: string
} {
  return {
    paletteKey: fp.paletteBuckets.join('|') || 'none',
    fontKey: `${fp.fonts.display}+${fp.fonts.body}` || 'none',
    skeletonKey: fp.skeleton.join('>') || 'none',
    shapeKey: fp.shape,
    motifKey: fp.motifs.join('|') || 'none',
  }
}

/** One human line per taken design, for the avoid-list prompt block. */
export function describeFingerprintForAvoidList(fp: CustomDesignFingerprint): string {
  const skeleton = fp.skeleton.join('→') || '(unread)'
  const type = [fp.fonts.display, fp.fonts.body].filter(Boolean).join(' + ') || '(unread)'
  const palette = fp.paletteBuckets.join(' ') || '(unread)'
  return `${skeleton} · type ${type} · palette ${palette}`
}
