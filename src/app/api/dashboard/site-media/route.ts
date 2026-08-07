import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { assetPrefix, listTenantMediaAssets, uploadCustomSiteAsset } from '@/lib/customSiteAssets'
import { checkRateLimit, hashRateKey } from '@/lib/rateLimit'
import {
  assertSameOriginMutation,
  collectReferencedUrls,
  loadOwnedSiteContent,
} from '@/lib/site-content/server'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024
const RASTER_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function sanitizeSvg(source: string): string {
  const cleaned = source
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, '')
    .replace(/<foreignObject\b[\s\S]*?<\/foreignObject\s*>/gi, '')
    .replace(/<(?:iframe|object|embed)\b[\s\S]*?<\/(?:iframe|object|embed)\s*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\sstyle\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/\s(?:href|xlink:href)\s*=\s*(['"])\s*(?:javascript:|https?:)[^'"]*\1/gi, '')
  if (!/<svg[\s>]/i.test(cleaned)) throw new Error('Invalid SVG logo')
  return cleaned
}

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
    if (!RASTER_MIMES.has(file.type) && !(kind === 'logo' && file.type === 'image/svg+xml')) {
      return NextResponse.json({ error: 'Use JPEG, PNG, WebP, or SVG for logos' }, { status: 415 })
    }
    let buffer = Buffer.from(await file.arrayBuffer())
    if (file.type === 'image/svg+xml') buffer = Buffer.from(sanitizeSvg(buffer.toString('utf8')), 'utf8')
    const asset = await uploadCustomSiteAsset({
      tenantId: loaded.value.tenantId,
      buffer,
      fileName: file.name || (kind === 'logo' ? 'logo.svg' : 'image.jpg'),
      mime: file.type,
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
  if (!path.startsWith(`${assetPrefix(loaded.value.tenantId)}/`) || !url) {
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
