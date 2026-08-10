import { describe, expect, it } from 'vitest'
import { normalizeFacebookUrl, resolveResearchSources } from '@/lib/spec/research/sources'

describe('normalizeFacebookUrl', () => {
  it('preserves a numeric profile id and selects its About view', () => {
    expect(
      normalizeFacebookUrl(
        'https://www.facebook.com/profile.php?id=61590230650878&sk=about'
      )
    ).toBe('https://www.facebook.com/profile.php?id=61590230650878&sk=about')
  })

  it('adds the About selector to a numeric profile root', () => {
    expect(
      normalizeFacebookUrl('https://www.facebook.com/profile.php?id=61590230650878')
    ).toBe('https://www.facebook.com/profile.php?id=61590230650878&sk=about')
  })

  it('uses the About path for a vanity page', () => {
    expect(normalizeFacebookUrl('https://www.facebook.com/ccservices84/')).toBe(
      'https://www.facebook.com/ccservices84/about'
    )
  })

  it('leaves an existing vanity About URL unchanged', () => {
    expect(normalizeFacebookUrl('https://www.facebook.com/ccservices84/about')).toBe(
      'https://www.facebook.com/ccservices84/about'
    )
  })
})
describe('normalizeFacebookUrl — deep links', () => {
  it('reduces a video deep link to the page About tab', () => {
    // Observed on a real lead: appending /about to the full path produced
    // .../videos/1036687612587090/about, which was then shown to the admin as
    // the source link for every fact.
    expect(
      normalizeFacebookUrl('https://www.facebook.com/61590230650878/videos/1036687612587090/')
    ).toBe('https://www.facebook.com/61590230650878/about')
  })

  it('reduces post and photo deep links the same way', () => {
    expect(normalizeFacebookUrl('https://www.facebook.com/ccservices84/posts/12345')).toBe(
      'https://www.facebook.com/ccservices84/about'
    )
    expect(normalizeFacebookUrl('https://www.facebook.com/ccservices84/photos/a.1/2/')).toBe(
      'https://www.facebook.com/ccservices84/about'
    )
  })

  it('still handles a bare page root and leaves an About URL alone', () => {
    expect(normalizeFacebookUrl('https://www.facebook.com/ccservices84/')).toBe(
      'https://www.facebook.com/ccservices84/about'
    )
    const already = 'https://www.facebook.com/ccservices84/about'
    expect(normalizeFacebookUrl(already)).toBe(already)
  })
})

describe('resolveResearchSources — Yelp', () => {
  it('adds a canonical Yelp business page as a distinct source', () => {
    expect(
      resolveResearchSources({
        businessName: 'Peerless',
        phone: '+19315550199',
        yelpUrl: 'https://www.yelp.com/biz/peerless-pressure-softwash-clarksville',
      })
    ).toContainEqual({
      url: 'https://www.yelp.com/biz/peerless-pressure-softwash-clarksville',
      sourceKind: 'yelp_business',
      rationale: 'Current Yelp business details and public page prose',
    })
  })

  it('rejects Yelp search pages and does not label Yelp as Facebook', () => {
    expect(
      resolveResearchSources({
        businessName: 'Peerless',
        phone: '+19315550199',
        socialProfileUrl: 'https://www.yelp.com/biz/peerless-pressure-softwash-clarksville',
        yelpUrl: 'https://www.yelp.com/search?find_desc=pressure+washing',
      })
    ).toEqual([])
  })
})
