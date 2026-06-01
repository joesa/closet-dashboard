import Stripe from 'stripe'

/**
 * Server-side Stripe client. Singleton — only import from server components,
 * API routes, or middleware. NEVER from client components.
 *
 * apiVersion is cast loosely so we don't have to update this file every time
 * Stripe rolls a new pinned date.
 */
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (_stripe) return _stripe

  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')

  _stripe = new Stripe(key, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiVersion: (process.env.STRIPE_API_VERSION as any) || undefined,
    typescript: true,
    appInfo: { name: 'ClosetQuote', version: '0.1.0' },
  })
  return _stripe
}

/** Map a Stripe Price ID to our subscription_plan column value. */
export function priceIdToPlan(priceId: string | null | undefined): 'monthly' | 'yearly' | null {
  if (!priceId) return null
  if (priceId === process.env.STRIPE_PRICE_MONTHLY) return 'monthly'
  if (priceId === process.env.STRIPE_PRICE_YEARLY) return 'yearly'
  if (priceId === process.env.STRIPE_PRICE_SITE_MAINTENANCE_MONTHLY) return 'monthly'
  if (priceId === process.env.STRIPE_PRICE_SITE_MAINTENANCE_YEARLY) return 'yearly'
  return null
}
