import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Link the signed-in user to the tenant's live contractor_settings row
 * (tenants.widget_id). That is the same row the public widget and admin
 * Engagement tools read — so client dashboard edits stay in sync.
 */
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

  const { data: tenant, error: tenantErr } = await admin
    .from('tenants')
    .select('id, widget_id')
    .eq('id', tenantId)
    .maybeSingle()

  if (tenantErr || !tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  // Canonical engagement row = widget_id, with legacy fallback to tenant id.
  let widgetId =
    (typeof tenant.widget_id === 'string' && tenant.widget_id) || tenantId

  let { data: settings } = await admin
    .from('contractor_settings')
    .select('id, user_id')
    .eq('id', widgetId)
    .maybeSingle()

  if (!settings && widgetId !== tenantId) {
    const { data: byTenant } = await admin
      .from('contractor_settings')
      .select('id, user_id')
      .eq('id', tenantId)
      .maybeSingle()
    if (byTenant) {
      settings = byTenant
      widgetId = byTenant.id
      await admin.from('tenants').update({ widget_id: widgetId }).eq('id', tenantId)
    }
  }

  if (!settings) {
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
      .eq('id', widgetId)
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }
  }

  // Heal tenant pointer if it drifted away from the row we claimed.
  if (tenant.widget_id !== widgetId) {
    await admin.from('tenants').update({ widget_id: widgetId }).eq('id', tenantId)
  }

  return NextResponse.json({
    claimed: true,
    contractorId: widgetId,
    widgetId,
    tenantId,
  })
}
