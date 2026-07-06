import { NextResponse } from 'next/server'
import { suggestIdealCustomers } from '@/lib/ai/suggestIdealCustomers'
import { checkRateLimit, hashRateKey } from '@/lib/rateLimit'

export const maxDuration = 30
export const runtime = 'nodejs'

/**
 * AI-tailored "ideal customer" dropdown options for the intake form's "About
 * your business" step, based on the prospect's industry + services so far.
 * Falls back to a generic static list on rate-limit, missing key, or error.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const rate = await checkRateLimit(hashRateKey('suggest-customers', token), 12, 10 * 60 * 1000)
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again shortly.' }, { status: 429 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    // empty body → use defaults
  }

  const toStr = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const toArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [])

  const result = await suggestIdealCustomers({
    industry: toStr(body.industry),
    business_name: toStr(body.businessName),
    services: toArr(body.services),
    other_services: toStr(body.otherServices),
    differentiators: toArr(body.differentiators),
  })

  return NextResponse.json(result)
}
