import { describe, expect, it } from 'vitest'
import {
  findEmptyWidgetShells,
  htmlHasInjectableWidget,
  normalizeDuplicateHtmlIds,
  normalizeWidgetPlaceholders,
  sanitizeCustomConfig,
  sanitizeCustomCss,
  stripLiveWidgetsToPlaceholder,
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

describe('normalizeWidgetPlaceholders', () => {
  it('canonicalizes AI-mutated CLOSET_WIDGET comments in place', () => {
    const html = `<div class="widget-container"><!-- CLOSET_WIDGET theme="dark" --></div>`
    const out = normalizeWidgetPlaceholders(html)
    expect(out).toContain(WIDGET_PLACEHOLDER)
    expect(out).not.toMatch(/theme="dark"/)
    expect(htmlHasInjectableWidget(out)).toBe(true)
  })

  it('dedupes footer append when CTA already has a mutated placeholder', () => {
    const html = `
      <div class="widget-container"><!-- CLOSET_WIDGET theme="dark" --></div>
      <footer>x</footer>
      <section class="closet-widget-slot"><!-- CLOSET_WIDGET --></section>
    `
    const out = normalizeWidgetPlaceholders(html)
    expect(out.split(WIDGET_PLACEHOLDER)).toHaveLength(2) // one placeholder → 2 parts
    expect(out).not.toMatch(/closet-widget-slot/)
  })

  it('canonicalizes and dedupes literal widget tags', () => {
    const html = `
      <section><closet-quote-widget data-contractor-id="a"></closet-quote-widget></section>
      <section><closet-quote-widget data-contractor-id="a" /></section>
    `
    const out = normalizeWidgetPlaceholders(html)
    expect(out.split(WIDGET_PLACEHOLDER)).toHaveLength(2)
    expect(out).not.toMatch(/closet-quote-widget/)
  })
})

describe('normalizeDuplicateHtmlIds', () => {
  it('renames duplicate ids with stable suffixes', () => {
    const result = normalizeDuplicateHtmlIds(
      '<main><section id="about"></section><section id="about"></section><section id="about"></section></main>'
    )
    expect(result.duplicateIds).toEqual(['about'])
    expect(result.html).toContain('id="about"')
    expect(result.html).toContain('id="about--2"')
    expect(result.html).toContain('id="about--3"')
  })
})

describe('stripLiveWidgetsToPlaceholder', () => {
  it('replaces mounted widget tags and strips editor chrome', () => {
    const html = `<main><p contenteditable="true" class="eip-editing title">Hi</p><closet-quote-widget data-contractor-id="x"></closet-quote-widget></main>`
    const out = stripLiveWidgetsToPlaceholder(html)
    expect(out).toContain(WIDGET_PLACEHOLDER)
    expect(out).not.toMatch(/closet-quote-widget/)
    expect(out).not.toMatch(/contenteditable/)
    expect(out).not.toMatch(/eip-editing/)
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

  it('hard-fails when home has no widget mount', () => {
    const r = validateCustomConfig({
      mode: 'inline',
      pages: { '/': { html: `<main><h1>Hi</h1></main>` } },
    })
    expect(r.ok).toBe(false)
    expect(r.errors.some((e) => /missing a live engagement widget/i.test(e))).toBe(true)
  })

  it('hard-fails empty widget-container shells', () => {
    const r = validateCustomConfig({
      mode: 'inline',
      pages: {
        '/': {
          html: `<main><div class="widget-container"></div>${WIDGET_PLACEHOLDER}</main>`,
        },
      },
    })
    expect(r.ok).toBe(false)
    expect(r.errors.some((e) => /empty widget container/i.test(e))).toBe(true)
  })

  it('accepts mutated placeholder once normalized via sanitize', () => {
    const sanitized = sanitizeCustomConfig({
      mode: 'inline',
      pages: {
        '/': {
          html: `<div class="widget-container"><!-- CLOSET_WIDGET theme="dark" --></div>`,
        },
      },
    })
    const r = validateCustomConfig(sanitized)
    expect(r.ok).toBe(true)
    expect(findEmptyWidgetShells(sanitized.pages['/'].html)).toHaveLength(0)
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
