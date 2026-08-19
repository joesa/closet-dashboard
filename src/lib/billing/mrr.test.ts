import { describe, expect, it } from 'vitest'
import type Stripe from 'stripe'
import { computeMrr, monthlyCentsForSubscription } from './mrr'

/**
 * The old admin figure multiplied a count of `subscription_plan` values by
 * today's list price. These cases are the ones that arithmetic got wrong.
 */

type Item = {
  unit_amount: number | null
  interval?: 'day' | 'week' | 'month' | 'year'
  interval_count?: number
  quantity?: number
  currency?: string
}

function sub(items: Item[], extra: Partial<Stripe.Subscription> = {}): Stripe.Subscription {
  return {
    currency: 'usd',
    items: {
      data: items.map((i) => ({
        quantity: i.quantity ?? 1,
        price: {
          unit_amount: i.unit_amount,
          currency: i.currency ?? 'usd',
          recurring: i.interval
            ? { interval: i.interval, interval_count: i.interval_count ?? 1 }
            : null,
        },
      })),
    },
    ...extra,
  } as unknown as Stripe.Subscription
}

describe('monthlyCentsForSubscription', () => {
  it('takes a monthly price at face value', () => {
    expect(monthlyCentsForSubscription(sub([{ unit_amount: 4900, interval: 'month' }]))).toBe(4900)
  })

  it('spreads an annual price across twelve months', () => {
    expect(monthlyCentsForSubscription(sub([{ unit_amount: 49000, interval: 'year' }]))).toBeCloseTo(
      49000 / 12
    )
  })

  it('honors interval_count (billed every 3 months is a third of the monthly rate)', () => {
    const s = sub([{ unit_amount: 30000, interval: 'month', interval_count: 3 }])
    expect(monthlyCentsForSubscription(s)).toBe(10000)
  })

  it('multiplies by quantity', () => {
    expect(monthlyCentsForSubscription(sub([{ unit_amount: 1000, interval: 'month', quantity: 5 }]))).toBe(
      5000
    )
  })

  it('sums multiple line items on one subscription', () => {
    const s = sub([
      { unit_amount: 4900, interval: 'month' },
      { unit_amount: 12000, interval: 'year' },
    ])
    expect(monthlyCentsForSubscription(s)).toBeCloseTo(4900 + 1000)
  })

  it('applies a percent-off coupon when the discount is expanded', () => {
    const s = sub([{ unit_amount: 10000, interval: 'month' }], {
      discounts: [{ source: { coupon: { percent_off: 25 } } }],
    } as unknown as Partial<Stripe.Subscription>)
    expect(monthlyCentsForSubscription(s)).toBe(7500)
  })

  it('ignores an unexpanded discount id rather than guessing its value', () => {
    const s = sub([{ unit_amount: 10000, interval: 'month' }], {
      discounts: ['di_123'],
    } as unknown as Partial<Stripe.Subscription>)
    expect(monthlyCentsForSubscription(s)).toBe(10000)
  })

  it('returns null for a subscription with no recognizable recurring interval', () => {
    expect(monthlyCentsForSubscription(sub([{ unit_amount: 4900 }]))).toBeNull()
  })
})

describe('computeMrr', () => {
  it('sums across subscriptions and derives ARR', () => {
    const result = computeMrr([
      sub([{ unit_amount: 4900, interval: 'month' }]),
      sub([{ unit_amount: 49000, interval: 'year' }]),
    ])
    expect(result.mrr).toBeCloseTo(49 + 49000 / 12 / 100, 2)
    expect(result.arr).toBeCloseTo(result.mrr * 12, 6)
    expect(result.subscriptionCount).toBe(2)
    expect(result.skipped).toBe(0)
  })

  it('counts a subscription whose plan column never synced — the old math dropped these', () => {
    // Three of five live active subscriptions have subscription_plan = null.
    // Stripe still bills them, so they must appear in MRR.
    const result = computeMrr([
      sub([{ unit_amount: 4900, interval: 'month' }]),
      sub([{ unit_amount: 4900, interval: 'month' }]),
      sub([{ unit_amount: 4900, interval: 'month' }]),
    ])
    expect(result.subscriptionCount).toBe(3)
    expect(result.mrr).toBe(147)
  })

  it('prices each subscription at its own amount, not a single list price', () => {
    const result = computeMrr([
      sub([{ unit_amount: 4900, interval: 'month' }]),
      sub([{ unit_amount: 2900, interval: 'month' }]), // grandfathered rate
    ])
    expect(result.mrr).toBe(78)
  })

  it('reports skipped subscriptions instead of folding a wrong number into the total', () => {
    const result = computeMrr([
      sub([{ unit_amount: 4900, interval: 'month' }]),
      sub([{ unit_amount: 9900 }]),
    ])
    expect(result).toMatchObject({ mrr: 49, subscriptionCount: 1, skipped: 1 })
  })

  it('is zero, not NaN, with no subscriptions', () => {
    expect(computeMrr([])).toEqual({
      mrr: 0,
      arr: 0,
      currency: null,
      subscriptionCount: 0,
      skipped: 0,
    })
  })
})
