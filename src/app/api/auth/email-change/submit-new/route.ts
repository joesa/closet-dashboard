import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  consumeAuthEmailToken,
  findValidAuthEmailToken,
} from '@/lib/auth/emailTokens'
import {
  isDemoAuthEmail,
  normalizeEmail,
} from '@/lib/auth/authUserLookup'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** After old-email confirm: submit the desired new email → pending_admin. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  const newEmail = normalizeEmail(
    typeof body.newEmail === 'string' ? body.newEmail : ''
  )
  const confirmEmail = normalizeEmail(
    typeof body.confirmEmail === 'string' ? body.confirmEmail : newEmail
  )

  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 })
  }
  if (!newEmail || !newEmail.includes('@')) {
    return NextResponse.json({ error: 'Valid new email required' }, { status: 400 })
  }
  if (newEmail !== confirmEmail) {
    return NextResponse.json({ error: 'Emails do not match' }, { status: 400 })
  }
  if (isDemoAuthEmail(newEmail)) {
    return NextResponse.json(
      { error: 'That email cannot be used.' },
      { status: 400 }
    )
  }

  const row = await findValidAuthEmailToken(token, 'email_change_confirm_old')
  if (!row || !row.contractor_id) {
    return NextResponse.json(
      { error: 'This confirmation link is invalid or expired.' },
      { status: 400 }
    )
  }

  const requestId =
    typeof row.payload.requestId === 'string' ? row.payload.requestId : null
  if (!requestId) {
    return NextResponse.json({ error: 'Invalid token payload' }, { status: 400 })
  }

  if (normalizeEmail(row.email) === newEmail) {
    return NextResponse.json(
      { error: 'New email must be different from your current email.' },
      { status: 400 }
    )
  }

  const supabase = getSupabaseAdmin()

  // Ensure new email is not already an auth/contractor login
  const { data: existingSettings } = await supabase
    .from('contractor_settings')
    .select('id')
    .ilike('contact_email', newEmail)
    .limit(1)
    .maybeSingle()
  if (existingSettings) {
    return NextResponse.json(
      { error: 'That email is already in use.' },
      { status: 400 }
    )
  }

  const { data: reqRow } = await supabase
    .from('email_change_requests')
    .select('id, status, old_email, contractor_id')
    .eq('id', requestId)
    .maybeSingle()

  if (
    !reqRow ||
    reqRow.contractor_id !== row.contractor_id ||
    reqRow.status !== 'awaiting_old_confirm'
  ) {
    return NextResponse.json(
      { error: 'This email change request is no longer valid.' },
      { status: 400 }
    )
  }

  const consumed = await consumeAuthEmailToken(row.id)
  if (!consumed) {
    return NextResponse.json(
      { error: 'This confirmation link was already used.' },
      { status: 400 }
    )
  }

  const { error: updErr } = await supabase
    .from('email_change_requests')
    .update({
      new_email: newEmail,
      status: 'pending_admin',
      old_confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  if (updErr) {
    return NextResponse.json(
      { error: 'Failed to submit request' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    message:
      'Request submitted. An admin will review the email change on your site details page.',
  })
}
