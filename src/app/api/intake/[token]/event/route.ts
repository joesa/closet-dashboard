import { NextResponse } from 'next/server'
import { getIntakeByToken } from '@/lib/intake/getIntakeByToken'
import { checkRateLimit, hashRateKey } from '@/lib/rateLimit'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const maxDuration = 10
export const runtime = 'nodejs'

const KEY_PATTERN = /^[a-z_][a-z0-9_]{0,39}$/i

/**
 * Best-effort intake funnel telemetry ("entered step X", "submitted").
 * Never blocks the prospect: invalid or failed events are dropped silently.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const row = await getIntakeByToken(token)
    if (!row) return new NextResponse(null, { status: 204 })

    const limit = await checkRateLimit(
      hashRateKey('intake_event', token),
      500,
      24 * 60 * 60 * 1000
    )
    if (!limit.allowed) return new NextResponse(null, { status: 204 })

    const body = (await req.json().catch(() => ({}))) as {
      stepKey?: unknown
      action?: unknown
    }
    const stepKey = typeof body.stepKey === 'string' ? body.stepKey : ''
    const action = typeof body.action === 'string' ? body.action : 'enter'
    if (!KEY_PATTERN.test(stepKey) || !KEY_PATTERN.test(action)) {
      return new NextResponse(null, { status: 204 })
    }

    const admin = getSupabaseAdmin()
    await admin
      .from('intake_step_events')
      .insert({ token, step_key: stepKey, action })
    return new NextResponse(null, { status: 204 })
  } catch {
    return new NextResponse(null, { status: 204 })
  }
}
