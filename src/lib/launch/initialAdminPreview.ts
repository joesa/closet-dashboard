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
 * Markers must be matched against *rendered* markup only.
 *
 * The App Router serialises an RSC flight payload into inline <script> tags on
 * every page, and that payload always contains Next's own `notFound` template —
 * literally `"404: This page could not be found."`. Matching the raw HTML
 * therefore flags every healthy tenant site as a 404, which fails this gate for
 * every auto-launch, forever. Observed on a perfectly good 87KB page whose
 * <title> and <h1> were correct.
 *
 * Stripping <script> (and <template>, same reason) leaves the visible document,
 * where these strings only appear when the page really is an error or gated
 * placeholder.
 */
function renderedMarkup(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, ' ')
}

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
  const rendered = renderedMarkup(html)
  const matched = INVALID_PREVIEW_MARKERS.find((marker) => rendered.includes(marker))
  if (html.length < 500 || matched) {
    // Name the marker. "did not return the rendered intake site" gave no way to
    // tell a gated placeholder from a Vercel login wall from a 404, which cost
    // real time to diagnose against a live tenant.
    throw new Error(
      matched
        ? `Initial admin preview shows "${matched}" rather than the intake site`
        : `Initial admin preview returned only ${html.length} bytes`
    )
  }
}