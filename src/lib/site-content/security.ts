import sanitizeHtml from 'sanitize-html'
import {
  sanitizeCustomConfig,
  normalizeDuplicateHtmlIds,
  normalizeWidgetPlaceholders,
  WIDGET_PLACEHOLDER,
  type CustomSiteConfig,
} from '@/lib/customSite'
import { normalizeBrandLogoLinks } from '@/lib/ai/surgicalImageLightbox'

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
  if (path.at(-2)?.toLowerCase() === 'images') return true
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
  const purified = sanitizeHtml(protectedWidget, {
    allowedTags: [
      'main', 'section', 'article', 'header', 'footer', 'nav', 'aside',
      'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'a', 'img', 'picture', 'source', 'figure', 'figcaption',
      'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'br', 'hr',
      'strong', 'em', 'b', 'i', 'u', 's', 'small', 'sub', 'sup',
      'blockquote', 'pre', 'code', 'time', 'address', 'details', 'summary',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'colgroup', 'col',
      'video', 'audio', 'track',
      // CSS-only image lightbox + service drawers need these (no scripts).
      'label', 'input',
      'svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline',
      'polygon', 'defs', 'linearGradient', 'radialGradient', 'stop', 'clipPath',
      'mask', 'pattern', 'symbol', 'use', 'text', 'tspan', 'title', 'desc',
      PLACEHOLDER_TAG,
    ],
    allowedAttributes: {
      '*': [
        'id', 'class', 'style', 'title', 'role', 'tabindex', 'hidden',
        'aria-*', 'data-*',
      ],
      a: ['href', 'target', 'rel', 'download'],
      img: ['src', 'alt', 'width', 'height', 'loading', 'decoding', 'fetchpriority'],
      source: ['src', 'type', 'media', 'sizes'],
      video: ['src', 'poster', 'controls', 'autoplay', 'muted', 'loop', 'playsinline', 'preload', 'width', 'height'],
      audio: ['src', 'controls', 'autoplay', 'muted', 'loop', 'preload'],
      track: ['src', 'kind', 'srclang', 'label', 'default'],
      input: ['type', 'class', 'id', 'aria-label', 'aria-hidden', 'tabindex', 'hidden', 'checked', 'name', 'value'],
      label: ['class', 'id', 'for', 'aria-label'],
      th: ['colspan', 'rowspan', 'scope'],
      td: ['colspan', 'rowspan'],
      col: ['span'],
      svg: ['xmlns', 'viewBox', 'width', 'height', 'fill', 'stroke', 'preserveAspectRatio'],
      g: ['fill', 'stroke', 'transform', 'opacity', 'clip-path', 'mask'],
      path: ['d', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'transform', 'opacity'],
      circle: ['cx', 'cy', 'r', 'fill', 'stroke', 'stroke-width', 'transform', 'opacity'],
      ellipse: ['cx', 'cy', 'rx', 'ry', 'fill', 'stroke', 'stroke-width', 'transform', 'opacity'],
      rect: ['x', 'y', 'rx', 'ry', 'width', 'height', 'fill', 'stroke', 'stroke-width', 'transform', 'opacity'],
      line: ['x1', 'x2', 'y1', 'y2', 'stroke', 'stroke-width', 'transform', 'opacity'],
      polyline: ['points', 'fill', 'stroke', 'stroke-width', 'transform', 'opacity'],
      polygon: ['points', 'fill', 'stroke', 'stroke-width', 'transform', 'opacity'],
      linearGradient: ['id', 'x1', 'x2', 'y1', 'y2', 'gradientUnits', 'gradientTransform'],
      radialGradient: ['id', 'cx', 'cy', 'r', 'fx', 'fy', 'gradientUnits', 'gradientTransform'],
      stop: ['offset', 'stop-color', 'stop-opacity'],
      use: ['href', 'xlink:href', 'x', 'y', 'width', 'height'],
      text: ['x', 'y', 'dx', 'dy', 'fill', 'stroke', 'transform', 'text-anchor'],
      tspan: ['x', 'y', 'dx', 'dy', 'fill', 'stroke'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    parser: { lowerCaseAttributeNames: false },
    transformTags: {
      input: (tagName, attribs) => {
        const type = String(attribs.type || '').toLowerCase()
        // Only inert checkbox toggles for CSS lightbox / drawers — never text/password/submit.
        if (type && type !== 'checkbox' && type !== 'hidden') {
          return { tagName: 'span', attribs: { class: attribs.class || '' } }
        }
        return {
          tagName,
          attribs: {
            ...attribs,
            type: type || 'checkbox',
          },
        }
      },
      '*': (tagName, attribs) => {
        const next = { ...attribs }
        if (next.style && /expression\s*\(|url\s*\(\s*['"]?\s*(?:javascript|data):|-moz-binding\s*:|behavior\s*:|@import/i.test(next.style)) {
          delete next.style
        }
        delete next.srcset
        for (const key of ['href', 'xlink:href']) {
          if (tagName === 'use' && next[key] && !next[key].startsWith('#')) delete next[key]
        }
        if (next.src && /^data:/i.test(next.src) && !/^data:image\/(?:png|jpeg|webp);base64,/i.test(next.src)) {
          delete next.src
        }
        return { tagName, attribs: next }
      },
    },
  })
  const restored = purified.replace(
    new RegExp(`<${PLACEHOLDER_TAG}(?:\\s[^>]*)?></${PLACEHOLDER_TAG}>`, 'gi'),
    WIDGET_PLACEHOLDER
  )
  const withIds = normalizeDuplicateHtmlIds(restored).html
  return normalizeBrandLogoLinks(withIds).html
}

/** Regex sanitizer remains defense-in-depth; sanitize-html is the parser-backed gate. */
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
