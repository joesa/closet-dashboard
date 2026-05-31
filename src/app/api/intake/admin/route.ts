import { NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/admin'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { cancelPendingProvisionJobs } from '@/lib/provision/cancelProvisionJobs'

export const runtime = 'nodejs'

// Admin-only: fetch a full intake by id so the onboarding page can pre-fill
// every captured field before the operator reviews and deploys.
export async function GET(req: Request) {
  const admin = await getCurrentAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = new URL(req.url).searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('prospect_intakes')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: 'Intake not found' }, { status: 404 })
  }

  return NextResponse.json({ intake: data })
}

// Admin-only: set auto vs manual provisioning; switching to manual cancels queued jobs.
export async function PATCH(req: Request) {
  const admin = await getCurrentAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const id = typeof body.id === 'string' ? body.id : ''
  const mode = body.provisioningMode === 'manual' ? 'manual' : body.provisioningMode === 'auto' ? 'auto' : null

  if (!id || !mode) {
    return NextResponse.json({ error: 'id and provisioningMode (auto|manual) required' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('prospect_intakes')
    .update({
      provisioning_mode: mode,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (mode === 'manual') {
    await cancelPendingProvisionJobs(id)
  }

  return NextResponse.json({ success: true, provisioningMode: mode })
}
