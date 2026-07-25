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

  it('extracts wrapping from a meta redesign seed into servicesToAdd', () => {
    const out = fallbackEnhancedBrief({
      brandName: 'Wehora',
      adminBrief:
        'Provide a detail prompt for a build a bespoke website for a car wrapping and other car maintenance services such as changing brakes, rotters, oil, filters, engine fixes, etc.',
      hasImages: false,
      engagementLabel: 'quote calculator',
      services: ['Mobile Auto Detailing', 'Oil Change & Maintenance'],
    })
    expect(out.servicesToAdd).toContain('Vehicle Wrapping')
    expect(out.optimizedBrief).toMatch(/REQUIRED SERVICE ADDS/i)
    expect(out.optimizedBrief).toMatch(/Vehicle Wrapping/)
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
