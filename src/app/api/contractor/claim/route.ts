import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = await getSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = user.user_metadata?.tenant_id as string | undefined
  if (!tenantId) {
    return NextResponse.json({ claimed: false, reason: 'no_tenant_metadata' })
  }

  const admin = getSupabaseAdmin()
  const { data: settings, error: fetchErr } = await admin
    .from('contractor_settings')
    .select('id, user_id')
    .eq('id', tenantId)
    .maybeSingle()

  if (fetchErr || !settings) {
    return NextResponse.json({ error: 'Contractor settings not found' }, { status: 404 })
  }

  if (settings.user_id && settings.user_id !== user.id) {
    return NextResponse.json({ error: 'Settings already linked to another user' }, { status: 409 })
  }

  if (!settings.user_id) {
    const { error: updateErr } = await admin
      .from('contractor_settings')
      .update({
        user_id: user.id,
        contact_email: user.email || undefined,
      })
      .eq('id', tenantId)
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({ claimed: true, contractorId: tenantId })
}
