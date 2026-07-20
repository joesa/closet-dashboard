/**
 * Per-site custom render mode — types + sanitize/validate helpers shared by
 * the admin custom-build API. Mirror of custom-closets-websites/src/lib/customSite.ts
 * (kept in sync manually — the two apps are separate packages).
 */

export type CustomRenderMode = 'inline' | 'iframe'

export type CustomPageArtifact = {
  html: string
  css?: string
  title?: string
  description?: string
}

export type CustomSiteConfig = {
  mode: CustomRenderMode
  globalCss?: string
  pages: Record<string, CustomPageArtifact>
}

export const WIDGET_PLACEHOLDER = '<!-- CLOSET_WIDGET -->'
export const WIDGET_PLACEHOLDER_ALT = '{{CLOSET_WIDGET}}'

/** AI sometimes emits `<!-- CLOSET_WIDGET theme="dark" -->` — must still match. */
const WIDGET_COMMENT_RE = /<!--\s*CLOSET_WIDGET\b[\s\S]*?-->/gi
const WIDGET_MUSTACHE_RE = /\{\{\s*CLOSET_WIDGET\s*\}\}/gi

export function isCustomSiteConfig(v: unknown): v is CustomSiteConfig {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false
  const o = v as CustomSiteConfig
  if (o.mode !== 'inline' && o.mode !== 'iframe') return false
  if (!o.pages || typeof o.pages !== 'object' || Array.isArray(o.pages)) return false
  return true
}

export function normalizeCustomPath(path: string): string {
  const t = (path || '/').trim()
  if (!t || t === '/') return '/'
  const withSlash = t.startsWith('/') ? t : `/${t}`
  return withSlash.replace(/\/+$/, '') || '/'
}

/**
 * Canonicalize AI-mutated widget markers and keep a single mount point.
 * Fixes Full Redesign bugs like `<!-- CLOSET_WIDGET theme="dark" -->` inside
 * an empty `.widget-container` plus a duplicate append after the footer.
 */
export function normalizeWidgetPlaceholders(html: string): string {
  if (!html) return ''
  let out = html
  out = out.replace(WIDGET_COMMENT_RE, WIDGET_PLACEHOLDER)
  out = out.replace(WIDGET_MUSTACHE_RE, WIDGET_PLACEHOLDER)

  const first = out.indexOf(WIDGET_PLACEHOLDER)
  if (first >= 0) {
    const before = out.slice(0, first + WIDGET_PLACEHOLDER.length)
    const after = out
      .slice(first + WIDGET_PLACEHOLDER.length)
      .split(WIDGET_PLACEHOLDER)
      .join('')
    out = before + after
  }

  // Drop empty decoy shells left after deduping a footer append.
  out = out.replace(
    /<(div|section)([^>]*\b(?:widget-container|closet-widget-slot)\b[^>]*)>\s*<\/\1>/gi,
    ''
  )
  return out
}

/** True if injectWidgetPlaceholder would mount a live engagement widget. */
export function htmlHasInjectableWidget(html: string): boolean {
  const n = normalizeWidgetPlaceholders(html)
  return (
    n.includes(WIDGET_PLACEHOLDER) ||
    /<closet-(?:quote|order|booking|ticket)-widget\b/i.test(n)
  )
}

/**
 * Styled mount shells (e.g. .widget-container) with no placeholder/widget inside
 * — the empty box under "Start Your Project" class of bug.
 */
export function findEmptyWidgetShells(html: string): string[] {
  const shells: string[] = []
  const re =
    /<(div|section)([^>]*\b(?:widget-container|closet-widget-slot|quote-embed|quote-slot)\b[^>]*)>([\s\S]*?)<\/\1>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const inner = m[3] || ''
    const hasMount =
      /<!--\s*CLOSET_WIDGET\b/i.test(inner) ||
      /\{\{\s*CLOSET_WIDGET\s*\}\}/i.test(inner) ||
      /<closet-(?:quote|order|booking|ticket)-widget\b/i.test(inner)
    const withoutComments = inner.replace(/<!--[\s\S]*?-->/g, '').trim()
    if (!hasMount && withoutComments === '') {
      shells.push((m[2] || '').trim().slice(0, 120) || 'widget shell')
    }
  }
  return shells
}

/**
 * Live HTML: mount shells that never received a real <closet-*-widget>
 * (comment-only / empty CTA boxes after a failed inject).
 */
