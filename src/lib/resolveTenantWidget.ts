import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export type ResolvedTenantWidget = {
  tenant: { id: string; business_name: string | null; widget_id: string | null }
  supabase: SupabaseClient
  /** Canonical contractor_settings.id used by the live widget + admin. */
  widgetId: string
  /** True when tenants.widget_id was missing/wrong and we healed it. */
  healedWidgetId: boolean
}

/**
 * Resolve the contractor_settings row that powers a tenant's live engagement
 * tools (quote/order/booking/ticket). Prefer tenants.widget_id; fall back to
 * tenant.id (legacy invariant) and heal a drifted widget_id pointer.
 */
export async function resolveTenantWidget(
  tenantId: string
): Promise<
  | ResolvedTenantWidget
  | { error: string; status: 400 | 404 }
> {
  const supabase = getSupabaseAdmin()
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('id, business_name, widget_id')
    .eq('id', tenantId)
    .maybeSingle()

  if (error || !tenant) {
    return { error: 'Tenant not found', status: 404 }
  }

  const candidates = [
    tenant.widget_id,
    tenantId,
  ].filter((id): id is string => typeof id === 'string' && id.length > 0)

  // Deduplicate while preserving order
  const seen = new Set<string>()
  const unique = candidates.filter((id) => {
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })

  for (const candidate of unique) {
    const { data: settings } = await supabase
      .from('contractor_settings')
      .select('id')
      .eq('id', candidate)
      .maybeSingle()

    if (!settings?.id) continue

    let healedWidgetId = false
    if (tenant.widget_id !== settings.id) {
      const { error: healErr } = await supabase
        .from('tenants')
        .update({ widget_id: settings.id })
        .eq('id', tenantId)
      if (!healErr) healedWidgetId = true
    }

    return {
      tenant,
      supabase,
      widgetId: settings.id,
      healedWidgetId,
    }
  }

  return {
    error: 'Tenant has no contractor_settings linked (widget_id)',
    status: 400,
  }
}
