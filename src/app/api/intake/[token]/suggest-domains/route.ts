import { NextResponse } from 'next/server'
import { checkRateLimit, hashRateKey } from '@/lib/rateLimit'
import { getIntakeByToken } from '@/lib/intake/getIntakeByToken'
import { searchDomainsForLabel } from '@/lib/domains/purchase'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Prospect-facing domain suggestions (Vercel Registrar availability).
 * Auth: valid intake token. Does not purchase — only suggests.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const rate = await checkRateLimit(
    hashRateKey('intake-suggest-domains', token),
    20,
    10 * 60 * 1000
  )
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many requests. Try again shortly.' }, { status: 429 })
  }

  const intake = await getIntakeByToken(token)
  if (!intake) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    /* empty */
  }

  const query =
    (typeof body.query === 'string' && body.query.trim()) ||
    (typeof body.businessName === 'string' && body.businessName.trim()) ||
    intake.business_name ||
    ''

  if (!query) {
    return NextResponse.json({ error: 'Enter a business name or domain to search.' }, { status: 400 })
  }

  try {
    const result = await searchDomainsForLabel({
      query,
      slugHint: intake.business_name || undefined,
    })
    // Prospects don't need purchaseEnabled / wholesale pricing in the UI.
    return NextResponse.json({
      success: true,
      suggestions: result.suggestions.map((s) => ({
        domain: s.domain,
        available: s.available,
        // Hide wholesale price from prospects — registration is included with hosting.
        priceUsd: null,
        priceCents: null,
        error: s.error,
      })),
    })
  } catch (e) {
    console.error('intake suggest-domains error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Search failed' },
      { status: 500 }
    )
  }
}
