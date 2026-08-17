import { NextResponse } from 'next/server'
import { createDraftIntake } from '@/lib/intake/createDraftIntake'
import { checkRateLimit, hashRateKey } from '@/lib/rateLimit'
import { verifyTurnstileToken } from '@/lib/turnstile'
import { publicAppOrigin } from '@/lib/urls'

export const runtime = 'nodejs'

function siteOrigin(req: Request): string {
  return publicAppOrigin(new URL(req.url).origin)
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

    // A contractor who already has a website is a widget customer, not a
    // rejected one. They used to be bounced to /signup, which writes no
    // configuration at all — so every trade landed on the stock closet
    // calculator. Same intake, marked as a widget build; the wizard shortens
    // itself from `requested_product` and provisioning takes the widget branch.
    const requestedProduct = hasWebsite ? 'widget' : 'full'
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
      requestedProduct,
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
