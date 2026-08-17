import { describe, expect, it } from 'vitest'
import { INDUSTRIES } from '@/lib/catalog/industries/index'
import {
  collectThemeLayoutPools,
  INDUSTRY_CONFIGS,
  isLowConfidenceResolution,
  listIndustries,
  matchServiceDef,
  resolveIndustrySlug,
} from '@/lib/catalog/serviceCatalog'

describe('multi-industry service catalog', () => {
  it('registers 11 industries with services', () => {
    expect(INDUSTRIES.length).toBeGreaterThanOrEqual(10)
    // listIndustries() is the pickable set — it excludes 'generic-trade', which
    // is deliberately serviceless (see industries/generic-trade.ts).
    for (const ind of listIndustries()) {
      expect(ind.services.length).toBeGreaterThanOrEqual(1)
      expect(ind.defaultThemes.length).toBeGreaterThanOrEqual(3)
      expect(ind.defaultLayouts.length).toBeGreaterThanOrEqual(3)
    }
  })

  describe('the zero-signal fallback', () => {
    it('lands an unrecognised trade on generic-trade, not on closets', () => {
      expect(resolveIndustrySlug({ industry: 'Publishing house' })).toBe('generic-trade')
      expect(resolveIndustrySlug({ industry: 'Talent agency' })).toBe('generic-trade')
      expect(resolveIndustrySlug({})).toBe('generic-trade')
    })

    it('quotes that trade in neutral units rather than linear feet of closet', () => {
      const config = INDUSTRY_CONFIGS[resolveIndustrySlug({ industry: 'Publishing house' })]
      expect(config.unitLabel).toBe('Project Scope')
      expect(config.tierLabel).toBe('Package')
    })

    it('keeps generic-trade unpickable and unmatchable by text', () => {
      expect(listIndustries().some((i) => i.slug === 'generic-trade')).toBe(false)
      // Reached only as the default, never scored into: even text that reads
      // like its own label stays low-confidence, so the callers that branch on
      // that signal (theme synthesis, the custom-industry lookup) still fire.
      expect(isLowConfidenceResolution({ industry: 'general trade' })).toBe(true)
      expect(resolveIndustrySlug({ industry: 'General Trade' })).toBe('generic-trade')
    })
  })

  it('fuzzy-matches plumbing services from free text', () => {
    expect(matchServiceDef('drain cleaning')?.industry).toBe('plumbing')
    expect(matchServiceDef('water heater install')?.label).toContain('Water Heater')
  })

  it('resolves industry from trade label', () => {
    expect(resolveIndustrySlug({ industry: 'Plumbing' })).toBe('plumbing')
    expect(resolveIndustrySlug({ industry: 'HVAC repair' })).toBe('hvac')
    expect(resolveIndustrySlug({ services: ['Light-Duty Towing', 'Roadside Assistance'] })).toBe(
      'towing'
    )
  })

  it('builds theme/layout pools for non-closet services', () => {
    const pools = collectThemeLayoutPools({
      industry: 'Plumbing',
      services: ['Drain Cleaning', 'Emergency Plumbing'],
    })
    expect(pools.industry).toBe('plumbing')
    expect(pools.themes.length).toBeGreaterThan(0)
    expect(pools.layouts).toContain('minimalist-lead')
  })
})
