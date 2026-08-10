import { describe, expect, it } from 'vitest'

import { normalizePublicProfileResearch } from '@/lib/spec/research/publicProfileResearch'

const TEXT = 'Peerless Pressure & SoftWash provides house washing, concrete cleaning, and soft washing for siding affected by algae and mildew in Clarksville.'

const value = (over: Record<string, unknown> = {}) => ({
  sourceUrl: 'https://www.facebook.com/profile.php?id=61590230650878',
  text: TEXT,
  capturedAt: '2026-08-09T00:00:00.000Z',
  captureMethod: 'public_browser',
  ...over,
})

describe('normalizePublicProfileResearch', () => {
  it('accepts minimized prose for the exact expected profile', () => {
    expect(
      normalizePublicProfileResearch(
        value(),
        'https://www.facebook.com/profile.php?id=61590230650878&sk=about'
      )
    ).toMatchObject({ text: TEXT, captureMethod: 'public_browser' })
  })

  it('rejects evidence from a different profile or platform', () => {
    expect(normalizePublicProfileResearch(value(), 'https://facebook.com/another-page')).toBeNull()
    expect(normalizePublicProfileResearch(value(), 'https://instagram.com/61590230650878')).toBeNull()
  })

  it('accepts the exact expected Yelp business and rejects a different listing', () => {
    const yelp = value({
      sourceUrl: 'https://www.yelp.com/biz/peerless-pressure-softwash-clarksville',
    })
    expect(
      normalizePublicProfileResearch(
        yelp,
        ['https://facebook.com/peerless', 'https://www.yelp.com/biz/peerless-pressure-softwash-clarksville']
      )
    ).not.toBeNull()
    expect(
      normalizePublicProfileResearch(yelp, 'https://www.yelp.com/biz/another-company')
    ).toBeNull()
  })

  it('rejects contact-bearing, oversized, insecure, and untrusted captures', () => {
    const expected = value().sourceUrl as string
    expect(normalizePublicProfileResearch(value({ text: `${TEXT} owner@example.com` }), expected)).toBeNull()
    expect(normalizePublicProfileResearch(value({ text: 'x'.repeat(12_001) }), expected)).toBeNull()
    expect(normalizePublicProfileResearch(value({ sourceUrl: 'http://facebook.com/61590230650878' }), expected)).toBeNull()
    expect(normalizePublicProfileResearch(value({ captureMethod: 'manual' }), expected)).toBeNull()
  })
})