import { describe, expect, it } from 'vitest'
import {
  buildIntakeHintsForBrief,
  fallbackEnhancedBrief,
  lockAdminSeedInBrief,
  normalizeEnhanced,
} from './enhanceFullRedesignBrief'
import { isDarkSurface, validateFullRedesignPreflight } from './fullRedesignDesignSystem'
import { paletteFingerprintKey } from '@/lib/design/customDesignFingerprint'

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

  it('locks verbatim user input into a reviewed brief without duplicating it', () => {
    const seed = 'Use cobalt blue, a diagonal image wall, and add ceramic coating.'
    const base = fallbackEnhancedBrief({
      brandName: 'Bay Detail',
      adminBrief: seed,
      hasImages: false,
      engagementLabel: 'booking',
      services: ['PPF'],
    })
    const once = lockAdminSeedInBrief(base, seed)
    const twice = lockAdminSeedInBrief(once, seed)
    expect(twice.optimizedBrief).toContain(`NON-OVERRIDABLE ADMIN INPUT (verbatim):\n${seed}`)
    expect(twice.optimizedBrief.match(/NON-OVERRIDABLE ADMIN INPUT/g)).toHaveLength(1)
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
    const takenPalette = paletteFingerprintKey(base.palette)
    const steered = fallbackEnhancedBrief({
      brandName: 'Ridgeline Closets',
      adminBrief: '',
      hasImages: false,
      engagementLabel: 'quote calculator',
      services: ['Closets'],
      avoid: {
        taken: [],
        takenSkeletonKeys: [],
        takenPaletteKeys: [takenPalette],
        takenFontKeys: [takenPair],
        promptBlock: '',
      },
    })
    expect(
      `${steered.typography.display}+${steered.typography.body}`.toLowerCase()
    ).not.toBe(takenPair)
    expect(paletteFingerprintKey(steered.palette)).not.toBe(takenPalette)
    expect(steered.designSystem.composition).not.toBe(base.designSystem.composition)
    expect(steered.signatureElement).not.toBe(base.signatureElement)
  })

  it('regenerates a deterministic signature when the prior concept is taken', () => {
    const original = fallbackEnhancedBrief({
      brandName: 'Ridgeline Closets',
      adminBrief: '',
      hasImages: false,
      engagementLabel: 'quote calculator',
      services: ['Closets'],
      city: 'Nashville',
    })
    const regenerated = fallbackEnhancedBrief({
      brandName: 'Ridgeline Closets',
      adminBrief: '',
      hasImages: false,
      engagementLabel: 'quote calculator',
      services: ['Closets'],
      city: 'Nashville',
      avoid: {
        taken: [{
          tenantId: 'same-tenant',
          fingerprint: {
            version: 1,
            hash: 'prior',
            skeleton: [],
            paletteBuckets: [],
            fonts: { display: '', body: '' },
            shape: '',
            motifs: [],
          },
          signatureConcept: original.signatureConcept,
        }],
        takenSkeletonKeys: [],
        takenPaletteKeys: [],
        takenFontKeys: [],
        promptBlock: '',
      },
    })
    expect(regenerated.signatureConcept).not.toBe(original.signatureConcept)
    expect(validateFullRedesignPreflight(
      regenerated,
      [],
      [original.signatureConcept]
    )).toEqual([])
  })

  it('builds a complete design system that passes preflight before generation', () => {
    const out = fallbackEnhancedBrief({
      brandName: 'Ridgeline Closets',
      adminBrief: '',
      hasImages: false,
      engagementLabel: 'quote calculator',
      services: ['Walk-in Closets', 'Garage Storage'],
      city: 'Nashville',
    })
    expect(validateFullRedesignPreflight(out)).toEqual([])
    expect(out.designSystem.copyVocabulary.use).toContain('Walk-in Closets')
    expect(out.designSystem.validation.antiAiPassed).toBe(true)
  })

  it('blocks unresolved, reused, or self-rejected systems', () => {
    const out = fallbackEnhancedBrief({
      brandName: 'Ridgeline Closets',
      adminBrief: '',
      hasImages: false,
      engagementLabel: 'quote calculator',
      services: ['Closets'],
    })
    const rejected = {
      ...out,
      typography: { display: 'Inter', body: 'Roboto', why: 'habit' },
      designSystem: {
        ...out.designSystem,
        imagery: '',
        validation: { ...out.designSystem.validation, noveltyPassed: false },
      },
    }
    expect(validateFullRedesignPreflight(rejected)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/banned habitual AI font/),
        expect.stringMatching(/imagery is unresolved/),
        expect.stringMatching(/unresolved failed check/),
      ])
    )
  })
})

