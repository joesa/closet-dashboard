import { describe, expect, it } from 'vitest'
import { INDUSTRIES } from '@/lib/catalog/industries/index'
import {
  collectThemeLayoutPools,
  matchServiceDef,
  resolveIndustrySlug,
} from '@/lib/catalog/serviceCatalog'

describe('multi-industry service catalog', () => {
  it('registers 11 industries with services', () => {
    expect(INDUSTRIES.length).toBeGreaterThanOrEqual(10)
    for (const ind of INDUSTRIES) {
      expect(ind.services.length).toBeGreaterThanOrEqual(8)
      expect(ind.defaultThemes.length).toBeGreaterThanOrEqual(3)
      expect(ind.defaultLayouts.length).toBeGreaterThanOrEqual(3)
    }
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
