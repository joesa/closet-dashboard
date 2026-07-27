import { describe, expect, it } from 'vitest'
import {
  applyOpsToHtml,
  applyOpsToPages,
  MAX_SET_HTML,
  parseSurgicalOps,
} from './surgicalDomOps'

describe('parseSurgicalOps', () => {
  it('accepts a closed allowlist of ops', () => {
    const { ops, errors } = parseSurgicalOps([
      { op: 'replaceText', find: 'Old', replace: 'New' },
      { op: 'setAttr', selector: 'a.cta', attr: 'href', value: '/contact' },
    ])
    expect(errors).toEqual([])
    expect(ops).toHaveLength(2)
  })

  it('rejects unknown ops and oversized setHtml', () => {
    const unknown = parseSurgicalOps([{ op: 'deleteNode', selector: 'div' }])
    expect(unknown.ops).toHaveLength(0)
    expect(unknown.errors.some((e) => /unknown op/i.test(e))).toBe(true)

    const huge = parseSurgicalOps([
      { op: 'setHtml', selector: 'h1', html: 'x'.repeat(MAX_SET_HTML + 1) },
    ])
    expect(huge.ops).toHaveLength(0)
    expect(huge.errors.some((e) => /setHtml/i.test(e))).toBe(true)
  })

  it('rejects non-arrays and empty lists', () => {
    expect(parseSurgicalOps(null).errors.length).toBeGreaterThan(0)
    expect(parseSurgicalOps([]).errors.some((e) => /empty/i.test(e))).toBe(true)
  })
})

describe('applyOpsToHtml', () => {
  it('replaceText updates text nodes case-insensitively', () => {
    const { html, hits } = applyOpsToHtml(
      '<section><h1>Welcome to Acme</h1><p>ACME rocks</p></section>',
      [{ op: 'replaceText', find: 'Acme', replace: 'Acme Pros' }]
    )
    expect(hits).toBeGreaterThanOrEqual(2)
    expect(html).toContain('Welcome to Acme Pros')
    expect(html).toContain('Acme Pros rocks')
  })

  it('setAttr updates matching nodes', () => {
    const { html, hits } = applyOpsToHtml(
      '<a class="cta" href="/old">Go</a>',
      [{ op: 'setAttr', selector: 'a.cta', attr: 'href', value: '/contact' }]
    )
    expect(hits).toBe(1)
    expect(html).toContain('href="/contact"')
  })

  it('appendCss does not mutate html hits via applyOpsToHtml alone', () => {
    const { html, hits } = applyOpsToHtml('<p>Hi</p>', [
      { op: 'appendCss', css: '.x{color:red}' },
    ])
    expect(html).toContain('<p>Hi</p>')
    expect(hits).toBe(0)
  })

  it('reports zero hits when find misses', () => {
    const { hits } = applyOpsToHtml('<p>Hello</p>', [
      { op: 'replaceText', find: 'Nope', replace: 'Yes' },
    ])
    expect(hits).toBe(0)
  })
})

describe('applyOpsToPages', () => {
  it('aggregates hits and changed pages', () => {
    const result = applyOpsToPages(
      {
        '/': { html: '<h1>Acme</h1>' },
        '/about': { html: '<p>About Acme</p>' },
      },
      [{ op: 'replaceText', find: 'Acme', replace: 'Beta' }]
    )
    expect(result.hits).toBe(2)
    expect(result.changedPages.sort()).toEqual(['/', '/about'])
    expect(result.pages['/']!.html).toContain('Beta')
    expect(result.globalCssAppend).toBeNull()
  })

  it('collects appendCss separately', () => {
    const result = applyOpsToPages(
      { '/': { html: '<p>x</p>' } },
      [{ op: 'appendCss', css: '.clickable-card{cursor:pointer}' }]
    )
    expect(result.globalCssAppend).toContain('.clickable-card')
    expect(result.hits).toBe(1)
  })
})
