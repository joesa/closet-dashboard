import { NextResponse } from 'next/server'
import { checkRateLimit, hashRateKey } from '@/lib/rateLimit'
import { createAuthEmailToken } from '@/lib/auth/emailTokens'
import { sendPasswordVerifyEmail } from '@/lib/auth/sendAuthEmails'
import {
  findAuthUserByEmail,
  isDemoAuthEmail,
  normalizeEmail,
} from '@/lib/auth/authUserLookup'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GENERIC = {
  ok: true,
  message:
    'If an account exists for that email, we sent a verification message. Check your inbox.',
}

/**
 * Step 1: request password reset — Resend identity-verify email.
 * Always returns a generic success to avoid account enumeration.
 */
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
    hashRateKey('pw-request', `${email}:${ip}`),
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
    if (user) {
      const { raw } = await createAuthEmailToken({
        kind: 'password_verify',
        email: user.email,
        userId: user.id,
      })
      await sendPasswordVerifyEmail({ to: user.email, token: raw })
    }
  } catch (err) {
    console.error('[password/request]', err)
  }

  return NextResponse.json(GENERIC)
}
