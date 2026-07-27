import { describe, expect, it } from 'vitest'
import {
  activatePagesConfigForDraftPaths,
  applyPathAliasesToCustomConfig,
  assertFullRedesignPagesComplete,
  buildFullRedesignRequiredPaths,
  dropEmptyCustomPages,
  rewriteCustomPagePathAliases,
} from './fullRedesignPages'

describe('buildFullRedesignRequiredPaths', () => {
  it('includes inactive pages so nav targets can be activated on save', () => {
    expect(
      buildFullRedesignRequiredPaths([
        { slug: '/about', is_active: true },
        { slug: '/testimonials', is_active: false },
        { slug: 'services', is_active: true },
      ])
    ).toEqual(['/', '/about', '/testimonials', '/services'])
  })
})

describe('rewriteCustomPagePathAliases', () => {
  it('rewrites reviews and areas hrefs', () => {
    const html =
      '<a href="/reviews">Reviews</a><a href="/areas">Areas</a><a href="/portfolio">P</a>'
    expect(rewriteCustomPagePathAliases(html)).toBe(
      '<a href="/testimonials">Reviews</a><a href="/service-areas">Areas</a><a href="/portfolio">P</a>'
    )
  })
})

describe('dropEmptyCustomPages + assert', () => {
  const meat = `<main>${'Repair quality body work in Clarksville. '.repeat(6)}</main>`

  it('drops empty portfolio and asserts missing required paths', () => {
    const cfg = dropEmptyCustomPages({
      mode: 'inline',
      pages: {
        '/': { html: meat },
        '/about': { html: meat },
        '/portfolio': { html: '' },
      },
    })
    expect(Object.keys(cfg.pages).sort()).toEqual(['/', '/about'])
    expect(() =>
      assertFullRedesignPagesComplete(cfg, ['/', '/about', '/portfolio'])
    ).toThrow(/missing pages \[\/portfolio\]/i)
  })
})

describe('applyPathAliasesToCustomConfig', () => {
  it('rewrites aliases inside every page', () => {
    const out = applyPathAliasesToCustomConfig({
      mode: 'inline',
      pages: { '/': { html: '<a href="/reviews">R</a>' } },
    })
    expect(out.pages['/'].html).toContain('href="/testimonials"')
  })
})

describe('activatePagesConfigForDraftPaths', () => {
  it('reactivates drafted paths', () => {
    const next = activatePagesConfigForDraftPaths(
      [
        { slug: '/testimonials', is_active: false, title: 'Reviews' },
        { slug: '/faq', is_active: true, title: 'FAQ' },
      ],
      ['/', '/testimonials']
    ) as Array<{ slug: string; is_active: boolean }>
    expect(next[0].is_active).toBe(true)
    expect(next[1].is_active).toBe(true)
  })
})
