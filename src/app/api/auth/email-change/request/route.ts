import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { checkRateLimit, hashRateKey } from '@/lib/rateLimit'
import { createAuthEmailToken } from '@/lib/auth/emailTokens'
import { sendEmailChangeConfirmOldEmail } from '@/lib/auth/sendAuthEmails'
import {
  findAuthUserByEmail,
  findContractorByContactEmail,
  isDemoAuthEmail,
  normalizeEmail,
} from '@/lib/auth/authUserLookup'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GENERIC = {
  ok: true,
  message:
    'If an account exists for that email, we sent a confirmation message to it.',
}

/** Start email change: Resend confirm link to the current (old) email. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const email = normalizeEmail(typeof body.email === 'string' ? body.email : '')
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  const rl = await checkRateLimit(
    hashRateKey('email-change-req', `${email}:${ip}`),
    5,
    15 * 60 * 1000
  )
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Try again later.' },
      { status: 429 }
    )
  }

  if (isDemoAuthEmail(email)) {
    return NextResponse.json(GENERIC)
  }

  try {
    const user = await findAuthUserByEmail(email)
    const contractor = await findContractorByContactEmail(email)
    if (user && contractor) {
      const supabase = getSupabaseAdmin()
      // Cancel other open requests for this contractor
      await supabase
        .from('email_change_requests')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('contractor_id', contractor.id)
        .in('status', ['awaiting_old_confirm', 'pending_admin'])

      const { data: reqRow, error } = await supabase
        .from('email_change_requests')
        .insert({
          contractor_id: contractor.id,
          user_id: user.id,
          old_email: email,
          status: 'awaiting_old_confirm',
        })
        .select('id')
        .single()

      if (error || !reqRow) {
        console.error('[email-change/request] insert', error)
        return NextResponse.json(GENERIC)
      }

      const { raw } = await createAuthEmailToken({
        kind: 'email_change_confirm_old',
        email,
        userId: user.id,
        contractorId: contractor.id,
        payload: { requestId: reqRow.id },
      })
      await sendEmailChangeConfirmOldEmail({ to: email, token: raw })
    }
  } catch (err) {
    console.error('[email-change/request]', err)
  }

  return NextResponse.json(GENERIC)
}
