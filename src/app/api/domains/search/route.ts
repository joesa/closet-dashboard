import { NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/admin'
import { actorTenantId, resolveDomainActor } from '@/lib/domains/auth'
import { searchDomainsForLabel } from '@/lib/domains/purchase'
import { checkRateLimit, hashRateKey } from '@/lib/rateLimit'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getSupabaseServer } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * POST /api/domains/search — availability for .com/.net/.io suggestions.
 * - Contractor / admin with tenant: scoped search
 * - Admin without tenant (sandbox onboarding): allowWithoutTenant + admin session
 */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    /* empty */
  }

  const query = typeof body.query === 'string' ? body.query : ''
  const tenantIdParam = typeof body.tenantId === 'string' ? body.tenantId : null
  const allowWithoutTenant = body.allowWithoutTenant === true

  let rateActorId = 'anon'
  let tenantId: string | null = null
  let slugHint = ''

  if (allowWithoutTenant) {
    const adminUser = await getCurrentAdmin()
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    rateActorId = adminUser.id
  } else {
    const resolved = await resolveDomainActor({ tenantId: tenantIdParam })
    if ('error' in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status })
    }
    tenantId = actorTenantId(resolved)
    rateActorId =
      resolved.actor.role === 'admin' ? resolved.actor.adminId : resolved.actor.userId

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
  }

  // Ensure we still have a session for non-admin allowWithoutTenant misuse
  if (allowWithoutTenant) {
    const supabase = await getSupabaseServer()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const rate = await checkRateLimit(hashRateKey('domains-search', rateActorId), 20, 10 * 60_000)
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
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
