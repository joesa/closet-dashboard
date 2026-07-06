import { describe, it, expect } from 'vitest'
import { computeQuote } from './pricing'

describe('computeQuote', () => {
  it('computes base cost from perFoot * linearFeet with no add-ons', () => {
    const q = computeQuote({ perFoot: 65, linearFeet: 20 })
    expect(q.baseCost).toBe(1300)
    expect(q.addOnCost).toBe(0)
    expect(q.expandedAddOns).toEqual([])
    expect(q.estimatedTotal).toBe(1300)
  })

  it('returns a +/-15% range rounded to cents', () => {
    const q = computeQuote({ perFoot: 45, linearFeet: 10 }) // total 450
    expect(q.estimatedTotal).toBe(450)
    expect(q.range.low).toBe(382.5) // 450 * 0.85
    expect(q.range.high).toBe(517.5) // 450 * 1.15
  })

  it('adds selected add-on cost using the catalog price * quantity', () => {
    const q = computeQuote({
      perFoot: 50,
      linearFeet: 10, // base 500
      requestedAddOns: [
        { id: 'drawer', quantity: 3 },
        { id: 'shoe', quantity: 2 },
      ],
      addOnCatalog: [
        { id: 'drawer', name: 'Drawer', price: 75 },
        { id: 'shoe', name: 'Shoe Rack', price: 40 },
      ],
    })
    expect(q.addOnCost).toBe(305) // 3*75 + 2*40
    expect(q.estimatedTotal).toBe(805)
    expect(q.expandedAddOns).toHaveLength(2)
    expect(q.expandedAddOns[0]).toEqual({
      id: 'drawer',
      name: 'Drawer',
      quantity: 3,
      price: 75,
    })
  })

  it('ignores requested add-ons that are not in the catalog', () => {
    const q = computeQuote({
      perFoot: 10,
      linearFeet: 1, // base 10
      requestedAddOns: [{ id: 'ghost', quantity: 5 }],
      addOnCatalog: [{ id: 'drawer', name: 'Drawer', price: 75 }],
    })
    expect(q.addOnCost).toBe(0)
    expect(q.expandedAddOns).toEqual([])
    expect(q.estimatedTotal).toBe(10)
  })

  it('coerces string catalog prices to numbers', () => {
    const q = computeQuote({
      perFoot: 0,
      linearFeet: 0,
      requestedAddOns: [{ id: 'a', quantity: 2 }],
      addOnCatalog: [{ id: 'a', name: 'A', price: '12.5' }],
    })
    expect(q.addOnCost).toBe(25)
  })

  it('treats missing/invalid numbers as zero instead of NaN', () => {
    const q = computeQuote({
      perFoot: Number('not-a-number'),
      linearFeet: 20,
    })
    expect(q.baseCost).toBe(0)
    expect(q.estimatedTotal).toBe(0)
    expect(Number.isNaN(q.range.low)).toBe(false)
  })
})

describe('computeQuote pricing models', () => {
  it('per_unit (default) multiplies rate by quantity via generic params', () => {
    const q = computeQuote({ pricingModel: 'per_unit', ratePerUnit: 12, quantity: 5 })
    expect(q.baseCost).toBe(60)
    expect(q.estimatedTotal).toBe(60)
  })

  it('flat_tiered uses the tier rate as a flat job price (quantity ignored)', () => {
    const q = computeQuote({ pricingModel: 'flat_tiered', ratePerUnit: 350, quantity: 99 })
    expect(q.baseCost).toBe(350)
    expect(q.estimatedTotal).toBe(350)
  })

  it('base_plus_distance adds a hookup fee to rate * distance', () => {
    const q = computeQuote({
      pricingModel: 'base_plus_distance',
      baseFee: 75,
      ratePerUnit: 4,
      quantity: 10,
    })
    expect(q.baseCost).toBe(115)
    expect(q.estimatedTotal).toBe(115)
  })

  it('flat_tiered still layers add-on costs on top of the flat base', () => {
    const q = computeQuote({
      pricingModel: 'flat_tiered',
      ratePerUnit: 200,
      requestedAddOns: [{ id: 'permit', quantity: 1 }],
      addOnCatalog: [{ id: 'permit', name: 'Permit', price: 50 }],
    })
    expect(q.baseCost).toBe(200)
    expect(q.addOnCost).toBe(50)
    expect(q.estimatedTotal).toBe(250)
  })
})
