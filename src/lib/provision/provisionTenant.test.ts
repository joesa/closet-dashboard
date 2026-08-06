import { describe, it, expect } from 'vitest'
import { mergeCustomAddOnsWithDefaults } from './provisionTenant'

describe('mergeCustomAddOnsWithDefaults', () => {
  it('guarantees a non-empty, priced add-ons list when the AI produced none', () => {
    const result = mergeCustomAddOnsWithDefaults([], 'plumbing', ['Drain Cleaning', 'Emergency Plumbing'])
    expect(result.length).toBeGreaterThan(0)
    for (const addOn of result) {
      expect(addOn.name).toBeTruthy()
      expect(addOn.price).toBeGreaterThan(0)
    }
  })

  it('preserves AI/admin-supplied add-ons and their prices unchanged', () => {
    const result = mergeCustomAddOnsWithDefaults(
      [{ name: 'Rush service', price: 149 }],
      'plumbing',
      ['Drain Cleaning']
    )
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Rush service')
    expect(result[0].price).toBe(149)
  })

  it('backfills a real price for a supplied add-on missing one', () => {
    const result = mergeCustomAddOnsWithDefaults(
      [{ name: 'Rush service', price: 0 }],
      'plumbing',
      ['Drain Cleaning']
    )
    expect(result).toHaveLength(1)
    expect(result[0].price).toBeGreaterThan(0)
  })

  it('never fabricates add-ons on top of ones already supplied', () => {
    const result = mergeCustomAddOnsWithDefaults(
      [{ name: 'Rush service', price: 149 }],
      'plumbing',
      ['Drain Cleaning']
    )
    expect(result).toHaveLength(1)
  })
})
