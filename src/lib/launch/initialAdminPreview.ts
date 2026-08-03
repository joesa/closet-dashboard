import { buildTenantPreviewUrlFromDomains, type PreviewDomainRow } from '@/lib/admin-preview'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { revalidateTenantSiteCache } from '@/lib/tenants/revalidateTenantSite'

const INVALID_PREVIEW_MARKERS = [
  'Log in to Vercel',
  'Continue with Google',
  'Continue with GitHub',
  'Vercel Authentication',
  'This page could not be found',
  '404: This page could not be found',
  'Site Under Construction',
]

/**
 * Prove the intake-driven engine site is reachable through the admin bypass
 * before the automatic first Full Redesign is allowed to claim its job.
 */
export async function assertInitialAdminPreviewReady(tenantId: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  const [{ data: config }, { data: domains }] = await Promise.all([
    supabase
      .from('site_configs')
      .select('render_mode')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    supabase
      .from('domains')
      .select('hostname, source, is_primary, vercel_verified, ssl_status')
      .eq('tenant_id', tenantId),
  ])

  if (!config) throw new Error('Initial site config is not deployed yet')
  if (config.render_mode === 'custom') {
    throw new Error('Initial intake site is no longer in engine render mode')
  }

  const domainRows = (Array.isArray(domains) ? domains : []) as PreviewDomainRow[]
  const previewUrl = buildTenantPreviewUrlFromDomains(domainRows)
  if (!previewUrl) throw new Error('Initial site has no admin-bypass preview URL yet')

  await revalidateTenantSiteCache(tenantId)

  let response: Response
  try {
    response = await fetch(previewUrl, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'DitchTheForm-AutoLaunch-Readiness/1.0',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    })
  } catch (err) {
    throw new Error(
      `Initial admin preview is not reachable yet: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  if (!response.ok) {
    throw new Error(`Initial admin preview returned HTTP ${response.status}`)
  }

  const html = await response.text()
  if (html.length < 500 || INVALID_PREVIEW_MARKERS.some((marker) => html.includes(marker))) {
    throw new Error('Initial admin preview did not return the rendered intake site')
  }
}