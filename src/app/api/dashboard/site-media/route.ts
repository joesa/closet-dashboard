import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { assetPrefix, listTenantMediaAssets, uploadCustomSiteAsset } from '@/lib/customSiteAssets'
import { checkRateLimit, hashRateKey } from '@/lib/rateLimit'
import { prepareContentImageUpload } from '@/lib/site-content/mediaSecurity'
import {
  assertSameOriginMutation,
  collectReferencedUrls,
  loadOwnedSiteContent,
} from '@/lib/site-content/server'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024
export async function GET() {
  const loaded = await loadOwnedSiteContent()
  if (!loaded.ok) return NextResponse.json({ error: loaded.error }, { status: loaded.status })
  try {
    const assets = await listTenantMediaAssets(loaded.value.tenantId, { kind: 'image' })
    const references = [...collectReferencedUrls(loaded.value.document)]
    return NextResponse.json({ assets, references })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not load media' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const loaded = await loadOwnedSiteContent()
  if (!loaded.ok) return NextResponse.json({ error: loaded.error }, { status: loaded.status })
  if (!assertSameOriginMutation(req, loaded.value.hostnames)) {
    return NextResponse.json({ error: 'Cross-site request rejected' }, { status: 403 })
  }
  const limit = await checkRateLimit(hashRateKey('site_media_upload', loaded.value.actorUserId), 60, 60 * 60 * 1000)
  if (!limit.allowed) return NextResponse.json({ error: 'Upload limit reached. Try again later.' }, { status: 429 })
  try {
    const form = await req.formData()
    const file = form.get('file')
    const kind = form.get('kind') === 'logo' ? 'logo' : 'image'
    if (!(file instanceof File) || file.size <= 0) return NextResponse.json({ error: 'file is required' }, { status: 400 })
    if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: 'Images must be under 4MB' }, { status: 413 })
    const prepared = await prepareContentImageUpload({
      buffer: Buffer.from(await file.arrayBuffer()),
      declaredMime: file.type,
      fileName: file.name || (kind === 'logo' ? 'logo.svg' : 'image.jpg'),
      allowSvg: kind === 'logo',
    })
    const asset = await uploadCustomSiteAsset({
      tenantId: loaded.value.tenantId,
      buffer: prepared.buffer,
      fileName: prepared.fileName,
      mime: prepared.mime,
      kindHint: 'image',
    })
    return NextResponse.json({ asset })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Upload failed' }, { status: 400 })
  }
}

export async function DELETE(req: Request) {
  const loaded = await loadOwnedSiteContent()
  if (!loaded.ok) return NextResponse.json({ error: loaded.error }, { status: loaded.status })
  if (!assertSameOriginMutation(req, loaded.value.hostnames)) {
    return NextResponse.json({ error: 'Cross-site request rejected' }, { status: 403 })
  }
  const body = (await req.json().catch(() => null)) as { path?: string; url?: string } | null
  const path = body?.path?.trim() || ''
  const url = body?.url?.trim() || ''
  const tenantPrefix = `${assetPrefix(loaded.value.tenantId)}/`
  if (
    !path.startsWith(tenantPrefix) ||
    path.slice(tenantPrefix.length).includes('..') ||
    /[\\\u0000-\u001f\u007f]/.test(path) ||
    !url
  ) {
    return NextResponse.json({ error: 'Only contractor-uploaded assets can be deleted' }, { status: 400 })
  }
  const referenced = collectReferencedUrls(loaded.value.document)
  const { data: revisions } = await getSupabaseAdmin()
    .from('site_content_revisions')
    .select('snapshot')
    .eq('tenant_id', loaded.value.tenantId)
    .limit(50)
  for (const revision of revisions || []) collectReferencedUrls(revision.snapshot, referenced)
  if (referenced.has(url)) return NextResponse.json({ error: 'This image is still referenced by live content or revision history' }, { status: 409 })
  const { error } = await getSupabaseAdmin().storage.from('site-assets').remove([path])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
