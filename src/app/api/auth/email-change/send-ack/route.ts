import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getSupabaseServer } from '@/lib/supabase-server'
import { createAuthEmailToken } from '@/lib/auth/emailTokens'
import { sendEmailChangeAckOldEmail } from '@/lib/auth/sendAuthEmails'
import { findContractorByUserId } from '@/lib/auth/authUserLookup'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Authenticated: if email_change_requires_old_ack, send ack mail to previous
 * email and tell the client to sign out / wait.
 */
export async function POST() {
  const supabase = await getSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const contractor = await findContractorByUserId(user.id)
  if (!contractor?.email_change_requires_old_ack) {
    return NextResponse.json({ ok: true, requiresAck: false })
  }

  const previous = contractor.email_change_previous_email
  if (!previous) {
    return NextResponse.json({ ok: true, requiresAck: false })
  }

  const admin = getSupabaseAdmin()
  const { data: pending } = await admin
    .from('email_change_requests')
    .select('id, new_email')
    .eq('contractor_id', contractor.id)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const newEmail =
    pending?.new_email ||
    contractor.contact_email ||
    user.email ||
    ''

  try {
    const { raw } = await createAuthEmailToken({
      kind: 'email_change_ack_old',
      email: previous,
      userId: user.id,
      contractorId: contractor.id,
      payload: {
        requestId: pending?.id || null,
        newEmail,
      },
    })
    await sendEmailChangeAckOldEmail({
      to: previous,
      token: raw,
      newEmail,
    })
  } catch (err) {
    console.error('[email-change/send-ack]', err)
    return NextResponse.json(
      { error: 'Could not send confirmation email' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    requiresAck: true,
    message:
      'Check your previous email inbox to confirm this login email change.',
  })
}
