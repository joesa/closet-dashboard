import { getSupabaseAdmin } from '@/lib/supabase-admin'

/**
 * Resolve the canonical public hostname for the tenant owned by `userId`,
 * following the same chain used by resolveTenantWidget:
 *   auth user -> contractor_settings.id -> tenants.widget_id -> domains.hostname
 *
 * A single auth user can legitimately own MULTIPLE contractor_settings rows
 * (multi-site accounts via `/api/contractor/bootstrap`'s `forceNewSite`), so
 * this can't assume exactly one row (`.maybeSingle()` used to be called here
 * and silently returned null — swallowing its own "multiple rows" error —
 * for any multi-site user, making every one of their tenant-subdomain logins
 * look like a false "account not registered to this site" mismatch).
 *
 * When `preferredHostname` is given (the subdomain the user is actually
 * logging in from) and it matches one of the user's own tenants, that one is
 * returned so the "does this account own the CURRENT site" check succeeds.
 * Otherwise falls back to the first-provisioned tenant that has a domain,
 * preferring a verified custom domain over the platform subdomain.
 */
export async function getTenantHostnameForUser(
  userId: string,
  preferredHostname?: string | null
): Promise<string | null> {
  const admin = getSupabaseAdmin()

  const { data: settingsRows } = await admin
    .from('contractor_settings')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  const settingsIds = (settingsRows ?? []).map((s) => s.id).filter(Boolean)
  if (settingsIds.length === 0) return null

  const { data: tenants } = await admin
    .from('tenants')
    .select('id, widget_id')
    .in('widget_id', settingsIds)

  // Every settings row maps to a tenant id (its own tenants row if one
  // exists, else the settings id itself — same fallback provisionTenant.ts
  // relies on).
  const tenantIds = settingsIds.map(
    (settingsId) => tenants?.find((t) => t.widget_id === settingsId)?.id || settingsId
  )

  const { data: domains } = await admin
    .from('domains')
    .select('hostname, tenant_id, is_primary, source, vercel_verified')
    .in('tenant_id', tenantIds)
    .order('is_primary', { ascending: false })

  if (!domains || domains.length === 0) return null

  if (preferredHostname) {
    const match = domains.find((d) => d.hostname.toLowerCase() === preferredHostname.toLowerCase())
    if (match) return match.hostname
  }

  // Fall back to the first-provisioned tenant's domains (tenantIds is in
  // created_at order), preferring a verified custom domain over the
  // platform subdomain.
  for (const tenantId of tenantIds) {
    const ownDomains = domains.filter((d) => d.tenant_id === tenantId)
    if (ownDomains.length === 0) continue
    const custom = ownDomains.find(
      (d) => d.source && d.source !== 'platform_subdomain' && d.vercel_verified
    )
    return (custom || ownDomains[0]).hostname
  }
  return null
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
