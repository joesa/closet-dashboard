import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { revalidateTenantSiteCache } from '@/lib/tenants/revalidateTenantSite'
import { applyContentChanges, normalizeAndValidateDocument } from '@/lib/site-content/document'
import { restoreDocumentChanges } from '@/lib/site-content/editorChanges'
import { assertSameOriginMutation, loadOwnedSiteContent } from '@/lib/site-content/server'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ revisionId: string }> }
) {
  const loaded = await loadOwnedSiteContent()
  if (!loaded.ok) return NextResponse.json({ error: loaded.error }, { status: loaded.status })
  if (!assertSameOriginMutation(req, loaded.value.hostnames)) {
    return NextResponse.json({ error: 'Cross-site request rejected' }, { status: 403 })
  }
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
    const snapshot = normalizeAndValidateDocument(revision.snapshot, loaded.value.renderMode)
    target = loaded.value.renderMode === 'custom'
      ? applyContentChanges(
          loaded.value.document,
          restoreDocumentChanges(snapshot, 'custom'),
          'custom',
          // Rolling back to an earlier version is a deliberate act, and the
          // most likely reason to do it is undoing a deletion. The guard must
          // not block the very recovery it exists to make possible, and the
          // snapshot already carries every page's chrome as it was.
          { allowContentLoss: true, propagateSharedChrome: false }
        )
      : snapshot
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
  if (restoreError) {
    const conflict = /content_version_conflict/i.test(restoreError.message)
    const forbidden = /site_content_actor_forbidden/i.test(restoreError.message)
    return NextResponse.json(
      {
        error: conflict
          ? 'Content changed in another session'
          : forbidden
            ? 'You cannot edit this website'
            : 'Website revision could not be restored',
      },
      { status: conflict ? 409 : forbidden ? 403 : 500 }
    )
  }
  const cacheInvalidated = await revalidateTenantSiteCache(loaded.value.tenantId)
  return NextResponse.json({ ok: true, version: Number(version), document: target, cacheInvalidated })
}
