import { NextResponse } from 'next/server'
import { getIntakeByToken } from '@/lib/intake/getIntakeByToken'
import { assertDraftIntake } from '@/lib/intake/intakeTierGates'
import { createIntakeCheckoutSession } from '@/lib/intake/createIntakeCheckout'
import type { IntakeCheckoutKind } from '@/lib/intake/intakePaymentStage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CHECKOUT_KINDS = new Set<IntakeCheckoutKind>([
  'deposit',
  'balance',
  'standard_build',
  'maintenance',
])

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await req.json().catch(() => ({}))
    const kind: IntakeCheckoutKind =
      typeof body.kind === 'string' && CHECKOUT_KINDS.has(body.kind as IntakeCheckoutKind)
        ? (body.kind as IntakeCheckoutKind)
        : 'deposit'

    const row = await getIntakeByToken(token)
    if (!row) {
      return NextResponse.json({ error: 'Intake not found' }, { status: 404 })
    }

    if (kind === 'deposit') {
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
      if (row.deposit_required_cents <= 0) {
        return NextResponse.json({ error: 'No deposit required for this tier' }, { status: 400 })
      }
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || new URL(req.url).origin

    const { url, sessionId } = await createIntakeCheckoutSession({
      row,
      token,
      kind,
      origin,
    })

    return NextResponse.json({ success: true, url, sessionId })
  } catch (error) {
    console.error('intake checkout error:', error)
    const message = error instanceof Error ? error.message : 'Checkout failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
