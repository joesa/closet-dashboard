import { describe, expect, it } from 'vitest'
import {
  buildIntakeHintsForBrief,
  fallbackEnhancedBrief,
} from './enhanceFullRedesignBrief'

describe('fallbackEnhancedBrief', () => {
  it('honors a short admin seed in the signature and optimized brief', () => {
    const out = fallbackEnhancedBrief({
      brandName: 'Wehora Car Wash',
      adminBrief: 'clean and modern',
      hasImages: false,
      engagementLabel: 'quote calculator',
      services: ['Hand Wash', 'Wax'],
      city: 'Clarksville',
      region: 'TN',
    })
    expect(out.source).toBe('fallback')
    expect(out.signatureConcept).toMatch(/clean and modern/i)
    expect(out.optimizedBrief).toMatch(/ADMIN SEED/)
    expect(out.optimizedBrief).toMatch(/Hand Wash/)
    expect(out.avoidDefaults.length).toBeGreaterThan(2)
    expect(out.palette.some((p) => p.role === 'acc')).toBe(true)
  })

  it('invents from intake when the seed is empty', () => {
    const out = fallbackEnhancedBrief({
      brandName: 'Bay Detail',
      adminBrief: '',
      hasImages: true,
      engagementLabel: 'booking',
      services: ['PPF', 'Ceramic'],
      city: 'Nashville',
    })
    expect(out.optimizedBrief).toMatch(/Bay Detail/)
    expect(out.optimizedBrief).toMatch(/REFERENCE IMAGES/)
    expect(out.optimizedBrief).toMatch(/PPF/)
  })
})

describe('buildIntakeHintsForBrief', () => {
  it('compacts about/hero/page titles', () => {
    const hints = buildIntakeHintsForBrief({
      about: { headline: 'Family owned since forever' },
      hero: { headline: 'Spotless cars same day' },
      intakePages: [{ slug: 'services', title: 'Services' }],
    })
    expect(hints).toMatch(/Family owned/)
    expect(hints).toMatch(/Spotless cars/)
    expect(hints).toMatch(/services/)
  })
})
