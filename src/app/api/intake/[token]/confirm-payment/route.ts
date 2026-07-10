import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { getIntakeByToken } from '@/lib/intake/getIntakeByToken'
import { buildIntakePublicJson } from '@/lib/intake/intakePublicResponse'
import { applyIntakeCheckoutSession } from '@/lib/intake/applyIntakeCheckoutSession'
import { resolveIntakeLaunchUrls } from '@/lib/intake/intakeLaunchUrls'
import { healIntakeTierFromPayments } from '@/lib/intake/intakeTierGates'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Synchronously confirm a Stripe checkout session on the success redirect.
 *
 * The webhook is the source of truth, but it may not have fired yet (or, in
 * local dev, may not be running). This endpoint retrieves the session, verifies
 * it belongs to this intake, and applies it idempotently so the UI reflects the
 * paid state immediately. Returns the refreshed public intake JSON.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await req.json().catch(() => ({}))

    const row = await getIntakeByToken(token)
    if (!row) {
      return NextResponse.json({ error: 'Intake not found' }, { status: 404 })
    }

    const sessionId: string | null =
      (typeof body.sessionId === 'string' && body.sessionId) ||
      row.stripe_checkout_session_id ||
      null

    let paymentKind: string | null = null
    if (sessionId) {
      const stripe = getStripe()
      const session = await stripe.checkout.sessions.retrieve(sessionId)

      // Guard: the session must belong to this intake.
      if (session.metadata?.intake_id === row.id) {
        const result = await applyIntakeCheckoutSession(session)
        paymentKind = result.paymentKind
      }
    }

    const fresh = await getIntakeByToken(token)
    const intakeRow = fresh ? await healIntakeTierFromPayments(fresh) : await healIntakeTierFromPayments(row)
    const urls = await resolveIntakeLaunchUrls(intakeRow)
    return NextResponse.json({
      ...(await buildIntakePublicJson(intakeRow)),
      ...urls,
      paymentConfirmed: !!paymentKind,
      paymentKind,
    })
  } catch (error) {
    console.error('intake confirm-payment error:', error)
    const message = error instanceof Error ? error.message : 'Failed to confirm payment'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
