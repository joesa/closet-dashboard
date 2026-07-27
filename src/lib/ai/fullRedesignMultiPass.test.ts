import { describe, expect, it } from 'vitest'
import {
  extractChromeSample,
  mergePageIntoDraft,
  passesDoneFromDraft,
  remainingFullRedesignPaths,
} from './fullRedesignMultiPass'

const meat = `<main>${'Quality collision repair in Clarksville Tennessee. '.repeat(5)}</main>`

describe('remainingFullRedesignPaths', () => {
  it('skips paths that already have usable HTML', () => {
    const draft = {
      mode: 'inline' as const,
      globalCss: ':root{}',
      pages: {
        '/': { html: meat },
        '/about': { html: meat },
        '/portfolio': { html: '' },
      },
    }
    expect(
      remainingFullRedesignPaths(['/', '/about', '/portfolio', '/contact'], draft)
    ).toEqual(['/portfolio', '/contact'])
  })
})

describe('mergePageIntoDraft + passesDone', () => {
  it('merges a page and reports done set', () => {
    let draft = mergePageIntoDraft(
      { mode: 'inline', pages: { '/': { html: meat } } },
      '/about',
      { html: meat },
      ':root{--a:1}'
    )
    expect(draft.globalCss).toContain('--a')
    expect(passesDoneFromDraft(['/', '/about', '/faq'], draft)).toEqual([
      '/',
      '/about',
    ])
  })
})

describe('extractChromeSample', () => {
  it('keeps header and footer snippets', () => {
    const html = `<header><a href="/">Home</a></header><main>x</main><footer>Call us</footer>`
    const sample = extractChromeSample(html)
    expect(sample).toContain('<header')
    expect(sample).toContain('<footer')
  })
})
