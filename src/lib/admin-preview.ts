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
function isDevHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.localhost')
  )
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
    return process.env.NODE_ENV !== 'production' ? `http://${host}:3000` : '#'
  }

  return `https://${host}`
}
