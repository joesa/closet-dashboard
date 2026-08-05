import { NextResponse } from 'next/server'
import { getIntakeByToken } from '@/lib/intake/getIntakeByToken'
import { assertDraftIntake } from '@/lib/intake/intakeTierGates'
import { checkRateLimit, hashRateKey } from '@/lib/rateLimit'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { buildIntakeDraftUpdate } from '@/lib/intake/draftFields'

export const maxDuration = 15
export const runtime = 'nodejs'

/**
 * Debounced draft autosave from the intake form. Persists form fields to
 * prospect_intakes so progress survives browser/device switches (the
 * localStorage draft only covers the same browser).
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const row = await getIntakeByToken(token)
    if (!row) {
      return NextResponse.json({ error: 'Intake not found' }, { status: 404 })
    }

    const draftErr = assertDraftIntake(row)
    if (draftErr) {
      return NextResponse.json({ error: draftErr }, { status: 410 })
    }

    // Generous: one debounced save every ~2 minutes over a full day.
    const limit = await checkRateLimit(
      hashRateKey('intake_draft', token),
      720,
      24 * 60 * 60 * 1000
    )
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many saves' }, { status: 429 })
    }

    let body: Record<string, unknown> = {}
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const update = buildIntakeDraftUpdate(body)
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ ok: true, saved: false })
    }

    const admin = getSupabaseAdmin()
    const { error } = await admin
      .from('prospect_intakes')
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq('id', row.id)
    if (error) {
      return NextResponse.json({ error: 'Save failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, saved: true })
  } catch {
    return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  }
}
