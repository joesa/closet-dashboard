import { getSupabaseAdmin } from '@/lib/supabase-admin'

/**
 * Resolve the canonical public hostname for the tenant owned by `userId`,
 * following the same chain used by resolveTenantWidget:
 *   auth user -> contractor_settings.id -> tenants.widget_id -> domains.hostname
 *
 * Prefers the tenant's primary domain (custom domain if verified, otherwise
 * the platform subdomain). Returns null if the user has no tenant, or the
 * tenant has no domain row yet (e.g. mid-provisioning).
 */
export async function getTenantHostnameForUser(userId: string): Promise<string | null> {
  const admin = getSupabaseAdmin()

  const { data: settings } = await admin
    .from('contractor_settings')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (!settings?.id) return null

  const { data: tenant } = await admin
    .from('tenants')
    .select('id')
    .eq('widget_id', settings.id)
    .maybeSingle()

  const tenantId = tenant?.id || settings.id

  const { data: domains } = await admin
    .from('domains')
    .select('hostname, is_primary, source, vercel_verified')
    .eq('tenant_id', tenantId)
    .order('is_primary', { ascending: false })

  if (!domains || domains.length === 0) return null

  // Prefer a verified custom domain over the platform subdomain; otherwise
  // fall back to whatever is marked primary (or the first row).
  const custom = domains.find(
    (d) => d.source && d.source !== 'platform_subdomain' && d.vercel_verified
  )
  return (custom || domains[0]).hostname
}

/**
 * True when `hostname` is the shared dashboard/marketing host (not a tenant
 * subdomain or custom domain).
 */
export function isDashboardHost(hostname: string): boolean {
  const appOrigin =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (!appOrigin) return false
  try {
    const appHost = new URL(
      /^https?:\/\//i.test(appOrigin) ? appOrigin : `https://${appOrigin}`
    ).hostname
    return appHost.toLowerCase() === hostname.toLowerCase()
  } catch {
    return false
  }
}

/** Build an absolute https URL for `path` on the given tenant hostname. */
export function tenantUrl(hostname: string, path: string): string {
  return `https://${hostname}${path.startsWith('/') ? path : `/${path}`}`
}
