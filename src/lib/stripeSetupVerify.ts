import { getStripe } from '@/lib/stripe'

export type StripeSetupCheck = {
  name: string
  ok: boolean
  detail: string
}

export type StripeSetupReport = {
  ok: boolean
  mode: 'test' | 'live' | 'unknown'
  checks: StripeSetupCheck[]
}

function stripeMode(secretKey: string | undefined): StripeSetupReport['mode'] {
  if (!secretKey) return 'unknown'
  if (secretKey.startsWith('sk_live_')) return 'live'
  if (secretKey.startsWith('sk_test_')) return 'test'
  return 'unknown'
}

export async function verifyStripeSetup(): Promise<StripeSetupReport> {
  const checks: StripeSetupCheck[] = []
  const secret = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const pub = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  const monthlyId = process.env.STRIPE_PRICE_MONTHLY
  const yearlyId = process.env.STRIPE_PRICE_YEARLY

  checks.push({
    name: 'STRIPE_SECRET_KEY',
    ok: !!secret,
    detail: secret ? `Set (${stripeMode(secret)} mode)` : 'Missing',
  })
  checks.push({
    name: 'STRIPE_WEBHOOK_SECRET',
    ok: !!webhookSecret,
    detail: webhookSecret ? 'Set' : 'Missing — webhooks will not verify',
  })
  checks.push({
    name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    ok: !!pub,
    detail: pub ? 'Set' : 'Missing — client Stripe.js unavailable',
  })
  checks.push({
    name: 'STRIPE_PRICE_MONTHLY',
    ok: !!monthlyId,
    detail: monthlyId || 'Missing',
  })
  checks.push({
    name: 'STRIPE_PRICE_YEARLY',
    ok: !!yearlyId,
    detail: yearlyId || 'Missing',
  })

  if (!secret) {
    return { ok: false, mode: 'unknown', checks }
  }

  const stripe = getStripe()

  for (const [label, priceId] of [
    ['monthly', monthlyId],
    ['yearly', yearlyId],
  ] as const) {
    if (!priceId) continue
    try {
      const price = await stripe.prices.retrieve(priceId)
      const active = price.active === true
      const recurring = price.type === 'recurring'
      const interval = price.recurring?.interval
      checks.push({
        name: `price_${label}`,
        ok: active && recurring,
        detail: active
          ? `active ${recurring ? `recurring/${interval}` : price.type}`
          : 'inactive or wrong type',
      })
    } catch (e) {
      checks.push({
        name: `price_${label}`,
        ok: false,
        detail: e instanceof Error ? e.message : 'retrieve failed',
      })
    }
  }

  try {
    const endpoints = await stripe.webhookEndpoints.list({ limit: 20 })
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '')
    const expectedPath = '/api/webhooks/stripe'
    const matching = endpoints.data.filter((ep) =>
      ep.url.includes(expectedPath) || (siteUrl && ep.url.startsWith(siteUrl))
    )
    checks.push({
      name: 'webhook_endpoints',
      ok: matching.length > 0,
      detail:
        matching.length > 0
          ? `${matching.length} endpoint(s) pointing at this app`
          : `No webhook URL containing ${expectedPath}. Configure in Stripe Dashboard.`,
    })
  } catch (e) {
    checks.push({
      name: 'webhook_endpoints',
      ok: false,
      detail: e instanceof Error ? e.message : 'list failed',
    })
  }

  const ok = checks.every((c) => c.ok)
  return { ok, mode: stripeMode(secret), checks }
}
