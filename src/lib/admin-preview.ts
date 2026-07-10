/**
 * Build a tenant site preview URL with the admin bypass query param.
 * Uses the same ADMIN_BYPASS_SECRET as custom-closets-websites/src/proxy.ts.
 */
export function buildTenantPreviewUrl(siteUrl: string): string | null {
  const secret = process.env.ADMIN_BYPASS_SECRET?.trim()
  if (!secret || !siteUrl || siteUrl === '#') return null

  try {
    const url = new URL(siteUrl)
    url.searchParams.set('admin_bypass', secret)
    return url.toString()
  } catch {
    return null
  }
}

/** Dev-only fixture hostnames that resolve solely on a developer's machine. */
export function isDevHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.localhost')
  )
}

function isLocalTenantBase(): boolean {
  const base = (process.env.TENANT_BASE_DOMAIN || '').replace(/^\.+|\.+$/g, '')
  return base === 'localhost' || base.endsWith('.localhost')
}

export type PreviewDomainRow = {
  hostname: string
  source?: string | null
  is_primary?: boolean | null
}

/**
 * Hostname to use for admin bypass / local crawl / cache revalidate.
 *
 * Prefer the platform subdomain when it is a local host (or TENANT_BASE_DOMAIN
 * is localhost). Custom/purchased domains are often primary before DNS exists,
 * which would produce NXDOMAIN preview links.
 */
export function pickPreviewHostname(domains: PreviewDomainRow[]): string | null {
  const rows = (domains || []).filter((d) => d?.hostname?.trim())
  if (rows.length === 0) return null

  const platform = rows.find((d) => d.source === 'platform_subdomain')
  const primary = rows.find((d) => d.is_primary) || rows[0]

  if (platform && isDevHostname(platform.hostname)) {
    return platform.hostname.trim()
  }

  if (isLocalTenantBase() && platform) {
    return platform.hostname.trim()
  }

  // Primary is a public domain that isn't resolvable locally — still prefer
  // platform subdomain when present so admin bypass works before purchase/DNS.
  if (
    platform &&
    primary &&
    !isDevHostname(primary.hostname) &&
    (isDevHostname(platform.hostname) || isLocalTenantBase())
  ) {
    return platform.hostname.trim()
  }

  return (primary?.hostname || rows[0].hostname).trim() || null
}

/**
 * Public URL for a tenant, using the tenant's own custom domain.
 *
 * Tenants bring their own domains (stored in `domains.hostname`). Dev fixture
 * hostnames (`*.localhost`) have no public address, so they're only previewable
 * when running locally; in production they return '#' (UI shows "Preview N/A").
 */
export function getTenantPublicUrl(hostname: string): string {
  const host = (hostname || '').trim()
  if (!host) return '#'

  if (isDevHostname(host)) {
    return `http://${host}:3000`
  }

  return `https://${host}`
}

/** Site base URL for admin preview, preferring a locally reachable hostname. */
export function getTenantPreviewSiteUrl(domains: PreviewDomainRow[]): string {
  const host = pickPreviewHostname(domains)
  return host ? getTenantPublicUrl(host) : '#'
}

/** Admin bypass URL built from the best reachable hostname for this tenant. */
export function buildTenantPreviewUrlFromDomains(domains: PreviewDomainRow[]): string | null {
  return buildTenantPreviewUrl(getTenantPreviewSiteUrl(domains))
}
