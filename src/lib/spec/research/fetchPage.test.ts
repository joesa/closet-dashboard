import { describe, expect, it } from 'vitest'
import { prosePortion } from '@/lib/spec/research/fetchPage'

/**
 * Observed on real pages: a Google Maps place URL scrapes to ~6,600 characters
 * that are entirely map-tile image URLs, and a login-walled Facebook page
 * scrapes to nav chrome. Both look like a healthy fetch if you only measure
 * length, and both cost a model call to be told there is nothing there.
 */
describe('prosePortion', () => {
  it('reduces a page of map tiles to nothing', () => {
    const tiles = Array.from(
      { length: 12 },
      () => '![](https://www.google.com/maps/vt/pb=!1m4!1m3!1i17!2i33758!3i51230!2m3!1e0!2sm)'
    ).join('')
    expect(prosePortion(tiles).length).toBeLessThan(20)
  })

  it('keeps link text while dropping the URLs around it', () => {
    expect(prosePortion('[Log in](https://facebook.com/login) to continue')).toBe(
      'Log in to continue'
    )
  })

  it('keeps genuine prose intact', () => {
    const about = 'We have run the same two crews out of Sango since 2011.'
    expect(prosePortion(about)).toBe(about)
  })

  it('strips bare URLs and table rules that inflate a length check', () => {
    expect(prosePortion('| --- | --- |\nSee https://example.com/x for details')).toBe(
      'See for details'
    )
  })
})
