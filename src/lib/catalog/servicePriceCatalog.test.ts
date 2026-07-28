import { describe, it, expect } from 'vitest'
import {
  resolveServiceTiers,
  lookupServicePriceEntry,
  formatServiceSeedPricing,
} from './servicePriceCatalog'

describe('servicePriceCatalog', () => {
  it('returns distinct auto-body ranges by service', () => {
    const wrap = resolveServiceTiers('Auto Wrapping', 'auto-body')
    const pdr = resolveServiceTiers('Paintless Dent Repair (PDR)', 'auto-body')
    expect(wrap.standard).toBeGreaterThan(2000)
    expect(pdr.standard).toBeLessThan(500)
    expect(wrap.standard).not.toBe(pdr.standard)
  })

  it('matches fuzzy labels via matchServiceDef', () => {
    const entry = lookupServicePriceEntry('vehicle wrap', 'auto-body')
    expect(entry?.standard).toBe(3250)
  })

  it('falls back for unknown services without throwing', () => {
    const t = resolveServiceTiers('Exotic Widget Polishing', 'plumbing')
    expect(t.standard).toBeGreaterThan(0)
    expect(t.basic + t.standard + t.premium).toBeGreaterThan(0)
  })

  it('formats seed lines for the AI prompt', () => {
    const seed = formatServiceSeedPricing(['Drain Cleaning', 'Emergency Plumbing'], 'plumbing')
    expect(seed).toContain('Drain Cleaning')
    expect(seed).toContain('$')
  })
})
