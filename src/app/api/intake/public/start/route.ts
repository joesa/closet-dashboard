import { NextResponse } from 'next/server'
import { createDraftIntake } from '@/lib/intake/createDraftIntake'
import { checkRateLimit, hashRateKey } from '@/lib/rateLimit'
import { verifyTurnstileToken } from '@/lib/turnstile'

export const runtime = 'nodejs'

function siteOrigin(req: Request): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    new URL(req.url).origin
  )
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const businessName =
      typeof body.businessName === 'string' ? body.businessName.trim() : ''
    const hasWebsite = body.hasWebsite === true
    const tier =
      body.tier === 'ai_premium' || body.tier === 'standard' ? body.tier : undefined

    if (hasWebsite) {
      return NextResponse.json(
        {
          error:
            'Widget-only setup is self-serve. Go to /signup for a free trial or subscribe now.',
          redirect: '/signup?from=get-started',
        },
        { status: 400 }
      )
    }
    const turnstileToken =
      typeof body.turnstileToken === 'string' ? body.turnstileToken : ''

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
    }

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown'

    const ipLimit = await checkRateLimit(hashRateKey('intake_ip', ip), 5, 60 * 60 * 1000)
    if (!ipLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
    }

    const emailLimit = await checkRateLimit(
      hashRateKey('intake_email', email),
      3,
      24 * 60 * 60 * 1000
    )
    if (!emailLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many signups for this email today.' },
        { status: 429 }
      )
    }

    const turnstileOk = await verifyTurnstileToken(turnstileToken, ip)
    if (!turnstileOk) {
      return NextResponse.json({ error: 'Captcha verification failed' }, { status: 400 })
    }

    const origin = siteOrigin(req)
    const result = await createDraftIntake({
      source: 'public',
      businessName: businessName || null,
      requestedProduct: 'full',
      verificationEmail: email,
      sendEmail: true,
      recipientEmail: email,
      siteOrigin: origin,
      initialTier: tier,
    })

    return NextResponse.json({
      success: true,
      message: 'Check your email for a link to continue.',
      intakeId: result.id,
    })
  } catch (error) {
    console.error('public intake start error:', error)
    const message = error instanceof Error ? error.message : 'Failed to start intake'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
