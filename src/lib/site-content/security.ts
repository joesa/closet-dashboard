import DOMPurify from 'isomorphic-dompurify'
import {
  sanitizeCustomConfig,
  normalizeWidgetPlaceholders,
  WIDGET_PLACEHOLDER,
  type CustomSiteConfig,
} from '@/lib/customSite'

const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024
const MAX_NODES = 20_000
const MAX_DEPTH = 20
const MAX_ARRAY_ITEMS = 500
const MAX_TEXT_LENGTH = 100_000
const MAX_HTML_LENGTH = 1_500_000
const MAX_CSS_LENGTH = 500_000
const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor'])
const URL_KEY = /(?:^|_)(?:url|uri|href|src|link|image|logo)$/i
const CAMEL_URL_KEY = /(?:Url|Uri|Href|Src|Link|Image|Logo)$/
const PLACEHOLDER_TAG = 'dtf-widget-placeholder'

function stringLimit(path: string[]): number {
  const key = path.at(-1)?.toLowerCase() || ''
  if (key === 'html') return MAX_HTML_LENGTH
  if (key === 'css' || key === 'globalcss') return MAX_CSS_LENGTH
  return MAX_TEXT_LENGTH
}

function isUrlField(path: string[]): boolean {
  const key = path.at(-1) || ''
  if (/alt$/i.test(key)) return false
  return URL_KEY.test(key) || CAMEL_URL_KEY.test(key)
}

function assertSafeUrl(value: string, path: string[]) {
  const compact = value.replace(/[\u0000-\u0020\u007f-\u009f]/g, '').toLowerCase()
  if (/^(?:javascript|vbscript):/.test(compact)) {
    throw new Error(`Unsafe URL scheme at /${path.join('/')}`)
  }
  if (/^data:(?!image\/(?:png|jpeg|webp);base64,)/.test(compact)) {
    throw new Error(`Unsafe data URL at /${path.join('/')}`)
  }
}

/**
 * Bound recursive user JSON before it reaches validation, logs, revisions, or
 * Postgres JSONB. SQL-like text remains valid content; database calls are
 * parameterized. We reject dangerous object keys, resource-exhaustion shapes,
 * control bytes, non-finite numbers, and executable URL schemes.
 */
export function assertSafeContentValue(value: unknown): void {
  let serialized: string
  try {
    serialized = JSON.stringify(value)
  } catch {
    throw new Error('Content must be valid JSON')
  }
  if (Buffer.byteLength(serialized, 'utf8') > MAX_DOCUMENT_BYTES) {
    throw new Error('Website content exceeds the 4MB safety limit')
  }

  let nodes = 0
  const walk = (current: unknown, path: string[], depth: number) => {
    nodes += 1
    if (nodes > MAX_NODES) throw new Error('Website content is too complex')
    if (depth > MAX_DEPTH) throw new Error('Website content is nested too deeply')
    if (typeof current === 'string') {
      if (current.length > stringLimit(path)) throw new Error(`Content is too long at /${path.join('/')}`)
      if (/[\u0000\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(current)) {
        throw new Error(`Content contains forbidden control characters at /${path.join('/')}`)
      }
      if (isUrlField(path)) assertSafeUrl(current, path)
      return
    }
    if (typeof current === 'number' && !Number.isFinite(current)) {
      throw new Error(`Content contains an invalid number at /${path.join('/')}`)
    }
    if (Array.isArray(current)) {
      if (current.length > MAX_ARRAY_ITEMS) throw new Error(`Too many items at /${path.join('/')}`)
      current.forEach((item, index) => walk(item, [...path, String(index)], depth + 1))
      return
    }
    if (current && typeof current === 'object') {
      for (const [key, child] of Object.entries(current as Record<string, unknown>)) {
        if (DANGEROUS_KEYS.has(key)) throw new Error(`Unsafe content key: ${key}`)
        if (key.length > 200) throw new Error('Content field name is too long')
        walk(child, [...path, key], depth + 1)
      }
    }
  }
  walk(value, [], 0)
}

export function sanitizeUntrustedCustomHtml(html: string): string {
  const normalized = normalizeWidgetPlaceholders(html)
  const protectedWidget = normalized.replace(
    WIDGET_PLACEHOLDER,
    `<${PLACEHOLDER_TAG}></${PLACEHOLDER_TAG}>`
  )
  const purified = DOMPurify.sanitize(protectedWidget, {
    USE_PROFILES: { html: true, svg: true, svgFilters: true },
    ADD_TAGS: [PLACEHOLDER_TAG],
    FORBID_TAGS: [
      'script', 'iframe', 'object', 'embed', 'form', 'input', 'button',
      'textarea', 'select', 'option', 'base', 'meta', 'link', 'template', 'noscript',
    ],
    FORBID_ATTR: ['srcdoc', 'formaction', 'ping'],
    ALLOW_DATA_ATTR: true,
    ALLOW_ARIA_ATTR: true,
  })
  return purified.replace(
    new RegExp(`<${PLACEHOLDER_TAG}(?:\\s[^>]*)?></${PLACEHOLDER_TAG}>`, 'gi'),
    WIDGET_PLACEHOLDER
  )
}

/** Regex sanitizer remains defense-in-depth; DOMPurify is the parser-backed gate. */
export function hardenCustomConfig(config: CustomSiteConfig): CustomSiteConfig {
  const sanitized = sanitizeCustomConfig(config)
  return {
    ...sanitized,
    pages: Object.fromEntries(
      Object.entries(sanitized.pages).map(([path, page]) => [
        path,
        { ...page, html: sanitizeUntrustedCustomHtml(page.html || '') },
      ])
    ),
  }
}
