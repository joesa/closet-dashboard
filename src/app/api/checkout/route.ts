import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { getSupabaseServer } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getEntitlementForUser } from '@/lib/entitlement'
import { DEMO_CONTRACTOR_ID } from '@/lib/demo'

// Stripe SDK requires Node runtime.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/checkout — create a Stripe Checkout Session for the signed-in
 * contractor and return its URL.
 *
 * Body: { plan: 'monthly' | 'yearly' }
 *
 * Notes:
 *   - The user is identified from the Supabase session cookie, NOT from the
 *     request body, to prevent one contractor from starting a checkout that
 *     would attach to another's account (IDOR).
 *   - We do NOT pass `trial_period_days` to Stripe — our 30-day trial is
 *     tracked in our DB and the customer agreed to it without a card. The
 *     subscription starts (and the first invoice runs) immediately on
 *     upgrade.
 */
export async function POST(req: Request) {
  const supabase = await getSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: { plan?: string } = {}
  try {
    body = await req.json()
  } catch {
    // empty body is fine; default to monthly
  }
  const plan = body.plan === 'yearly' ? 'yearly' : 'monthly'

  const priceId =
    plan === 'yearly'
      ? process.env.STRIPE_PRICE_YEARLY
      : process.env.STRIPE_PRICE_MONTHLY
  if (!priceId) {
    return NextResponse.json(
      { error: `Stripe price not configured for plan="${plan}".` },
      { status: 500 }
    )
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    new URL(req.url).origin

  const stripe = getStripe()
  const admin = getSupabaseAdmin()
  const ent = await getEntitlementForUser(user.id)

  // The shared demo account is free forever and cannot be upgraded.
  if (ent.contractorId === DEMO_CONTRACTOR_ID) {
    return NextResponse.json(
      { error: 'The demo account cannot be upgraded. Sign up for your own account to subscribe.' },
      { status: 403 }
    )
  }

  // Look up or create the Stripe customer for this user.
  let customerId = ent.stripeCustomerId
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
    })
    customerId = customer.id
    if (ent.contractorId) {
      await admin
        .from('contractor_settings')
        .update({ stripe_customer_id: customerId })
        .eq('id', ent.contractorId)
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: user.id,
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { supabase_user_id: user.id },
    },
    success_url: `${siteUrl}/dashboard?upgraded=true`,
    cancel_url: `${siteUrl}/billing?canceled=true`,
  })

  return NextResponse.json({ url: session.url })
}
