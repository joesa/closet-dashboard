import { describe, expect, it } from 'vitest'
import {
  assertSafeContentValue,
  sanitizeUntrustedCustomHtml,
} from './security'
import { WIDGET_PLACEHOLDER } from '@/lib/customSite'

describe('assertSafeContentValue', () => {
  it('allows SQL-looking text because it remains parameterized data', () => {
    expect(() => assertSafeContentValue({ headline: `Robert'); DROP TABLE tenants;--` })).not.toThrow()
  })

  it('rejects prototype-pollution keys anywhere in inserted JSON', () => {
    const payload = JSON.parse('{"section":{"__proto__":{"admin":true}}}')
    expect(() => assertSafeContentValue(payload)).toThrow(/unsafe content key/i)
  })

  it('rejects executable schemes in URL fields, including whitespace obfuscation', () => {
    expect(() => assertSafeContentValue({ heroImage: 'java\nscript:alert(1)' })).toThrow(/unsafe url scheme/i)
    expect(() => assertSafeContentValue({ logo_url: 'data:image/svg+xml,<svg onload=alert(1)>' })).toThrow(/unsafe data url/i)
  })

  it('rejects executable URLs inside gallery image arrays', () => {
    expect(() => assertSafeContentValue({ images: ['javascript:alert(1)'] })).toThrow(/unsafe url scheme/i)
    expect(() => assertSafeContentValue({ images: ['https://example.com/photo.jpg'] })).not.toThrow()
  })
})

describe('sanitizeUntrustedCustomHtml', () => {
  it('removes scripts, event handlers, unsafe links, and embedded documents', () => {
    const output = sanitizeUntrustedCustomHtml(
      `<main><script>alert(1)</script><img src="x" onerror="alert(1)"><a href="java&#x0A;script:alert(1)">go</a><iframe srcdoc="x"></iframe>${WIDGET_PLACEHOLDER}</main>`
    )
    expect(output).not.toMatch(/<script|onerror|javascript:|<iframe|srcdoc/i)
    expect(output).toContain(WIDGET_PLACEHOLDER)
  })

  it('sanitizes active SVG payloads embedded in custom HTML', () => {
    const output = sanitizeUntrustedCustomHtml(
      `<svg><a xlink:href="javascript:alert(1)"><text>logo</text></a></svg>${WIDGET_PLACEHOLDER}`
    )
    expect(output).not.toMatch(/javascript:/i)
    expect(output).toContain(WIDGET_PLACEHOLDER)
  })

  it('keeps CSS lightbox markup but repairs brand logos to home links', () => {
    const output = sanitizeUntrustedCustomHtml(
      `<header><label class="img-lightbox"><input type="checkbox" class="lightbox-toggle" aria-label="Enlarge image"><img src="https://cdn.example/logo.png" alt="Logo"></label></header><main><label class="img-lightbox"><input type="checkbox" class="lightbox-toggle"><img src="https://cdn.example/work.jpg" alt="Work"></label>${WIDGET_PLACEHOLDER}</main>`
    )
    expect(output).toContain('work.jpg')
    expect(output).toMatch(/img-lightbox/)
    expect(output).toContain('logo.png')
    expect(output).toMatch(/href="\/"/)
    // Brand logo must not remain inside a lightbox.
    expect(output).not.toMatch(/header[\s\S]*img-lightbox[\s\S]*logo\.png/i)
  })
})
