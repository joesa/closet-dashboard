import { NextResponse } from 'next/server'
import { actorTenantId, resolveDomainActor } from '@/lib/domains/auth'
import { searchDomainsForLabel } from '@/lib/domains/purchase'
import { checkRateLimit, hashRateKey } from '@/lib/rateLimit'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const maxDuration = 60

/** POST /api/domains/search — availability for .com/.net/.io suggestions. */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    /* empty */
  }

  const query = typeof body.query === 'string' ? body.query : ''
  const tenantIdParam = typeof body.tenantId === 'string' ? body.tenantId : null

  const resolved = await resolveDomainActor({ tenantId: tenantIdParam })
  if ('error' in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  }

  const tenantId = actorTenantId(resolved)
  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId is required' }, { status: 400 })
  }

  const rateKey = hashRateKey(
    'domains-search',
    resolved.actor.role === 'admin' ? resolved.actor.adminId : resolved.actor.userId
  )
  const rate = await checkRateLimit(rateKey, 20, 10 * 60_000)
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  let slugHint = ''
  try {
    const admin = getSupabaseAdmin()
    const { data: tenant } = await admin
      .from('tenants')
      .select('business_name, domains(hostname, source)')
      .eq('id', tenantId)
      .maybeSingle()
    if (tenant?.business_name) {
      slugHint = String(tenant.business_name)
    }
    const domains = Array.isArray(tenant?.domains) ? tenant.domains : []
    const platform = domains.find(
      (d: { source?: string; hostname?: string }) => d.source === 'platform_subdomain'
    )
    if (platform?.hostname) {
      slugHint = platform.hostname.split('.')[0] || slugHint
    }
  } catch {
    /* ignore */
  }

  try {
    const result = await searchDomainsForLabel({ query: query || slugHint, slugHint })
    return NextResponse.json({ success: true, tenantId, ...result })
  } catch (e) {
    console.error('domain search error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Search failed' },
      { status: 500 }
    )
  }
}
