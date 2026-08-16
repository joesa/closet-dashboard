import { describe, expect, it } from 'vitest'
import {
  MAX_SET_HTML,
  applyOpsToConfig,
  applyOpsToHtml,
  applyOpsToPages,
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

describe('editCss — changing css that already exists', () => {
  const base = {
    globalCss: '.idx{counter-reset:service}\n.idx li{counter-increment:service;margin-bottom:.55rem}\n.step::before{content:"0" counter(step)}',
    pages: { '/': { html: '<main><p>Hello</p></main>' } },
  } as never

  it('deletes a declaration with an empty replace', () => {
    const { ops, errors } = parseSurgicalOps([
      { op: 'editCss', find: 'counter-increment:service;', replace: '' },
    ])
    expect(errors).toEqual([])
    const result = applyOpsToConfig(base, ops)
    expect(result.globalCssChanged).toBe(true)
    expect(result.config.globalCss).not.toContain('counter-increment:service')
    // Neighbouring declarations in the same rule survive.
    expect(result.config.globalCss).toContain('margin-bottom:.55rem')
    expect(result.hits).toBeGreaterThan(0)
  })

  it('replaces every occurrence, since a declaration usually repeats', () => {
    const css = '.a{color:red}.b{color:red}.c{color:red}'
    const { ops } = parseSurgicalOps([{ op: 'editCss', find: 'color:red', replace: 'color:blue' }])
    const result = applyOpsToConfig({ ...base, globalCss: css } as never, ops)
    expect(result.config.globalCss).toBe('.a{color:blue}.b{color:blue}.c{color:blue}')
    expect(result.hits).toBe(3)
  })

  it('reports an unmatched find instead of silently doing nothing', () => {
    const { ops } = parseSurgicalOps([
      { op: 'editCss', find: 'not-in-the-sheet:1px', replace: '' },
    ])
    const result = applyOpsToConfig(base, ops)
    expect(result.unmatchedCssEdits).toEqual(['not-in-the-sheet:1px'])
    expect(result.globalCssChanged).toBe(false)
    // This is the bug that made a failed removal look like a success.
    expect(result.hits).toBe(0)
  })

  it('applies edits in sequence so a later find sees the earlier result', () => {
    const { ops } = parseSurgicalOps([
      { op: 'editCss', find: 'counter-reset:service', replace: 'counter-reset:x' },
      { op: 'editCss', find: 'counter-reset:x', replace: '' },
    ])
    const result = applyOpsToConfig(base, ops)
    expect(result.config.globalCss).not.toContain('counter-reset')
  })

  it('rejects a missing replace rather than writing "undefined" into the sheet', () => {
    const { ops, errors } = parseSurgicalOps([{ op: 'editCss', find: 'color:red' }])
    expect(ops).toHaveLength(0)
    expect(errors.join(' ')).toMatch(/replace string/)
  })

  it('still accepts appendCss for additive rules', () => {
    const { ops } = parseSurgicalOps([{ op: 'appendCss', css: '.new{color:blue}' }])
    const result = applyOpsToConfig(base, ops)
    expect(result.globalCssAppend).toContain('.new')
    expect(result.globalCssChanged).toBe(false)
  })
})
