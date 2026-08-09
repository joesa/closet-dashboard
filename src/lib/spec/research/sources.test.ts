import { describe, expect, it } from 'vitest'
import { normalizeFacebookUrl } from '@/lib/spec/research/sources'

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