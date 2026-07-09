import { NextResponse } from 'next/server'
import { actorTenantId, resolveDomainActor } from '@/lib/domains/auth'
import { checkDomainVerification } from '@/lib/domains/manage'
import { checkRateLimit, hashRateKey } from '@/lib/rateLimit'

export const runtime = 'nodejs'
export const maxDuration = 60

type Ctx = { params: Promise<{ id: string }> }

/** POST /api/domains/[id]/check — refresh Vercel verification for a domain. */
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params
  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    /* empty */
  }

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
    'domains-check',
    resolved.actor.role === 'admin' ? resolved.actor.adminId : resolved.actor.userId
  )
  const rate = await checkRateLimit(rateKey, 30, 10 * 60_000)
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    const result = await checkDomainVerification(tenantId, id)
    return NextResponse.json({
      success: true,
      domain: result.domain,
      dnsInstructions: result.dnsInstructions,
      verified: result.verified,
    })
  } catch (e) {
    console.error('domain check error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Check failed' },
      { status: 400 }
    )
  }
}
