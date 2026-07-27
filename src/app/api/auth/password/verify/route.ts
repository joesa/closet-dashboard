import { NextResponse } from 'next/server'
import {
  consumeAuthEmailToken,
  createAuthEmailToken,
  findValidAuthEmailToken,
} from '@/lib/auth/emailTokens'
import { sendPasswordResetEmail } from '@/lib/auth/sendAuthEmails'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Step 2 trigger: consume password_verify token and send set-password email.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 })
  }

  const row = await findValidAuthEmailToken(token, 'password_verify')
  if (!row || !row.user_id) {
    return NextResponse.json(
      { error: 'This verification link is invalid or expired.' },
      { status: 400 }
    )
  }

  const consumed = await consumeAuthEmailToken(row.id)
  if (!consumed) {
    return NextResponse.json(
      { error: 'This verification link was already used.' },
      { status: 400 }
    )
  }

  try {
    const { raw } = await createAuthEmailToken({
      kind: 'password_reset',
      email: row.email,
      userId: row.user_id,
      contractorId: row.contractor_id,
    })
    await sendPasswordResetEmail({ to: row.email, token: raw })
  } catch (err) {
    console.error('[password/verify]', err)
    return NextResponse.json(
      { error: 'Could not send reset email. Try again.' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    message:
      'Identity verified. Check your email for a link to set your new password.',
  })
}
