import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getIntakeByToken } from '@/lib/intake/getIntakeByToken'
import { assertDraftIntake } from '@/lib/intake/intakeTierGates'
import { formatUsd } from '@/lib/intake/tiers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const row = await getIntakeByToken(token)
    if (!row) {
      return NextResponse.json({ error: 'Intake not found' }, { status: 404 })
    }

    const draftErr = assertDraftIntake(row)
    if (draftErr) {
      return NextResponse.json({ error: draftErr }, { status: 410 })
    }

    if (row.intake_tier !== 'ai_premium') {
      return NextResponse.json({ error: 'Deposit only applies to AI Premium tier' }, { status: 400 })
    }

    if (row.deposit_status === 'paid') {
      return NextResponse.json({ error: 'Deposit already paid' }, { status: 400 })
    }

    const depositCents = row.deposit_required_cents
    if (depositCents <= 0) {
      return NextResponse.json({ error: 'No deposit required for this tier' }, { status: 400 })
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || new URL(req.url).origin
    const returnUrl = `${origin}/intake/${token}`

    const stripe = getStripe()
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: row.contact_email || row.notification_email || undefined,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: depositCents,
            product_data: {
              name: 'ClosetQuote AI Premium — 30% deposit',
              description: `30% upfront (${formatUsd(depositCents)}) of ${formatUsd(row.tier_total_cents)} total. Remainder due before launch.`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        kind: 'intake_deposit',
        intake_id: row.id,
        intake_token: token,
        tier: row.intake_tier,
      },
      success_url: `${returnUrl}?payment=success`,
      cancel_url: `${returnUrl}?payment=cancelled`,
    })

    const admin = getSupabaseAdmin()
    await admin
      .from('prospect_intakes')
      .update({
        deposit_status: 'pending',
        stripe_checkout_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)

    if (!session.url) {
      return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
    }

    return NextResponse.json({ success: true, url: session.url, sessionId: session.id })
  } catch (error) {
    console.error('intake checkout error:', error)
    const message = error instanceof Error ? error.message : 'Checkout failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
