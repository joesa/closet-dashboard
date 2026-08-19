import { describe, expect, it } from 'vitest'
import { computeEntitlement, PAST_DUE_GRACE_DAYS } from '@/lib/entitlement'

/**
 * A declined card must not switch off a live widget the same hour.
 *
 * Stripe marks an invoice past_due immediately and then retries over several
 * days. This gate is what the calculator embedded on the customer's own website
 * depends on, so gating instantly meant their visitors hit a dead quote form
 * mid-funnel — while the billing page told them their trial had ended and no
 * billing email existed anywhere in the codebase. The window makes recovery
 * silent when Stripe's retry succeeds, and gives dunning somewhere to land when
 * it does not.
 */

const DAY = 86_400_000
const iso = (ms: number) => new Date(ms).toISOString()

describe('computeEntitlement', () => {
  it('entitles an active subscription', () => {
    expect(computeEntitlement({ subscription_status: 'active' }).isEntitled).toBe(true)
  })

  it('entitles a trial until it expires', () => {
    expect(
      computeEntitlement({
        subscription_status: 'trialing',
        trial_ends_at: iso(Date.now() + 3 * DAY),
      }).isEntitled
    ).toBe(true)
    expect(
      computeEntitlement({
        subscription_status: 'trialing',
        trial_ends_at: iso(Date.now() - DAY),
      }).isEntitled
    ).toBe(false)
  })

  it('keeps a past-due customer working through the grace window', () => {
    const ent = computeEntitlement({
      subscription_status: 'past_due',
      current_period_end: iso(Date.now() - DAY),
    })
    expect(ent.isEntitled).toBe(true)
    expect(ent.inPastDueGrace).toBe(true)
    expect(ent.graceEndsAt).toBeTruthy()
  })

  it('cuts them off once the window closes', () => {
    const ent = computeEntitlement({
      subscription_status: 'past_due',
      current_period_end: iso(Date.now() - (PAST_DUE_GRACE_DAYS + 2) * DAY),
    })
    expect(ent.isEntitled).toBe(false)
    expect(ent.inPastDueGrace).toBe(false)
  })

  it('measures grace from the paid period, never shortening what was paid for', () => {
    // Period ends a day from now: they keep the paid day PLUS the window.
    const ent = computeEntitlement({
      subscription_status: 'past_due',
      current_period_end: iso(Date.now() + DAY),
    })
    const graceMs = new Date(ent.graceEndsAt!).getTime() - Date.now()
    expect(graceMs).toBeGreaterThan(PAST_DUE_GRACE_DAYS * DAY)
  })

  it('still grants a window when the period end is missing', () => {
    // Falling closed here would cut off a customer over missing metadata.
    const ent = computeEntitlement({ subscription_status: 'past_due' })
    expect(ent.isEntitled).toBe(true)
  })

  it('does not entitle a cancelled subscription', () => {
    expect(computeEntitlement({ subscription_status: 'canceled' }).isEntitled).toBe(false)
  })
})
