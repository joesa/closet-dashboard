import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { getSupabaseServer } from '@/lib/supabase-server'
import { getEntitlementForUser } from '@/lib/entitlement'
import { DEMO_CONTRACTOR_ID } from '@/lib/demo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/portal — open the Stripe Billing Portal for the signed-in user.
 * Lets them update card, switch monthly↔yearly, or cancel.
 */
export async function POST(req: Request) {
  const supabase = await getSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const ent = await getEntitlementForUser(user.id)
  if (ent.contractorId === DEMO_CONTRACTOR_ID) {
    return NextResponse.json(
      { error: 'The demo account has no subscription to manage.' },
      { status: 403 }
    )
  }
  if (!ent.stripeCustomerId) {
    return NextResponse.json(
      { error: 'No Stripe customer on file. Start a subscription first.' },
      { status: 400 }
    )
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    new URL(req.url).origin

  const stripe = getStripe()
  const session = await stripe.billingPortal.sessions.create({
    customer: ent.stripeCustomerId,
    return_url: `${siteUrl}/billing`,
  })

  return NextResponse.json({ url: session.url })
}
