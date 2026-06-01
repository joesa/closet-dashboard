import { getStripe } from '@/lib/stripe'
import { stripePriceEnv } from '@/lib/stripeCatalog'

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

async function checkPrice(
  stripe: ReturnType<typeof getStripe>,
  checks: StripeSetupCheck[],
  name: string,
  priceId: string | undefined,
  expect: 'recurring' | 'one_time'
) {
  if (!priceId) {
    checks.push({ name, ok: false, detail: 'Missing env' })
    return
  }
  try {
    const price = await stripe.prices.retrieve(priceId)
    const typeOk = expect === 'recurring' ? price.type === 'recurring' : price.type === 'one_time'
    checks.push({
      name,
      ok: price.active === true && typeOk,
      detail: price.active
        ? `${price.unit_amount}c ${price.type}${price.recurring ? `/${price.recurring.interval}` : ''}`
        : 'inactive',
    })
  } catch (e) {
    checks.push({
      name,
      ok: false,
      detail: e instanceof Error ? e.message : 'retrieve failed',
    })
  }
}

export async function verifyStripeSetup(): Promise<StripeSetupReport> {
  const checks: StripeSetupCheck[] = []
  const secret = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  const pub = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  const prices = stripePriceEnv()

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

  if (!secret) {
    return { ok: false, mode: 'unknown', checks }
  }

  const stripe = getStripe()

  await checkPrice(stripe, checks, 'STRIPE_PRICE_MONTHLY', prices.proMonthly, 'recurring')
  await checkPrice(stripe, checks, 'STRIPE_PRICE_YEARLY', prices.proYearly, 'recurring')
  await checkPrice(
    stripe,
    checks,
    'STRIPE_PRICE_STANDARD_BUILD',
    prices.standardBuild,
    'one_time'
  )
  await checkPrice(stripe, checks, 'STRIPE_PRICE_AI_PREMIUM_FULL', prices.aiPremiumFull, 'one_time')
  await checkPrice(
    stripe,
    checks,
    'STRIPE_PRICE_AI_PREMIUM_DEPOSIT',
    prices.aiPremiumDeposit,
    'one_time'
  )
  await checkPrice(
    stripe,
    checks,
    'STRIPE_PRICE_AI_PREMIUM_BALANCE',
    prices.aiPremiumBalance,
    'one_time'
  )
  await checkPrice(
    stripe,
    checks,
    'STRIPE_PRICE_SITE_MAINTENANCE_MONTHLY',
    prices.siteMaintenanceMonthly,
    'recurring'
  )
  await checkPrice(
    stripe,
    checks,
    'STRIPE_PRICE_SITE_MAINTENANCE_YEARLY',
    prices.siteMaintenanceYearly,
    'recurring'
  )

  try {
    const endpoints = await stripe.webhookEndpoints.list({ limit: 20 })
    const expectedPath = '/api/webhooks/stripe'
    const matching = endpoints.data.filter((ep) => ep.url.includes(expectedPath))
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
