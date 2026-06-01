import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Ensures the signed-in user has a contractor_settings row with an active trial.
 * Called right after signup before redirecting to /dashboard (middleware entitlement).
 */
export async function POST() {
  const supabase = await getSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getSupabaseAdmin()
  const { data: existing } = await admin
    .from('contractor_settings')
    .select('id, subscription_status, trial_ends_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({
      ok: true,
      contractorId: existing.id,
      created: false,
    })
  }

  const trialEnds = new Date()
  trialEnds.setUTCDate(trialEnds.getUTCDate() + 30)

  const { data: created, error } = await admin
    .from('contractor_settings')
    .insert({
      user_id: user.id,
      contact_email: user.email || '',
      subscription_status: 'trialing',
      trial_ends_at: trialEnds.toISOString(),
    })
    .select('id')
    .single()

  if (error) {
    console.error('contractor bootstrap insert failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    contractorId: created.id,
    created: true,
  })
}
