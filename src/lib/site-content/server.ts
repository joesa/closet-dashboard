import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { resolveDomainActor } from '@/lib/domains/auth'
import { getTenantPreviewSiteUrl, type PreviewDomainRow } from '@/lib/admin-preview'
import { documentFromRow } from './document'

const CONTENT_SELECT =
  'brand_name, hero_config, about_config, process_config, products_config, seo_config, before_after_config, quiz_config, nav_links, pages_config, logo_url, pricing_notes, custom_config, content_structure, render_mode, content_version, content_studio_enabled'

export type LoadedSiteContent = {
  actorUserId: string
  tenantId: string
  tenant: {
    id: string
    businessName: string
    siteStatus: string | null
    validationStatus: string | null
    validationReport: unknown[]
    validatedAt: string | null
  }
  renderMode: 'engine' | 'custom'
  version: number
  publicUrl: string
  hostnames: string[]
  document: ReturnType<typeof documentFromRow>
}

export async function loadOwnedSiteContent(): Promise<
  { ok: true; value: LoadedSiteContent } | { ok: false; error: string; status: number }
> {
  const resolved = await resolveDomainActor()
  if ('error' in resolved) return { ok: false, error: resolved.error, status: resolved.status }
  if (resolved.actor.role !== 'contractor') {
    return { ok: false, error: 'Contractor account required', status: 403 }
  }
  const admin = getSupabaseAdmin()
  const [{ data: tenant, error: tenantError }, { data: config, error: configError }, { data: domains }] =
    await Promise.all([
      admin.from('tenants').select('id, business_name, site_status, validation_status, validation_report, validated_at').eq('id', resolved.tenantId).single(),
      admin
        .from('site_configs')
        .select(CONTENT_SELECT)
        .eq('tenant_id', resolved.tenantId)
        .single(),
      admin
        .from('domains')
        .select('hostname, source, is_primary, vercel_verified, ssl_status')
        .eq('tenant_id', resolved.tenantId),
    ])
  if (tenantError || configError || !tenant || !config) {
    return { ok: false, error: tenantError?.message || configError?.message || 'Website not found', status: 404 }
  }
  if (config.content_studio_enabled === false || process.env.CONTENT_STUDIO_ENABLED === 'false') {
    return { ok: false, error: 'Website editor is not enabled for this site', status: 403 }
  }
  const domainRows = (Array.isArray(domains) ? domains : []) as PreviewDomainRow[]
  return {
    ok: true,
    value: {
      actorUserId: resolved.actor.userId,
      tenantId: resolved.tenantId,
      tenant: {
        id: tenant.id,
        businessName: tenant.business_name,
        siteStatus: tenant.site_status,
        validationStatus: tenant.validation_status,
        validationReport: Array.isArray(tenant.validation_report) ? tenant.validation_report : [],
        validatedAt: tenant.validated_at,
      },
      renderMode: config.render_mode === 'custom' ? 'custom' : 'engine',
      version: Number(config.content_version || 1),
      publicUrl: getTenantPreviewSiteUrl(domainRows),
      hostnames: domainRows.map((row) => row.hostname).filter(Boolean),
      document: documentFromRow(config as Record<string, unknown>),
    },
  }
}

export function assertSameOriginMutation(req: Request): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return req.headers.get('sec-fetch-site') !== 'cross-site'
  try {
    return new URL(origin).origin === new URL(req.url).origin
  } catch {
    return false
  }
}

export function collectReferencedUrls(value: unknown, output = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    const matches = value.match(/https?:\/\/[^\s"'<>\\)]+/g) || []
    for (const match of matches) {
      if (/\/site-assets\//i.test(match)) output.add(match.replace(/&amp;/g, '&'))
    }
  } else if (Array.isArray(value)) {
    for (const item of value) collectReferencedUrls(item, output)
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) collectReferencedUrls(item, output)
  }
  return output
}
