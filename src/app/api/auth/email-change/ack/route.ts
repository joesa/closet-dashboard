import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  consumeAuthEmailToken,
  findValidAuthEmailToken,
} from '@/lib/auth/emailTokens'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Consume old-email ack token → clear gate, mark request completed. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 })
  }

  const row = await findValidAuthEmailToken(token, 'email_change_ack_old')
  if (!row || !row.contractor_id) {
    return NextResponse.json(
      { error: 'This confirmation link is invalid or expired.' },
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

  const admin = getSupabaseAdmin()
  await admin
    .from('contractor_settings')
    .update({
      email_change_requires_old_ack: false,
      email_change_previous_email: null,
    })
    .eq('id', row.contractor_id)

  const requestId =
    typeof row.payload.requestId === 'string' ? row.payload.requestId : null
  if (requestId) {
    await admin
      .from('email_change_requests')
      .update({
        status: 'completed',
        old_acked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
  } else {
    await admin
      .from('email_change_requests')
      .update({
        status: 'completed',
        old_acked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('contractor_id', row.contractor_id)
      .eq('status', 'approved')
  }

  return NextResponse.json({
    ok: true,
    message: 'Email change confirmed. You can sign in with your new email.',
  })
}
