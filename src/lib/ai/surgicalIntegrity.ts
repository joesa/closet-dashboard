/**
 * Surgical edit integrity: prevent models from wiping site-wide CSS / chrome.
 * Server-only helpers used by merge + draft save gates.
 */

import * as cheerio from 'cheerio'

export type SurgicalCssMergeResult = {
  globalCss: string
  /** True when patch.globalCss was kept as a full replace. */
  replaced: boolean
  /** True when patch CSS was appended (or only append field used). */
  appended: boolean
  warnings: string[]
}

const TOKEN_HINT_RE = /:root\b|--(?:bg|ink|acc|df|bf|muted|line|paper|background)\b/i

/** True when CSS looks like it carries the site design-system tokens. */
export function cssHasDesignTokens(css: string): boolean {
  const s = css || ''
  if (!s.trim()) return false
  if (/:root\s*\{/.test(s) && /--[a-zA-Z]/.test(s)) return true
  return TOKEN_HINT_RE.test(s) && (s.match(/--[a-zA-Z][\w-]*/g) || []).length >= 3
}

/** Catastrophic shrink or lost tokens vs base. */
export function isCatastrophicCssReplace(
  baseCss: string,
  patchCss: string
): boolean {
  const base = baseCss || ''
  const patch = patchCss || ''
  if (!base.trim()) return false
  if (!patch.trim()) return true
  if (base.length >= 400 && patch.length < base.length * 0.6) return true
  if (cssHasDesignTokens(base) && !cssHasDesignTokens(patch)) return true
  return false
}

/** Patch looks like additive rules (no :root redesign). */
export function looksLikeAdditiveCss(css: string): boolean {
  const s = (css || '').trim()
  if (!s) return false
  if (/:root\s*\{/.test(s)) return false
  // Prefer class/id rules over a full sheet
  return s.length < 8000
}

export function appendGlobalCss(base: string, append: string): string {
  const a = (append || '').trim()
  if (!a) return base || ''
  const b = base || ''
  if (!b.trim()) return a
  if (b.includes(a)) return b
  return `${b.replace(/\s+$/, '')}\n\n/* surgical append */\n${a}\n`
}

/**
 * Merge surgical CSS onto base.
 * - globalCssAppend always appends.
 * - globalCss full replace only when safe; otherwise append if additive, else keep base.
 */
export function mergeSurgicalGlobalCss(opts: {
  baseCss: string
  globalCss?: string | null
  globalCssAppend?: string | null
  /** Admin explicitly asked to restyle / redesign global CSS. */
  allowFullCssReplace?: boolean
}): SurgicalCssMergeResult {
  const warnings: string[] = []
  let css = opts.baseCss || ''
  let replaced = false
  let appended = false

  const appendPart =
    typeof opts.globalCssAppend === 'string' ? opts.globalCssAppend.trim() : ''
  if (appendPart) {
    css = appendGlobalCss(css, appendPart)
    appended = true
  }

  if (typeof opts.globalCss === 'string' && opts.globalCss.trim()) {
    const patch = opts.globalCss.trim()
    const catastrophic = isCatastrophicCssReplace(opts.baseCss || '', patch)
    if (opts.allowFullCssReplace || !catastrophic) {
      css = patch
      // Re-apply append after full replace so additive rules are not lost
      if (appendPart) {
        css = appendGlobalCss(css, appendPart)
      }
      replaced = true
      if (catastrophic && opts.allowFullCssReplace) {
        warnings.push(
          'Applied full globalCss replace because the prompt asked to restyle site-wide CSS.'
        )
      }
    } else if (looksLikeAdditiveCss(patch)) {
      css = appendGlobalCss(css, patch)
      appended = true
      warnings.push(
        'Rejected truncated globalCss replace — appended as additive rules instead (preserves design tokens).'
      )
    } else {
      warnings.push(
        'Rejected globalCss replace that would wipe the design system — kept existing globalCss.'
      )
    }
  }

  return { globalCss: css, replaced, appended, warnings }
}

export function countHtmlClasses(html: string): number {
  return (html.match(/\bclass\s*=/gi) || []).length
}

export function hasLandmark(html: string, tag: string): boolean {
  return new RegExp(`<${tag}\\b`, 'i').test(html || '')
}

export type SurgicalIntegrityIssue = {
  field: 'globalCss' | string
  message: string
  /** When set, restore this value on the merged config. */
  restore?: string
}

export type SurgicalIntegrityResult = {
  ok: boolean
  issues: SurgicalIntegrityIssue[]
  /** Config with bad fields reverted to base. */
  repaired: {
    globalCss?: string
    pages?: Record<string, { html?: string }>
  }
  warnings: string[]
}

/**
 * Compare base vs merged after surgical edit. Auto-reverts catastrophic CSS /
 * chrome-stripping HTML patches.
 */
export function assertSurgicalIntegrity(
  base: { globalCss?: string; pages?: Record<string, { html?: string }> },
  merged: { globalCss?: string; pages?: Record<string, { html?: string }> }
): SurgicalIntegrityResult {
  const issues: SurgicalIntegrityIssue[] = []
  const warnings: string[] = []
  const repaired: SurgicalIntegrityResult['repaired'] = { pages: {} }

  const baseCss = base.globalCss || ''
  const mergedCss = merged.globalCss || ''
  if (isCatastrophicCssReplace(baseCss, mergedCss)) {
    issues.push({
      field: 'globalCss',
      message:
        'Surgical edit would wipe or gut globalCss (design tokens / layout). Reverted to previous globalCss.',
      restore: baseCss,
    })
    repaired.globalCss = baseCss
    warnings.push(issues[issues.length - 1]!.message)
  }

  for (const [path, page] of Object.entries(merged.pages || {})) {
    const baseHtml = base.pages?.[path]?.html || ''
    const nextHtml = page?.html
    if (typeof nextHtml !== 'string' || !baseHtml) continue
    if (nextHtml === baseHtml) continue

    const baseClasses = countHtmlClasses(baseHtml)
    const nextClasses = countHtmlClasses(nextHtml)
    if (baseClasses >= 8 && nextClasses < baseClasses * 0.5) {
      issues.push({
        field: path,
        message: `Surgical HTML for ${path} stripped most CSS classes — reverted that page.`,
        restore: baseHtml,
      })
      repaired.pages![path] = { html: baseHtml }
      warnings.push(issues[issues.length - 1]!.message)
      continue
    }

    for (const tag of ['header', 'nav', 'footer'] as const) {
      if (hasLandmark(baseHtml, tag) && !hasLandmark(nextHtml, tag)) {
        issues.push({
          field: path,
          message: `Surgical HTML for ${path} removed <${tag}> — reverted that page.`,
          restore: baseHtml,
        })
        repaired.pages![path] = { html: baseHtml }
        warnings.push(issues[issues.length - 1]!.message)
        break
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    repaired,
    warnings,
  }
}

/** Apply integrity repairs onto a mutable custom config-like object. */
export function applySurgicalIntegrityRepairs<
  T extends {
    globalCss?: string
    pages: Record<string, { html?: string; [k: string]: unknown }>
  },
>(config: T, result: SurgicalIntegrityResult): T {
  if (typeof result.repaired.globalCss === 'string') {
    config.globalCss = result.repaired.globalCss
  }
  for (const [path, page] of Object.entries(result.repaired.pages || {})) {
    if (page.html !== undefined && config.pages[path]) {
      config.pages[path] = { ...config.pages[path], html: page.html }
    }
  }
  return config
}

/** Draft CSS looks broken relative to published (admin banner). */
export function draftCssLooksBroken(
  draftCss: string | null | undefined,
  publishedCss: string | null | undefined
): boolean {
  const draft = draftCss || ''
  const pub = publishedCss || ''
  if (!pub.trim()) return false
  if (!draft.trim() && pub.trim()) return true
  return isCatastrophicCssReplace(pub, draft)
}

export function looksLikeClickableCardsRequest(prompt: string): boolean {
  const p = prompt || ''
  return (
    /\b(clickable|clickable\s+cards?|make\s+(?:the\s+)?(?:service\s+)?cards?\s+clickable|cards?\s+clickable|link\s+(?:the\s+)?(?:service\s+)?cards?)\b/i.test(
      p
    ) ||
    /\bwrap\s+(?:the\s+)?(?:service\s+)?cards?\s+in\s+(?:an?\s+)?(?:a|link|anchor)/i.test(
      p
    )
  )
}

export function looksLikeExplicitGlobalRestyle(prompt: string): boolean {
  return /\b(restyle|redesign|new\s+palette|change\s+(?:the\s+)?(?:global\s+)?(?:css|styles?|colors?|theme)|overhaul\s+(?:the\s+)?css)\b/i.test(
    prompt || ''
  )
}

const CLICKABLE_CARD_CSS = `/* surgical: clickable cards */
a.clickable-card, .clickable-card { cursor: pointer; transition: transform 0.2s ease, box-shadow 0.2s ease; display: block; text-decoration: none; color: inherit; }
a.clickable-card:hover, .clickable-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
`

/**
 * Wrap service/product card blocks in <a class="clickable-card"> when they
 * are not already linked. Cheerio tree walk — avoids fragile nested-regex wraps.
 */
export function makeServiceCardsClickable(
  html: string,
  fallbackHref = '/contact'
): { html: string; wrapped: number } {
  if (!html) return { html: html || '', wrapped: 0 }

  const $ = cheerio.load(html, { xml: false }, false)
  let wrapped = 0

  const cardSel =
    'article[class*="service"], article[class*="card"], article[class*="svc"], article[class*="product"], article[class*="offer"], div[class*="service"], div[class*="card"], div[class*="svc"], div[class*="product"], div[class*="offer"], li[class*="service"], li[class*="card"], li[class*="svc"], li[class*="product"], li[class*="offer"]'

  $(cardSel).each((_, el) => {
    const $el = $(el)
    const classList = $el.attr('class') || ''
    if (/\bclickable-card\b/i.test(classList)) return
    // Already the sole child of an anchor, or is itself an anchor.
    if ($el.parent().is('a') || $el.is('a')) return
    if ($el.closest('a').length) return
    if ($el.closest('.svc-drawer-wrap').length) return
    // Skip containers that nest other card matches (wrap leaves only).
    if ($el.find(cardSel).length > 0) return
    // Require a recognizable card token in the class list.
    if (
      !/\b(?:service|card|svc|product|offer)(?:-|\b)/i.test(classList) &&
      !/\b(?:service-card|product-card|svc-card)\b/i.test(classList)
    ) {
      return
    }

    const innerHref = $el.find('a[href]').first().attr('href')
    const href = innerHref || fallbackHref

    // Flatten nested anchors to avoid invalid <a><a> after wrap.
    $el.find('a').each((__, a) => {
      $(a).replaceWith($(a).contents())
    })

    if (!/\bclickable-card\b/i.test(classList)) {
      $el.attr('class', `${classList} clickable-card`.trim())
    }
    $el.wrap(`<a href="${href}" class="clickable-card"></a>`)
    wrapped += 1
  })

  return { html: $.root().html() || '', wrapped }
}

export function ensureClickableCardCss(globalCss: string): string {
  if (/\.clickable-card\b/.test(globalCss || '')) return globalCss || ''
  return appendGlobalCss(globalCss || '', CLICKABLE_CARD_CSS)
}

export { CLICKABLE_CARD_CSS }
