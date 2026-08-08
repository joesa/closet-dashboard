import { describe, expect, it } from 'vitest'

import { normalizeScraperControlConfig } from './scraper-control'

describe('normalizeScraperControlConfig', () => {
  it('normalizes no-website lead filters and location radius', () => {
    const config = normalizeScraperControlConfig({
      targetLocations: ['37040', 'Clarksville TN'],
      noWebsiteOnly: 'true',
      phoneRequired: true,
      requireCategoryMatch: 'yes',
      minRating: '4.6',
      minReviewCount: '25',
      searchRadiusMiles: '30',
    })

    expect(config).toMatchObject({
      targetLocations: ['37040', 'Clarksville TN'],
      noWebsiteOnly: true,
      phoneRequired: true,
      requireCategoryMatch: true,
      minRating: 4.6,
      minReviewCount: 25,
      searchRadiusMiles: 30,
    })
  })

  it('clamps unsafe or excessive numeric settings', () => {
    const config = normalizeScraperControlConfig({
      minRating: 99,
      minReviewCount: -2,
      searchRadiusMiles: 500,
    })
    expect(config.minRating).toBe(5)
    expect(config.minReviewCount).toBe(0)
    expect(config.searchRadiusMiles).toBe(100)
  })
})
