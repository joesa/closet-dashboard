import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getIntakeByToken } from '@/lib/intake/getIntakeByToken'
import { assertDraftIntake, canUseImageStudio } from '@/lib/intake/intakeTierGates'
import {
  depositStatusForTier,
  getTierEntry,
  type IntakeTierSlug,
} from '@/lib/intake/tiers'

export const runtime = 'nodejs'

export async function PATCH(
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

    const body = await req.json().catch(() => ({}))
    const tier =
      body.tier === 'ai_premium' ? 'ai_premium' : body.tier === 'standard' ? 'standard' : null
    if (!tier) {
      return NextResponse.json({ error: 'tier must be standard or ai_premium' }, { status: 400 })
    }

    const entry = getTierEntry(tier as IntakeTierSlug)
    if (!entry) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
    }

    const depositStatus = depositStatusForTier(
      tier,
      row.deposit_paid_cents,
      entry.depositCents
    )

    const admin = getSupabaseAdmin()
    const maintenancePlan =
      body.maintenancePlan === 'yearly' || body.maintenancePlan === 'monthly'
        ? body.maintenancePlan
        : undefined

    const patch: Record<string, unknown> = {
      intake_tier: tier,
      tier_total_cents: entry.totalCents,
      deposit_required_cents: entry.depositCents,
      deposit_status: depositStatus,
      updated_at: new Date().toISOString(),
    }
    if (maintenancePlan) patch.maintenance_plan = maintenancePlan

    const { error } = await admin.from('prospect_intakes').update(patch).eq('id', row.id)

    if (error) throw error

    const updated = await getIntakeByToken(token)

    return NextResponse.json({
      success: true,
      tier,
      tierTotalCents: entry.totalCents,
      depositRequiredCents: entry.depositCents,
      depositStatus,
      canUseImageStudio: updated ? canUseImageStudio(updated) : false,
      catalog: entry,
    })
  } catch (error) {
    console.error('intake tier error:', error)
    const message = error instanceof Error ? error.message : 'Failed to set tier'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
