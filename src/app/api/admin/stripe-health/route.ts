import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { verifyStripeSetup } from '@/lib/stripeSetupVerify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/admin/stripe-health — verify Stripe env + catalog wiring. */
export async function GET() {
  await requireAdmin()
  const report = await verifyStripeSetup()
  return NextResponse.json(report, { status: report.ok ? 200 : 503 })
}
