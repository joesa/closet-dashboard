import { describe, expect, it } from 'vitest'
import {
  sanitizeCustomConfig,
  sanitizeCustomCss,
  validateCustomConfig,
  WIDGET_PLACEHOLDER,
} from './customSite'

describe('sanitizeCustomConfig', () => {
  it('normalizes paths and strips dangerous CSS', () => {
    const out = sanitizeCustomConfig({
      mode: 'inline',
      globalCss: "@import 'x.css'; body { color: red; }",
      pages: {
        about: {
          html: `<h1>About</h1>${WIDGET_PLACEHOLDER}`,
          css: 'h1 { color: blue; }',
          title: 'About',
        },
      },
    })
    expect(out.pages['/about']).toBeTruthy()
    expect(out.globalCss).not.toMatch(/@import/i)
    expect(out.mode).toBe('inline')
  })
})

describe('validateCustomConfig', () => {
  it('passes a minimal valid draft with widget placeholder', () => {
    const r = validateCustomConfig({
      mode: 'inline',
      pages: { '/': { html: `<main>${WIDGET_PLACEHOLDER}</main>` } },
    })
    expect(r.ok).toBe(true)
    expect(r.errors).toHaveLength(0)
  })

  it('rejects javascript: urls', () => {
    const r = validateCustomConfig({
      mode: 'inline',
      pages: { '/': { html: `<a href="javascript:alert(1)">x</a>${WIDGET_PLACEHOLDER}` } },
    })
    expect(r.ok).toBe(false)
  })
})

describe('sanitizeCustomCss', () => {
  it('neutralizes expression()', () => {
    expect(sanitizeCustomCss('div { width: expression(alert(1)); }')).not.toMatch(/expression\s*\(/i)
  })
})
