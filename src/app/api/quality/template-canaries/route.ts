import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { selectTemplateCanaries, type TemplateCanaryCandidate } from '@/lib/quality/templateCanaries'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const admin = getSupabaseAdmin()
    const { data: configs, error: configError } = await admin
      .from('site_configs')
      .select('tenant_id, engagement_model')
      .eq('render_mode', 'engine')
      .limit(100)
    if (configError) throw configError

    const configByTenant = new Map(
      (configs || []).map((row) => [String(row.tenant_id), String(row.engagement_model || 'quote')])
    )
    const tenantIds = [...configByTenant.keys()]
    if (!tenantIds.length) return Response.json({ canaries: [] }, { headers: { 'Cache-Control': 'public, max-age=60' } })

    const [{ data: tenants, error: tenantError }, { data: domains, error: domainError }] = await Promise.all([
      admin
        .from('tenants')
        .select('id')
        .in('id', tenantIds)
        .eq('site_status', 'active')
        .eq('validation_status', 'passed'),
      admin
        .from('domains')
        .select('tenant_id, hostname, is_primary, source')
        .in('tenant_id', tenantIds)
        .eq('ssl_status', 'active'),
    ])
    if (tenantError) throw tenantError
    if (domainError) throw domainError

    const activeTenantIds = new Set((tenants || []).map((row) => String(row.id)))
    const candidates: TemplateCanaryCandidate[] = (domains || []).flatMap((row) => {
      const tenantId = String(row.tenant_id)
      if (!activeTenantIds.has(tenantId)) return []
      return [{
        tenantId,
        hostname: String(row.hostname || ''),
        engagementModel: configByTenant.get(tenantId) || 'quote',
        isPrimary: Boolean(row.is_primary),
        source: String(row.source || ''),
      }]
    })

    return Response.json(
      { canaries: selectTemplateCanaries(candidates) },
      { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=300' } }
    )
  } catch (error) {
    console.error('[template-canaries] discovery failed', error)
    return Response.json({ error: 'Canary discovery unavailable' }, { status: 503 })
  }
}