export function findUnmountedWidgetShells(html: string): string[] {
  const shells: string[] = []
  const re =
    /<(div|section)([^>]*\b(?:widget-container|closet-widget-slot|quote-embed|quote-slot)\b[^>]*)>([\s\S]*?)<\/\1>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const inner = m[3] || ''
    if (!/<closet-(?:quote|order|booking|ticket)-widget\b/i.test(inner)) {
      shells.push((m[2] || '').trim().slice(0, 120) || 'widget shell')
    }
  }
  return shells
}

/**
 * Pure-JS HTML sanitizer (no jsdom/DOMPurify). isomorphic-dompurify pulls
 * jsdom and is unreliable on Vercel serverless; this strips the dangerous
 * bits while preserving our widget HTML comment placeholder.
 */
export function sanitizeCustomHtml(html: string): string {
  if (!html) return ''
  let out = html
  out = out.replace(/<\s*(script|iframe|object|embed|form)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
  out = out.replace(/<\s*(script|iframe|object|embed|form)\b[^>]*\/?\s*>/gi, '')
  out = out.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  out = out.replace(/\s(href|src|action)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi, ' $1="#"')
  out = out.replace(/\ssrcdoc\s*=\s*("[^"]*"|'[^']*')/gi, '')
  return normalizeWidgetPlaceholders(out)
}

export function sanitizeCustomCss(css: string): string {
  if (!css) return ''
  return css
    .replace(/@import\b[^;]*;?/gi, '')
    .replace(/expression\s*\(/gi, 'invalid(')
    .replace(/url\s*\(\s*['"]?\s*javascript:/gi, 'url(about:blank')
    .replace(/-moz-binding\s*:/gi, 'invalid:')
}

/** Sanitize every page + global CSS in a custom config artifact. */
export function sanitizeCustomConfig(config: CustomSiteConfig): CustomSiteConfig {
  const pages: Record<string, CustomPageArtifact> = {}
  for (const [rawPath, page] of Object.entries(config.pages || {})) {
    const path = normalizeCustomPath(rawPath)
    pages[path] = {
      html: sanitizeCustomHtml(page?.html || ''),
      css: page?.css ? sanitizeCustomCss(page.css) : undefined,
      title: typeof page?.title === 'string' ? page.title.slice(0, 200) : undefined,
      description:
        typeof page?.description === 'string' ? page.description.slice(0, 500) : undefined,
    }
  }
  return {
    mode: config.mode === 'iframe' ? 'iframe' : 'inline',
    globalCss: config.globalCss ? sanitizeCustomCss(config.globalCss) : undefined,
    pages,
  }
}

export type CustomPublishCheck = {
  ok: boolean
  warnings: string[]
  errors: string[]
}

/**
 * Pre-publish validation. Missing / non-injectable home widget is a hard error
 * so Full Redesign cannot ship an empty quote box.
 */
export function validateCustomConfig(config: CustomSiteConfig): CustomPublishCheck {
  const warnings: string[] = []
  const errors: string[] = []
  const pageKeys = Object.keys(config.pages || {})
  if (pageKeys.length === 0) {
    errors.push('No pages in custom config — at least "/" is required.')
  }

  const home = config.pages['/'] || config.pages['']
  if (!home) {
    errors.push('No home page ("/") — visitors hitting / will 404 or fall back.')
  } else {
    const homeHtml = home.html || ''
    if (!htmlHasInjectableWidget(homeHtml)) {
      errors.push(
        `Home page is missing a live engagement widget mount. Embed exactly ${WIDGET_PLACEHOLDER} (no attributes) inside the quote/CTA section.`
      )
    }
    // Check shells on raw HTML before normalize would fill them — catches
    // empty .widget-container with no CLOSET_WIDGET marker at all.
    const emptyShells = findEmptyWidgetShells(homeHtml)
    if (emptyShells.length > 0) {
      errors.push(
        `Home page has an empty widget container (${emptyShells[0]}) with no ${WIDGET_PLACEHOLDER} inside — visitors see a blank box instead of the calculator.`
      )
    }
  }

  for (const [path, page] of Object.entries(config.pages || {})) {
    const html = page?.html || ''
    if (/<script\b/i.test(html) && config.mode === 'inline') {
      errors.push(`Page ${path}: <script> tags are not allowed in inline mode (use iframe mode).`)
    }
    if (/javascript:/i.test(html)) {
      errors.push(`Page ${path}: javascript: URLs are not allowed.`)
    }
    if (/on\w+\s*=/i.test(html) && config.mode === 'inline') {
      warnings.push(`Page ${path}: inline event handlers will be stripped on render.`)
    }
  }

  return { ok: errors.length === 0, warnings, errors }
}
