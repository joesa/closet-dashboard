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
  /** True once Vercel confirms the project domain (DNS A/CNAME in place). */
  vercel_verified?: boolean | null
  ssl_status?: string | null
}

/** Purchased/BYO custom host with DNS verified — safe to open as the live site. */
export function isDnsReadyCustomDomain(d: PreviewDomainRow): boolean {
  const host = (d.hostname || '').trim()
  if (!host || isDevHostname(host)) return false
  if (d.source === 'platform_subdomain') return false
  if (d.vercel_verified === true) return true
  // ssl_status active on a non-platform row is the same signal Domain Manager uses.
  return d.ssl_status === 'active' && (d.source === 'purchased' || d.source === 'byo')
}

/**
 * Hostname to use for admin bypass / local crawl / cache revalidate.
 *
 * In cloud/production, prefer a real public domain (purchased/BYO) so Preview
 * links work in the browser. Never send admins to *.localhost from Vercel —
 * that host only resolves on a developer machine.
 *
 * Locally (TENANT_BASE_DOMAIN=localhost and not on Vercel), prefer the
 * platform *.localhost subdomain so admin bypass works before DNS exists.
 */
export function pickPreviewHostname(domains: PreviewDomainRow[]): string | null {
  const rows = (domains || []).filter((d) => d?.hostname?.trim())
  if (rows.length === 0) return null

  const platform = rows.find((d) => d.source === 'platform_subdomain')
  const primary = rows.find((d) => d.is_primary) || rows[0]
  const publicReady = rows.find(isDnsReadyCustomDomain)
  const anyPublic = rows.find((d) => !isDevHostname((d.hostname || '').trim()))

  const onVercel = process.env.VERCEL === '1'
  const localDevOnly = isLocalTenantBase() && !onVercel

  // Cloud dashboard: use the customer domain when we have one.
  if (!localDevOnly) {
    if (publicReady) return publicReady.hostname.trim()
    if (anyPublic) return anyPublic.hostname.trim()
  }

  // Local websites app: *.localhost platform subdomain.
  if (platform && isDevHostname(platform.hostname)) {
    return platform.hostname.trim()
  }

  if (localDevOnly && platform) {
    return platform.hostname.trim()
  }

  if (
    platform &&
    primary &&
    !isDevHostname(primary.hostname) &&
    (isDevHostname(platform.hostname) || localDevOnly)
  ) {
    return platform.hostname.trim()
  }

  return (primary?.hostname || rows[0].hostname).trim() || null
}

/**
 * Hostname for customer-facing "open the live site" / post-launch redirects.
 * Prefers a purchased/BYO domain once DNS is verified AND the client has paid
 * the full launch amount; otherwise falls back to the preview hostname
 * (platform *.localhost locally / paywall host).
 */
export function pickLaunchHostname(
  domains: PreviewDomainRow[],
  opts?: { launchPaid?: boolean }
): string | null {
  const rows = (domains || []).filter((d) => d?.hostname?.trim())
  if (rows.length === 0) return null

  if (opts?.launchPaid) {
    const ready = rows.filter(isDnsReadyCustomDomain)
    const primaryReady = ready.find((d) => d.is_primary) || ready[0]
    if (primaryReady) return primaryReady.hostname.trim()
  }

  return pickPreviewHostname(rows)
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

/** Live site URL for customers — verified custom domain only after full launch payment. */
export function getTenantLaunchSiteUrl(
  domains: PreviewDomainRow[],
  opts?: { launchPaid?: boolean }
): string {
  const host = pickLaunchHostname(domains, opts)
  return host ? getTenantPublicUrl(host) : '#'
}

/** Admin bypass URL built from the best reachable hostname for this tenant. */
export function buildTenantPreviewUrlFromDomains(domains: PreviewDomainRow[]): string | null {
  return buildTenantPreviewUrl(getTenantPreviewSiteUrl(domains))
}
