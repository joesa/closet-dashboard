import { describe, expect, it } from 'vitest'
import { getIntakePaymentSummary } from '@/lib/intake/intakePaymentStage'
import { resolveOneTimeCheckoutPricing } from '@/lib/intake/createIntakeCheckout'
import { depositSatisfied } from '@/lib/intake/intakeTierGates'
import { getTierEntry } from '@/lib/intake/tiers'
import { priceSpecOffer } from '@/lib/spec/specOffer'
import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'

/**
 * What an adopted spec build must look like to the money code.
 *
 * This is the end of the chain that started with a cold lead, and the one place
 * where a mistake takes real money from a real card. Three separate mechanisms
 * have to agree that a half-price waived-deposit row is a legitimate customer:
 * the deposit gate, the payment-stage state machine, and the Stripe pricing.
 */

/** The row adoptSpecBuild leaves behind. */
function adoptedRow(): ProspectIntakeRow {
  const offer = priceSpecOffer()
  return {
    id: 'intake-1',
    status: 'built',
    source: 'spec',
    intake_tier: 'ai_premium',
    tier_total_cents: offer.offerCents,
    deposit_required_cents: 0,
    deposit_paid_cents: 0,
    deposit_status: 'waived',
    preview_approved_at: '2026-08-09T00:00:00Z',
    balance_paid_at: null,
    build_paid_at: null,
    contact_email: 'owner@theirbusiness.example',
  } as unknown as ProspectIntakeRow
}

describe('an adopted spec build, seen by the payment code', () => {
  it('counts as having settled its deposit without paying one', () => {
    // Before isDepositCleared existed, a waived row fell through to the catalog
    // deposit and was treated as owing 30% it could never be asked for.
    expect(depositSatisfied(adoptedRow())).toBe(true)
  })

  it('lands on the balance stage with the discounted amount, ready to pay', () => {
    const summary = getIntakePaymentSummary(adoptedRow())
    expect(summary.stage).toBe('balance')
    expect(summary.canCheckout).toBe(true)
    expect(summary.amountCents).toBe(priceSpecOffer().offerCents)
  })

  it('is never asked for a $0 deposit it can never pay', () => {
    // The failure mode if 'waived' were not treated as settled: an endless
    // deposit prompt for nothing, with no route to the balance.
    expect(getIntakePaymentSummary(adoptedRow()).stage).not.toBe('deposit')
  })

  it('CHARGES the offer price at Stripe, not the list price', () => {
    // The whole point. resolveOneTimeCheckoutPricing must refuse the pre-made
    // full-price Stripe price and fall through to an inline amount.
    const env = {
      aiPremiumDeposit: 'price_catalog_deposit',
      aiPremiumBalance: 'price_catalog_balance',
      standardBuild: 'price_catalog_standard',
    }
    const pricing = resolveOneTimeCheckoutPricing(adoptedRow(), 'balance', env)
    const list = getTierEntry('ai_premium')!

    expect(pricing.priceId).toBeNull()
    expect(pricing.amountCents).toBe(priceSpecOffer().offerCents)
    expect(pricing.amountCents).toBeLessThan(list.totalCents)
    expect(pricing.amountCents).toBeLessThan(list.remainderCents)
  })

  it('charges roughly half of list, not some other number', () => {
    const pricing = resolveOneTimeCheckoutPricing(adoptedRow(), 'balance', {})
    const list = getTierEntry('ai_premium')!
    expect(pricing.amountCents).toBe(Math.round(list.totalCents / 2))
  })
})
