import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireAdmin, logAdminAction } from '@/lib/admin'
import { revalidateTenantSiteCache } from '@/lib/tenants/revalidateTenantSite'

/**
 * Set a tenant's analytics identifiers.
 *
 * Only a GA4 measurement id and a Plausible domain, never a script snippet.
 * The renderer injects these into a page served on the tenant's own domain, so
 * accepting arbitrary markup here would let anyone who can reach this form run
 * code on a customer's site. Both values are validated to the same patterns the
 * renderer validates against, so a value that would be silently dropped at
 * render time is rejected here where an operator can see it.
 */

const GA4_PATTERN = /^G-[A-Z0-9]{4,20}$/i
const DOMAIN_PATTERN = /^[a-z0-9.-]{3,253}$/i

/** Parse the form into a stored config, or the reason it was rejected. */
export function buildAnalyticsConfig(
  rawGa4: string | null,
  rawPlausible: string | null
): { ok: true; config: Record<string, string> } | { ok: false; reason: string } {
  const ga4 = (rawGa4 ?? '').trim()
  const plausible = (rawPlausible ?? '').trim()
  const config: Record<string, string> = {}

  if (ga4) {
    if (!GA4_PATTERN.test(ga4)) return { ok: false, reason: 'ga4' }
    config.ga4 = ga4
  }
  if (plausible) {
    if (!DOMAIN_PATTERN.test(plausible)) return { ok: false, reason: 'plausible' }
    config.plausible = plausible
  }

  // Clearing both fields is a legitimate action — it turns analytics off.
  return { ok: true, config }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin()

    const formData = await req.formData()
    const tenantId = formData.get('tenantId') as string | null
    if (!tenantId) {
      return NextResponse.redirect(new URL('/admin/sites', req.url), 303)
    }

    const parsed = buildAnalyticsConfig(
      formData.get('ga4') as string | null,
      formData.get('plausible') as string | null
    )
    if (!parsed.ok) {
      return NextResponse.redirect(
        new URL(`/admin/sites/${tenantId}?error=analytics_${parsed.reason}`, req.url),
        303
      )
    }

    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('site_configs')
      .update({ analytics_config: parsed.config })
      .eq('tenant_id', tenantId)

    if (error) throw error

    await revalidateTenantSiteCache(tenantId)

    await logAdminAction({
      actor: admin,
      action: 'site.analytics',
      targetType: 'tenant',
      targetId: tenantId,
      metadata: parsed.config,
    })

    return NextResponse.redirect(new URL(`/admin/sites/${tenantId}?saved=analytics`, req.url), 303)
  } catch (error) {
    console.error('Update analytics config error:', error)
    return NextResponse.redirect(new URL('/admin/sites?error=analytics', req.url), 303)
  }
}
