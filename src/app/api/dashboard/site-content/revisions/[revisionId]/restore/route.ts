import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { revalidateTenantSiteCache } from '@/lib/tenants/revalidateTenantSite'
import { normalizeAndValidateDocument } from '@/lib/site-content/document'
import { assertSameOriginMutation, loadOwnedSiteContent } from '@/lib/site-content/server'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ revisionId: string }> }
) {
  if (!assertSameOriginMutation(req)) return NextResponse.json({ error: 'Cross-site request rejected' }, { status: 403 })
  const loaded = await loadOwnedSiteContent()
  if (!loaded.ok) return NextResponse.json({ error: loaded.error }, { status: loaded.status })
  const { revisionId } = await params
  const admin = getSupabaseAdmin()
  const { data: revision, error } = await admin
    .from('site_content_revisions')
    .select('id, snapshot')
    .eq('id', revisionId)
    .eq('tenant_id', loaded.value.tenantId)
    .maybeSingle()
  if (error || !revision) return NextResponse.json({ error: 'Revision not found' }, { status: 404 })

  let target
  try {
    target = normalizeAndValidateDocument(revision.snapshot, loaded.value.renderMode)
  } catch (validationError) {
    return NextResponse.json({ error: validationError instanceof Error ? validationError.message : 'Revision is invalid' }, { status: 400 })
  }
  const { data: version, error: restoreError } = await admin.rpc('publish_site_content', {
    p_tenant_id: loaded.value.tenantId,
    p_expected_version: loaded.value.version,
    p_actor_user_id: loaded.value.actorUserId,
    p_idempotency_key: `restore:${revisionId}:${crypto.randomUUID()}`,
    p_changed_paths: ['/*restore*'],
    p_previous_snapshot: loaded.value.document,
    p_document: target,
  })
  if (restoreError) return NextResponse.json({ error: restoreError.message }, { status: 409 })
  const cacheInvalidated = await revalidateTenantSiteCache(loaded.value.tenantId)
  return NextResponse.json({ ok: true, version: Number(version), document: target, cacheInvalidated })
}

