import { after, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { checkRateLimit, hashRateKey } from '@/lib/rateLimit'
import { revalidateTenantSiteCache } from '@/lib/tenants/revalidateTenantSite'
import { applyContentChanges } from '@/lib/site-content/document'
import { assertSameOriginMutation, loadOwnedSiteContent } from '@/lib/site-content/server'
import type { ContentChange } from '@/lib/site-content/types'
import { mintContentEditorToken } from '@/lib/contentEditorToken'
import { saveValidationReport, validateTenantSite } from '@/lib/validation/siteValidator'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function pageTree(document: Record<string, unknown>, renderMode: 'engine' | 'custom') {
  if (renderMode === 'custom') {
    const custom = document.custom_config as { pages?: Record<string, { title?: string }> } | undefined
    const paths = Object.keys(custom?.pages || {}).sort((a, b) => a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b))
    return paths.map((slug) => ({
      slug,
      title: custom?.pages?.[slug]?.title || (slug === '/' ? 'Home' : slug.split('/').filter(Boolean).at(-1) || 'Page'),
      isActive: true,
      protected: slug === '/',
    }))
  }
  const pages = Array.isArray(document.pages_config) ? document.pages_config : []
  return [
    { slug: '/', title: 'Home', isActive: true, protected: true },
    ...pages.map((page) => {
      const value = (page || {}) as Record<string, unknown>
      return {
        slug: String(value.slug || ''),
        title: String(value.title || 'Untitled page'),
        isActive: value.is_active !== false,
        protected: false,
      }
    }),
  ]
}

async function recentRevisions(tenantId: string) {
  const { data } = await getSupabaseAdmin()
    .from('site_content_revisions')
    .select('id, version, changed_paths, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(10)
  return (data || []).map((row) => ({
    id: row.id,
    version: Number(row.version),
    changedPaths: row.changed_paths || [],
    createdAt: row.created_at,
  }))
}

export async function GET() {
  const loaded = await loadOwnedSiteContent()
  if (!loaded.ok) return NextResponse.json({ error: loaded.error }, { status: loaded.status })
  const value = loaded.value
  return NextResponse.json({
    tenant: value.tenant,
    renderMode: value.renderMode,
    publicUrl: value.publicUrl,
    hostnames: value.hostnames,
    version: value.version,
    document: value.document,
    pageTree: pageTree(value.document as unknown as Record<string, unknown>, value.renderMode),
    editorToken: mintContentEditorToken(value.tenantId, value.actorUserId),
    revisions: await recentRevisions(value.tenantId),
    capabilities: {
      autosave: true,
      revisions: true,
      media: true,
      customHtml: value.renderMode === 'custom',
    },
  })
}

export async function PATCH(req: Request) {
  const loaded = await loadOwnedSiteContent()
  if (!loaded.ok) return NextResponse.json({ error: loaded.error }, { status: loaded.status })
  const value = loaded.value
  if (!assertSameOriginMutation(req, value.hostnames)) {
    return NextResponse.json({ error: 'Cross-site request rejected' }, { status: 403 })
  }
  const limit = await checkRateLimit(hashRateKey('site_content_save', value.actorUserId), 180, 60_000)
  if (!limit.allowed) return NextResponse.json({ error: 'Too many edits. Pause briefly and try again.' }, { status: 429 })

  const body = (await req.json().catch(() => null)) as {
    baseVersion?: unknown
    changes?: ContentChange[]
    idempotencyKey?: unknown
  } | null
  const baseVersion = Number(body?.baseVersion)
  const idempotencyKey = typeof body?.idempotencyKey === 'string' ? body.idempotencyKey : ''
  if (!Number.isInteger(baseVersion) || !idempotencyKey || idempotencyKey.length > 100) {
    return NextResponse.json({ error: 'baseVersion and idempotencyKey are required' }, { status: 400 })
  }
  const admin = getSupabaseAdmin()
  const { data: replay } = await admin
    .from('site_content_idempotency')
    .select('resulting_version')
    .eq('tenant_id', value.tenantId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  if (replay) {
    return NextResponse.json({
      ok: true,
      version: value.version,
      originalVersion: Number(replay.resulting_version),
      document: value.document,
      cacheInvalidated: await revalidateTenantSiteCache(value.tenantId),
      replayed: true,
    })
  }
  if (baseVersion !== value.version) {
    return NextResponse.json({ error: 'Content changed in another session', currentVersion: value.version }, { status: 409 })
  }

  let nextDocument
  try {
    nextDocument = applyContentChanges(value.document, body?.changes || [], value.renderMode)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid content change' }, { status: 400 })
  }
  const changedPaths = [...new Set((body?.changes || []).map((change) => change.path))]
  const { data: nextVersion, error } = await admin.rpc('publish_site_content', {
    p_tenant_id: value.tenantId,
    p_expected_version: value.version,
    p_actor_user_id: value.actorUserId,
    p_idempotency_key: idempotencyKey,
    p_changed_paths: changedPaths,
    p_previous_snapshot: value.document,
    p_document: nextDocument,
  })
  if (error) {
    const conflict = /content_version_conflict/i.test(error.message)
    const forbidden = /site_content_actor_forbidden/i.test(error.message)
    let currentVersion: number | undefined
    if (conflict) {
      const { data: latest } = await admin
        .from('site_configs')
        .select('content_version')
        .eq('tenant_id', value.tenantId)
        .maybeSingle()
      currentVersion = latest ? Number(latest.content_version) : undefined
    }
    return NextResponse.json(
      {
        error: conflict
          ? 'Content changed in another session'
          : forbidden
            ? 'You cannot edit this website'
            : 'Website content could not be saved',
        currentVersion,
      },
      { status: conflict ? 409 : forbidden ? 403 : 500 }
    )
  }

  const cacheInvalidated = await revalidateTenantSiteCache(value.tenantId)
  after(async () => {
    try {
      const report = await validateTenantSite(value.tenantId)
      await saveValidationReport(value.tenantId, report)
    } catch (qualityError) {
      console.warn('[site-content] post-save quality validation failed', qualityError)
    }
  })
  return NextResponse.json({
    ok: true,
    version: Number(nextVersion),
    document: nextDocument,
    cacheInvalidated,
    warnings: cacheInvalidated ? [] : ['The website cache is retrying; the saved content remains safe.'],
  })
}
