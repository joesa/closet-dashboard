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

export function sanitizeCustomHtml(html: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const DOMPurify = require('isomorphic-dompurify') as typeof import('isomorphic-dompurify')
  return DOMPurify.sanitize(html || '', {
    USE_PROFILES: { html: true },
    ADD_TAGS: ['closet-quote-widget', 'closet-order-widget'],
    ADD_ATTR: [
      'data-contractor-id',
      'data-api-url',
      'data-preview-color',
      'data-radius',
      'data-font-heading',
      'data-widget-title',
      'class',
      'style',
      'id',
    ],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['srcdoc'],
  })
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

export function validateCustomConfig(config: CustomSiteConfig): CustomPublishCheck {
  const warnings: string[] = []
  const errors: string[] = []
  const pageKeys = Object.keys(config.pages || {})
  if (pageKeys.length === 0) {
    errors.push('No pages in custom config — at least "/" is required.')
  }
  if (!config.pages['/'] && !config.pages['']) {
    warnings.push('No home page ("/") — visitors hitting / will 404 or fall back.')
  }

  let hasWidget = false
  for (const [path, page] of Object.entries(config.pages || {})) {
    const html = page?.html || ''
    if (
      html.includes(WIDGET_PLACEHOLDER) ||
      html.includes(WIDGET_PLACEHOLDER_ALT) ||
      /<closet-quote-widget\b/i.test(html)
    ) {
      hasWidget = true
    }
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
  if (!hasWidget) {
    warnings.push(
      `No quote widget placeholder found. Embed ${WIDGET_PLACEHOLDER} (or <closet-quote-widget></closet-quote-widget>) so leads still convert.`
    )
  }
  return { ok: errors.length === 0, warnings, errors }
}
