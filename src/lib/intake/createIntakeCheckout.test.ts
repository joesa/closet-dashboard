import { beforeEach, describe, expect, it } from 'vitest'
import { resolveOneTimeCheckoutPricing } from '@/lib/intake/createIntakeCheckout'
import { getTierEntry } from '@/lib/intake/tiers'

/**
 * A discounted intake must never reuse the pre-made full-price Stripe price.
 *
 * The original bug: `catalogCents` was derived from the same row field as
 * `amountCents`, so the two were equal by construction and
 * `resolveOneTimePriceId` always returned the catalog price ID. A half-price
 * row displayed the discount and charged list price — silently, and against a
 * real card. Everything below exists to keep that from coming back.
 */

const PRICE_ENV = {
  aiPremiumDeposit: 'price_catalog_deposit',
  aiPremiumBalance: 'price_catalog_balance',
  standardBuild: 'price_catalog_standard',
}

let premiumTotal = 0
let premiumDeposit = 0
let premiumRemainder = 0
let standardTotal = 0

beforeEach(() => {
  const premium = getTierEntry('ai_premium')
  const standard = getTierEntry('standard')
  if (!premium || !standard) throw new Error('tier catalog unavailable')
  premiumTotal = premium.totalCents
  premiumDeposit = premium.depositCents
  premiumRemainder = premium.remainderCents
  standardTotal = standard.totalCents
})

const premiumRow = (over: Partial<{ tier_total_cents: number; deposit_required_cents: number }> = {}) => ({
  intake_tier: 'ai_premium' as const,
  tier_total_cents: premiumTotal,
  deposit_required_cents: premiumDeposit,
  ...over,
})

describe('resolveOneTimeCheckoutPricing — list price', () => {
  it('reuses the catalog Stripe price for a full-price deposit and balance', () => {
    const deposit = resolveOneTimeCheckoutPricing(premiumRow(), 'deposit', PRICE_ENV)
    expect(deposit.amountCents).toBe(premiumDeposit)
    expect(deposit.priceId).toBe('price_catalog_deposit')

    const balance = resolveOneTimeCheckoutPricing(premiumRow(), 'balance', PRICE_ENV)
    expect(balance.amountCents).toBe(premiumRemainder)
    expect(balance.priceId).toBe('price_catalog_balance')
  })

  it('reuses the catalog Stripe price for a full-price standard build', () => {
    const result = resolveOneTimeCheckoutPricing(
      { intake_tier: 'standard', tier_total_cents: standardTotal, deposit_required_cents: 0 },
      'standard_build',
      PRICE_ENV
    )
    expect(result.amountCents).toBe(standardTotal)
    expect(result.priceId).toBe('price_catalog_standard')
  })
})

describe('resolveOneTimeCheckoutPricing — discounted (the spec-build offer)', () => {
  // 50% off with the deposit waived: the whole discounted total is the balance.
  const halfPriceRow = () =>
    premiumRow({ tier_total_cents: Math.round(premiumTotal / 2), deposit_required_cents: 0 })

  it('does NOT reuse the catalog price when the balance is discounted', () => {
    const result = resolveOneTimeCheckoutPricing(halfPriceRow(), 'balance', PRICE_ENV)

    expect(result.priceId).toBeNull()
    expect(result.amountCents).toBe(Math.round(premiumTotal / 2))
    expect(result.amountCents).toBeLessThan(premiumRemainder)
  })

  it('does NOT reuse the catalog price when the deposit is discounted', () => {
    const result = resolveOneTimeCheckoutPricing(
      premiumRow({
        tier_total_cents: Math.round(premiumTotal / 2),
        deposit_required_cents: Math.round(premiumDeposit / 2),
      }),
      'deposit',
      PRICE_ENV
    )

    expect(result.priceId).toBeNull()
    expect(result.amountCents).toBe(Math.round(premiumDeposit / 2))
  })

  it('does NOT reuse the catalog price when a standard build is discounted', () => {
    const result = resolveOneTimeCheckoutPricing(
      {
        intake_tier: 'standard',
        tier_total_cents: Math.round(standardTotal / 2),
        deposit_required_cents: 0,
      },
      'standard_build',
      PRICE_ENV
    )

    expect(result.priceId).toBeNull()
    expect(result.amountCents).toBe(Math.round(standardTotal / 2))
  })

  it('never lets a discounted amount fall back to a list-price line item', () => {
    // The invariant over every kind: a catalog price ID may be used only when
    // the charge equals the TRUE catalog amount. Comparing against the returned
    // `catalogCents` would be circular — the original bug corrupted that field
    // too, so such a check passes while the customer is overcharged.
    const trueCatalog = {
      deposit: premiumDeposit,
      balance: premiumRemainder,
      standard_build: premiumTotal,
    } as const

    for (const kind of ['deposit', 'balance', 'standard_build'] as const) {
      const result = resolveOneTimeCheckoutPricing(halfPriceRow(), kind, PRICE_ENV)
      if (result.priceId !== null) {
        expect
          .soft(result.amountCents, `${kind} used a catalog price ID at a non-catalog amount`)
          .toBe(trueCatalog[kind])
      }
    }
  })
})

describe('resolveOneTimeCheckoutPricing — degradation', () => {
  it('forces inline price_data when no env price ID is configured', () => {
    expect(resolveOneTimeCheckoutPricing(premiumRow(), 'balance', {}).priceId).toBeNull()
  })
})
