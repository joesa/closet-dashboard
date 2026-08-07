import { NextResponse } from 'next/server'
import { revalidateTenantSiteCache } from '@/lib/tenants/revalidateTenantSite'
import { assertSameOriginMutation, loadOwnedSiteContent } from '@/lib/site-content/server'

export async function POST(req: Request) {
  const loaded = await loadOwnedSiteContent()
  if (!loaded.ok) return NextResponse.json({ error: loaded.error }, { status: loaded.status })
  if (!assertSameOriginMutation(req, loaded.value.hostnames)) {
    return NextResponse.json({ error: 'Cross-site request rejected' }, { status: 403 })
  }
  const cacheInvalidated = await revalidateTenantSiteCache(loaded.value.tenantId)
  return NextResponse.json({ cacheInvalidated }, { status: cacheInvalidated ? 200 : 503 })
}
