import { NextResponse } from 'next/server'
import { actorTenantId, listDomainsForTenant, resolveDomainActor } from '@/lib/domains/auth'
import { checkRateLimit, hashRateKey } from '@/lib/rateLimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/domains?tenantId= — list domains for contractor's site or admin-selected tenant. */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const tenantIdParam = url.searchParams.get('tenantId')

  const resolved = await resolveDomainActor({ tenantId: tenantIdParam })
  if ('error' in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  }

  const tenantId = actorTenantId(resolved)
  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId is required' }, { status: 400 })
  }

  const rateKey = hashRateKey(
    'domains-list',
    resolved.actor.role === 'admin' ? resolved.actor.adminId : resolved.actor.userId
  )
  const rate = await checkRateLimit(rateKey, 60, 60_000)
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    const domains = await listDomainsForTenant(tenantId)
    return NextResponse.json({ tenantId, domains })
  } catch (e) {
    console.error('list domains error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to list domains' },
      { status: 500 }
    )
  }
}
