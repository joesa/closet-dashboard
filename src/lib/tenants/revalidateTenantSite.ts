import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  getTenantPublicUrl,
  isDevHostname,
  isDnsReadyCustomDomain,
  type PreviewDomainRow,
} from '@/lib/admin-preview'

/**
 * Bust the tenant site's per-hostname config cache so a just-saved
 * site_configs change is visible on the very next request instead of after
 * the cache's 60s revalidation window (see custom-closets-websites
 * getConfig.ts + /api/revalidate). Best-effort by design: returns false on
 * any failure and never throws — the site self-heals within 60s regardless.
 *
 * Tries every public hostname for the tenant (not *.localhost), plus optional
 * TENANT_SITES_ORIGIN / VERCEL websites deployment URL.
 */
export async function revalidateTenantSiteCache(tenantId: string): Promise<boolean> {
  // Prefer dedicated secret; fall back to ADMIN_BYPASS_SECRET during cutover.
  const secret =
    process.env.REVALIDATE_SECRET?.trim() ||
    process.env.ADMIN_BYPASS_SECRET?.trim()
  if (!secret) return false

  const origins = new Set<string>()

  try {
    const supabase = getSupabaseAdmin()
    const { data } = await supabase
      .from('domains')
      .select('hostname, source, is_primary, vercel_verified, ssl_status')
      .eq('tenant_id', tenantId)
    const rows = (Array.isArray(data) ? data : []) as PreviewDomainRow[]

    for (const row of rows) {
      const host = (row.hostname || '').trim()
      if (!host || isDevHostname(host)) continue
      // Prefer verified/DNS-ready, but still try any public hostname.
      if (isDnsReadyCustomDomain(row) || row.source !== 'platform_subdomain') {
        const url = getTenantPublicUrl(host)
        if (url && url !== '#') origins.add(url.replace(/\/$/, ''))
      }
    }
  } catch (err) {
    console.warn('[revalidateTenantSite] domain lookup failed:', err)
  }

  const sitesOrigin = (
    process.env.TENANT_SITES_ORIGIN ||
    process.env.NEXT_PUBLIC_TENANT_SITES_ORIGIN ||
    ''
  )
    .trim()
    .replace(/\/$/, '')
  if (sitesOrigin && /^https?:\/\//i.test(sitesOrigin)) {
    origins.add(sitesOrigin)
  }

  if (origins.size === 0) return false

  let anyOk = false
  await Promise.all(
    [...origins].map(async (origin) => {
      try {
        const res = await fetch(`${origin}/api/revalidate`, {
          method: 'POST',
          headers: { 'x-revalidate-secret': secret },
          signal: AbortSignal.timeout(8000),
        })
        if (res.ok) anyOk = true
        else {
          console.warn(
            `[revalidateTenantSite] ${origin}/api/revalidate → ${res.status}`
          )
        }
      } catch (err) {
        console.warn(`[revalidateTenantSite] ${origin} failed:`, err)
      }
    })
  )
  return anyOk
}
