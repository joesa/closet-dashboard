import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getTenantPreviewSiteUrl } from '@/lib/admin-preview'

/**
 * Bust the tenant site's per-hostname config cache so a just-saved
 * site_configs change is visible on the very next request instead of after
 * the cache's 60s revalidation window (see custom-closets-websites
 * getConfig.ts + /api/revalidate). Best-effort by design: returns false on
 * any failure and never throws — the site self-heals within 60s regardless.
 */
export async function revalidateTenantSiteCache(tenantId: string): Promise<boolean> {
  const secret = process.env.ADMIN_BYPASS_SECRET?.trim()
  if (!secret) return false

  try {
    const supabase = getSupabaseAdmin()
    const { data } = await supabase
      .from('domains')
      .select('hostname, source, is_primary')
      .eq('tenant_id', tenantId)
    const rows = Array.isArray(data) ? data : []
    const siteUrl = getTenantPreviewSiteUrl(rows)
    if (!siteUrl || siteUrl === '#') return false

    const res = await fetch(`${siteUrl.replace(/\/$/, '')}/api/revalidate`, {
      method: 'POST',
      headers: { 'x-revalidate-secret': secret },
      signal: AbortSignal.timeout(5000),
    })
    return res.ok
  } catch (err) {
    console.warn('[revalidateTenantSite] cache bust failed:', err)
    return false
  }
}
