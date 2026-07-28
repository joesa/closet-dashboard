import { describe, it, expect } from 'vitest'
import {
  roomIsUnpriced,
  assertOfferedServicesPriced,
  UnpricedServicesError,
} from './pricingGuard'

describe('pricingGuard', () => {
  it('treats all-zero as unpriced', () => {
    expect(roomIsUnpriced({ name: 'A', basic: 0, standard: 0, premium: 0 })).toBe(true)
  })

  it('allows flat_tiered basic=0 with priced standard', () => {
    expect(roomIsUnpriced({ name: 'A', basic: 0, standard: 249, premium: 485 })).toBe(false)
  })

  it('reads price_* column aliases', () => {
    expect(
      roomIsUnpriced({ name: 'A', price_basic: 0, price_standard: 0, price_premium: 0 })
    ).toBe(true)
    expect(
      roomIsUnpriced({ name: 'A', price_basic: 0, price_standard: 100, price_premium: 0 })
    ).toBe(false)
  })

  it('assertOfferedServicesPriced throws with service names', () => {
    expect(() =>
      assertOfferedServicesPriced([
        { name: 'Wrap', basic: 0, standard: 0, premium: 0 },
        { name: 'Detail', basic: 100, standard: 200, premium: 300 },
      ])
    ).toThrow(UnpricedServicesError)

    try {
      assertOfferedServicesPriced([{ name: 'Wrap', basic: 0, standard: 0, premium: 0 }])
    } catch (e) {
      expect(e).toBeInstanceOf(UnpricedServicesError)
      expect((e as UnpricedServicesError).unpricedNames).toEqual(['Wrap'])
    }
  })

  it('assertOfferedServicesPriced passes when all priced', () => {
    expect(() =>
      assertOfferedServicesPriced([
        { name: 'A', basic: 0, standard: 100, premium: 200 },
        { name: 'B', basic: 50, standard: 75, premium: 100 },
      ])
    ).not.toThrow()
  })
})
