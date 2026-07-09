import { NextResponse } from 'next/server'
import { actorTenantId, resolveDomainActor } from '@/lib/domains/auth'
import { attachByoDomain } from '@/lib/domains/manage'
import { checkRateLimit, hashRateKey } from '@/lib/rateLimit'
import { logAdminAction } from '@/lib/admin'

export const runtime = 'nodejs'
export const maxDuration = 60

/** POST /api/domains/byo — attach a bring-your-own domain. */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    /* empty */
  }

  const hostname = typeof body.hostname === 'string' ? body.hostname : ''
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
    'domains-byo',
    resolved.actor.role === 'admin' ? resolved.actor.adminId : resolved.actor.userId
  )
  const rate = await checkRateLimit(rateKey, 10, 10 * 60_000)
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many requests. Try again shortly.' }, { status: 429 })
  }

  try {
    const result = await attachByoDomain({ tenantId, hostnameInput: hostname })
    if (resolved.actor.role === 'admin') {
      await logAdminAction({
        actor: { id: resolved.actor.adminId, email: resolved.actor.email },
        action: 'domain.byo_attach',
        targetType: 'tenant',
        targetId: tenantId,
        metadata: { hostname: result.domain.hostname },
      })
    }
    return NextResponse.json({
      success: true,
      domain: result.domain,
      dnsInstructions: result.dnsInstructions,
      vercel: result.vercel,
    })
  } catch (e) {
    console.error('byo domain error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to attach domain' },
      { status: 400 }
    )
  }
}
