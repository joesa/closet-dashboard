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
