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
    expect(out.inventedFromIntake).toBe(false)
    expect(out.signatureConcept).toMatch(/clean and modern/i)
    expect(out.optimizedBrief).toMatch(/ADMIN SEED/)
    expect(out.optimizedBrief).toMatch(/Hand Wash/)
    expect(out.avoidDefaults.length).toBeGreaterThan(2)
    expect(out.palette.some((p) => p.role === 'acc')).toBe(true)
  })

  it('invents a full design-direction prompt from intake when the seed is empty', () => {
    const out = fallbackEnhancedBrief({
      brandName: 'Bay Detail',
      adminBrief: '',
      hasImages: true,
      engagementLabel: 'booking',
      services: ['PPF', 'Ceramic'],
      city: 'Nashville',
    })
    expect(out.inventedFromIntake).toBe(true)
    expect(out.optimizedBrief).toMatch(/Bay Detail/)
    expect(out.optimizedBrief).toMatch(/DESIGN DIRECTION/)
    expect(out.optimizedBrief).toMatch(/PROCESS/)
    expect(out.optimizedBrief).toMatch(/ANTI-AI SELF-CHECK/)
    expect(out.optimizedBrief).toMatch(/SELF-AUTHORED/)
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

  it('gives different businesses different palettes and type pairings', () => {
    const brands = [
      'Wehora Car Wash',
      'Ridgeline Closets',
      'Cypress Plumbing',
      'Fulton Roofing',
      'Bayside Cabinetry',
    ]
    const briefs = brands.map((brandName) =>
      fallbackEnhancedBrief({
        brandName,
        adminBrief: '',
        hasImages: false,
        engagementLabel: 'quote calculator',
        services: ['General'],
        city: 'Nashville',
      })
    )
    // This is the regression that matters: the old fallback returned one
    // hardcoded palette and one placeholder type pairing for every business.
    const accents = briefs.map((b) => b.palette.find((p) => p.role === 'acc')?.hex)
    expect(new Set(accents).size).toBeGreaterThan(1)
    const pairs = briefs.map((b) => `${b.typography.display}+${b.typography.body}`)
    expect(new Set(pairs).size).toBeGreaterThan(1)
  })

  it('names real Google Fonts instead of describing them', () => {
    const out = fallbackEnhancedBrief({
      brandName: 'Bay Detail',
      adminBrief: '',
      hasImages: false,
      engagementLabel: 'booking',
      services: ['PPF'],
    })
    expect(out.typography.display).not.toMatch(/choose|real Google Font/i)
    expect(out.typography.body).not.toMatch(/choose|real Google Font/i)
    expect(out.optimizedBrief).toContain(out.typography.display)
    expect(out.optimizedBrief).toContain(out.typography.body)
    expect(out.signatureElement).not.toMatch(/One trade-rooted chrome detail/i)
    expect(out.optimizedBrief).toContain(out.signatureElement)
  })

  it('steers around palettes and type pairings already taken', () => {
    const base = fallbackEnhancedBrief({
      brandName: 'Ridgeline Closets',
      adminBrief: '',
      hasImages: false,
      engagementLabel: 'quote calculator',
      services: ['Closets'],
    })
    const takenPair = `${base.typography.display}+${base.typography.body}`.toLowerCase()
    const steered = fallbackEnhancedBrief({
      brandName: 'Ridgeline Closets',
      adminBrief: '',
      hasImages: false,
      engagementLabel: 'quote calculator',
      services: ['Closets'],
      avoid: {
        taken: [],
        takenSkeletonKeys: [],
        takenPaletteKeys: [],
        takenFontKeys: [takenPair],
        promptBlock: '',
      },
    })
    expect(
      `${steered.typography.display}+${steered.typography.body}`.toLowerCase()
    ).not.toBe(takenPair)
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
