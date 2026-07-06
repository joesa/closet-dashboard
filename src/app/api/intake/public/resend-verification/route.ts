import { NextResponse } from 'next/server'
import { resendIntakeVerificationEmail } from '@/lib/intake/createDraftIntake'
import { checkRateLimit, hashRateKey } from '@/lib/rateLimit'

export const runtime = 'nodejs'

function siteOrigin(req: Request): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    new URL(req.url).origin
  )
}

/**
 * Re-sends the original verification email for a pending get-started signup.
 * Always returns a generic success-shaped response regardless of whether the
 * email actually matched a pending draft — avoids leaking whether a given
 * address has signed up (email enumeration).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
    }

    // Own, more generous limit than new-signup creation — a legitimate user
    // re-clicking "resend" a couple of times shouldn't hit the 3/day signup
    // cap, but this still needs its own ceiling to prevent email-bombing.
    const emailLimit = await checkRateLimit(
      hashRateKey('intake_resend_email', email),
      5,
      15 * 60 * 1000
    )
    if (!emailLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many resend attempts. Please try again in a few minutes.' },
        { status: 429 }
      )
    }

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown'
    const ipLimit = await checkRateLimit(hashRateKey('intake_resend_ip', ip), 20, 60 * 60 * 1000)
    if (!ipLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
    }

    await resendIntakeVerificationEmail(email, siteOrigin(req))

    return NextResponse.json({
      success: true,
      message: 'If that email has a pending signup, we\u2019ve resent the link.',
    })
  } catch (error) {
    console.error('resend verification email error:', error)
    // Still respond success-shaped — don't reveal internal errors to the
    // client for what's effectively a best-effort convenience action.
    return NextResponse.json({
      success: true,
      message: 'If that email has a pending signup, we\u2019ve resent the link.',
    })
  }
}