describe('normalizeEnhanced collision handling', () => {
  const opts = {
    brandName: "Alvarado's Tile Installations",
    adminBrief: '',
    hasImages: false,
    engagementLabel: 'quote calculator',
    services: ['Tile & Grout Cleaning', 'Grout Sealing'],
    city: 'Clarksville',
  }

  const modelBrief = {
    signatureConcept: 'A running-bond tile field grouted, not gridded',
    materialWorld: 'Porcelain, travertine, sanded grout gone tan in traffic lanes',
    palette: [
      { role: 'bg', hex: '#edf2f0', use: 'page field' },
      { role: 'ink', hex: '#14201e', use: 'type' },
      { role: 'muted', hex: '#5a6b67', use: 'sub-labels' },
      { role: 'line', hex: '#ccd6d2', use: 'grout joints' },
      { role: 'acc', hex: '#0d6f5f', use: 'CTAs' },
    ],
    typography: { display: 'Bricolage Grotesque', body: 'Figtree', why: 'cut like tile' },
    signatureElement: 'Grout joints as layout gutters',
    copyRegister: 'A Clarksville tile-cleaning owner on the phone',
    servicesToAdd: [],
    avoidDefaults: ['cream + serif + terracotta'],
    designSystem: {
      composition: 'Tessellated running-bond mosaic on a 12px joint bed',
      colorStrategy: 'Two-state logic: cleaned vs before',
      typeSystem: 'Bricolage 600 display, Figtree 400 body',
      spacingAndGrid: 'Grout joint constant of 12px is the only gutter',
      shapeAndDepth: '3px cushion radius, inset shadow only',
      imagery: 'Flat-lit floor photography shot down at the grout line',
      components: 'Service tiles carry a surface chip row',
      motion: 'A sealer-sheen sweep across one tile',
      responsive: 'Offset preserved on alternating rows at tablet',
      copyVocabulary: { use: ['grout joint', 'color-seal'], reject: ['elevate', 'seamless'] },
      validation: {
        antiAiPassed: true,
        noveltyPassed: true,
        coherencePassed: true,
        accessibilityPassed: true,
        factualPassed: true,
        rationale: 'Every axis derives from tile and grout work rather than a house style.',
      },
    },
    optimizedBrief: '1. DESIGN DIRECTION — Build the site as a grouted tile field, not a card grid.',
  }

  it('keeps the model direction when a palette bucket collides, replacing only colour', () => {
    const takenPalette = paletteFingerprintKey(modelBrief.palette)
    const out = normalizeEnhanced(
      modelBrief,
      {
        ...opts,
        avoid: {
          taken: [],
          takenSkeletonKeys: [],
          takenPaletteKeys: [takenPalette],
          takenFontKeys: [],
          promptBlock: '',
        },
      },
      'anthropic'
    )
    // Colour axis is replaced…
    expect(paletteFingerprintKey(out.palette)).not.toBe(takenPalette)
    // …and everything else the model authored survives.
    expect(out.designSystem.composition).toBe(modelBrief.designSystem.composition)
    expect(out.designSystem.imagery).toBe(modelBrief.designSystem.imagery)
    expect(out.designSystem.motion).toBe(modelBrief.designSystem.motion)
    expect(out.signatureElement).toBe(modelBrief.signatureElement)
    expect(out.typography.display).toBe('Bricolage Grotesque')
    expect(out.optimizedBrief).toMatch(/COLLISION OVERRIDE/)
    expect(out.optimizedBrief).toMatch(/PALETTE \(replaces/)
    expect(out.optimizedBrief).not.toMatch(/TYPE \(replaces/)
  })

  it('replaces only the type axis when the pairing collides', () => {
    const out = normalizeEnhanced(
      modelBrief,
      {
        ...opts,
        avoid: {
          taken: [],
          takenSkeletonKeys: [],
          takenPaletteKeys: [],
          takenFontKeys: ['bricolage grotesque+figtree'],
          promptBlock: '',
        },
      },
      'anthropic'
    )
    expect(`${out.typography.display}+${out.typography.body}`.toLowerCase()).not.toBe(
      'bricolage grotesque+figtree'
    )
    expect(out.palette.map((p) => p.hex)).toEqual(modelBrief.palette.map((p) => p.hex))
    expect(out.designSystem.composition).toBe(modelBrief.designSystem.composition)
    expect(out.optimizedBrief).toMatch(/TYPE \(replaces/)
    expect(out.optimizedBrief).not.toMatch(/PALETTE \(replaces/)
  })

  it('leaves the brief untouched when nothing collides', () => {
    const out = normalizeEnhanced(modelBrief, { ...opts, avoid: null }, 'anthropic')
    expect(out.designSystem.composition).toBe(modelBrief.designSystem.composition)
    expect(out.optimizedBrief).not.toMatch(/COLLISION OVERRIDE/)
  })
})

describe('fallback brief surface note', () => {
  it('never tells the builder to prefer light surfaces on a dark palette', () => {
    // Every deterministic direction the seed can pick, across many businesses.
    for (let n = 0; n < 40; n += 1) {
      const out = fallbackEnhancedBrief({
        brandName: `Business ${n}`,
        adminBrief: '',
        hasImages: false,
        engagementLabel: 'quote calculator',
        services: ['Cleaning'],
        city: 'Clarksville',
      })
      const background = out.palette.find((p) => p.role === 'bg')?.hex ?? ''
      if (isDarkSurface(background)) {
        expect(out.optimizedBrief).not.toMatch(/Prefer light\/mid surfaces/)
        expect(out.optimizedBrief).toMatch(/deliberate dark-surface direction/)
      } else {
        expect(out.optimizedBrief).toMatch(/Hold these light\/mid surfaces/)
      }
    }
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
