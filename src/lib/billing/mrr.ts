import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'

/**
 * Recurring revenue, computed from what Stripe actually bills.
 *
 * The admin page used to multiply a count of `subscription_plan` values by the
 * price in STRIPE_PRICE_MONTHLY / STRIPE_PRICE_YEARLY. That is wrong twice
 * over: every subscription is priced at today's list price regardless of what
 * the customer is really on (grandfathered rates, coupons, quantities), and any
 * row whose `subscription_plan` failed to sync counts as neither monthly nor
 * yearly and silently drops out of the total. Three of five active
 * subscriptions were in exactly that state.
 *
 * Stripe is the authority on money, so read it from Stripe. The mirrored
 * columns stay useful for filtering and display; they are just not the source
 * of truth for revenue.
 */

export type MrrBreakdown = {
  /** Monthly recurring revenue in whole currency units (not cents). */
  mrr: number
  arr: number
  currency: string | null
  subscriptionCount: number
  /** Subscriptions skipped because their interval is not one we can normalize. */
  skipped: number
}

/** Months per billing interval, used to normalize everything to monthly. */
const MONTHS_PER_INTERVAL: Record<string, number> = {
  day: 1 / 30,
  week: 1 / 4.345,
  month: 1,
  year: 12,
}

/**
 * Normalize one subscription to a monthly amount in cents.
 * Returns null when the interval is unknown, so the caller can count it as
 * skipped rather than fold a wrong number into the total.
 */
export function monthlyCentsForSubscription(sub: Stripe.Subscription): number | null {
  let total = 0
  let sawKnownInterval = false

  for (const item of sub.items?.data ?? []) {
    const price = item.price
    const unitAmount = price?.unit_amount
    if (typeof unitAmount !== 'number') continue

    const interval = price.recurring?.interval
    const intervalCount = price.recurring?.interval_count ?? 1
    const months = interval ? MONTHS_PER_INTERVAL[interval] : undefined
    if (!months) continue

    sawKnownInterval = true
    const quantity = item.quantity ?? 1
    total += (unitAmount * quantity) / (months * intervalCount)
  }

  if (!sawKnownInterval) return null

  // A coupon reduces what is actually billed. In this Stripe version the coupon
  // hangs off `discount.source`, and both the discount and the coupon are ids
  // unless the caller expanded them — an unexpanded id carries no amount, so it
  // is skipped rather than guessed at.
  for (const discount of sub.discounts ?? []) {
    if (typeof discount === 'string') continue
    const coupon = discount.source?.coupon
    if (!coupon || typeof coupon === 'string') continue
    if (typeof coupon.percent_off === 'number') total *= 1 - coupon.percent_off / 100
    if (typeof coupon.amount_off === 'number') total = Math.max(0, total - coupon.amount_off)
  }

  return total
}

/** Sum a set of subscriptions. Pure, so the arithmetic is testable without Stripe. */
export function computeMrr(subs: Stripe.Subscription[]): MrrBreakdown {
  let cents = 0
  let counted = 0
  let skipped = 0
  let currency: string | null = null

  for (const sub of subs) {
    const monthly = monthlyCentsForSubscription(sub)
    if (monthly === null) {
      skipped += 1
      continue
    }
    cents += monthly
    counted += 1
    currency ??= sub.currency ?? sub.items?.data[0]?.price?.currency ?? null
  }

  const mrr = Math.round(cents) / 100
  return { mrr, arr: mrr * 12, currency, subscriptionCount: counted, skipped }
}

/**
 * Every subscription Stripe currently bills. `past_due` counts: the customer
 * is still on the plan and the money is still expected, which is the whole
 * reason dunning exists. Trialing subscriptions do not — nothing is billed yet.
 */
export async function loadMrrFromStripe(): Promise<MrrBreakdown | { error: string }> {
  try {
    const stripe = getStripe()
    const subs: Stripe.Subscription[] = []

    for (const status of ['active', 'past_due'] as const) {
      for await (const sub of stripe.subscriptions.list({
        status,
        limit: 100,
        expand: ['data.discounts.source.coupon'],
      })) {
        subs.push(sub)
      }
    }

    return computeMrr(subs)
  } catch (err) {
    // Showing a wrong number is worse than showing none — this figure gets
    // used to decide whether dunning is working.
    return { error: err instanceof Error ? err.message : 'Stripe unavailable' }
  }
}
