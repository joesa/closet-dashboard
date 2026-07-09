import { NextResponse } from 'next/server'
import { actorTenantId, resolveDomainActor } from '@/lib/domains/auth'
import { purchaseDomainForTenant } from '@/lib/domains/purchase'
import { checkRateLimit, hashRateKey } from '@/lib/rateLimit'
import { logAdminAction } from '@/lib/admin'
import { formatUsdCents } from '@/lib/domains/types'

export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * POST /api/domains/purchase — platform buys via Vercel Registrar.
 * Cost is folded into hosting/maintenance (no Stripe charge here).
 */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    /* empty */
  }

  const domain = typeof body.domain === 'string' ? body.domain : ''
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
    'domains-purchase',
    resolved.actor.role === 'admin' ? resolved.actor.adminId : resolved.actor.userId
  )
  const rate = await checkRateLimit(rateKey, 5, 60 * 60_000)
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many purchase attempts. Try again later.' }, { status: 429 })
  }

  try {
    const result = await purchaseDomainForTenant({ tenantId, domainInput: domain })
    if (resolved.actor.role === 'admin') {
      await logAdminAction({
        actor: { id: resolved.actor.adminId, email: resolved.actor.email },
        action: 'domain.purchase',
        targetType: 'tenant',
        targetId: tenantId,
        metadata: {
          hostname: result.domain.hostname,
          wholesaleCents: result.wholesaleCents,
          orderId: result.orderId,
        },
      })
    }
    return NextResponse.json({
      success: true,
      domain: result.domain,
      orderId: result.orderId,
      wholesaleCents: result.wholesaleCents,
      wholesaleLabel: formatUsdCents(result.wholesaleCents),
      nameservers: result.nameservers,
      billingNote:
        'Domain registration is included with hosting — platform cost is covered by site maintenance.',
    })
  } catch (e) {
    console.error('domain purchase error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Purchase failed' },
      { status: 400 }
    )
  }
}
