import { NextResponse } from 'next/server'
import { getCurrentAdmin, logAdminAction } from '@/lib/admin'
import {
  appendAssetToDraftPage,
  applyVideoUrlToHomeDraft,
  createCustomSiteAssetUpload,
  listTenantMediaAssets,
  mediaCounts,
  uploadCustomSiteAsset,
  type CustomAssetKind,
} from '@/lib/customSiteAssets'

export const maxDuration = 60
export const runtime = 'nodejs'

/**
 * Tenant media library.
 * GET  → list CDN assets (filter ?kind=image|video|file|all, ?engine=0 to skip provisioned)
 * POST → upload / sign / apply into custom draft
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await params
  try {
    const adminUser = await getCurrentAdmin()
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const kindRaw = (searchParams.get('kind') || 'all').trim().toLowerCase()
    const kind =
      kindRaw === 'image' || kindRaw === 'video' || kindRaw === 'file' || kindRaw === 'all'
        ? kindRaw
        : 'all'
    const includeEngine = searchParams.get('engine') !== '0'

    const assets = await listTenantMediaAssets(tenantId, { kind, includeEngine })
    const allForCounts = kind === 'all'
      ? assets
      : await listTenantMediaAssets(tenantId, { kind: 'all', includeEngine })

    return NextResponse.json({
      kind,
      counts: mediaCounts(allForCounts),
      assets,
      /** Convenience: just the public CDN URLs for the current filter. */
      urls: assets.map((a) => a.url),
    })
  } catch (error) {
    console.error('custom-assets GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list assets' },
      { status: 500 }
    )
  }
}

async function applyAssetUrl(opts: {
  tenantId: string
  apply: string
  url: string
  kind: CustomAssetKind
  label: string
}): Promise<string | null> {
  const { tenantId, apply, url, kind, label } = opts
  if (apply === 'video_home') {
    await applyVideoUrlToHomeDraft(tenantId, url)
    return 'video_home'
  }
  if (apply === 'append_home') {
    await appendAssetToDraftPage({
      tenantId,
      pagePath: '/',
      url,
      kind,
      label,
    })
    return 'append_home'
  }
  if (apply.startsWith('append:')) {
    const pagePath = apply.slice('append:'.length) || '/'
    await appendAssetToDraftPage({
      tenantId,
      pagePath,
      url,
      kind,
      label,
    })
    return `append:${pagePath}`
  }
  return null
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await params
  try {
    const adminUser = await getCurrentAdmin()
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const contentType = req.headers.get('content-type') || ''

    // JSON: sign a direct upload, or apply an existing CDN URL into the draft.
    if (contentType.includes('application/json')) {
      const body = (await req.json().catch(() => ({}))) as {
        action?: string
        url?: string
        apply?: string
        kind?: CustomAssetKind | 'auto'
        label?: string
        fileName?: string
        mime?: string
        size?: number
        path?: string
      }

      if (body.action === 'sign') {
        const fileName = String(body.fileName || 'upload').slice(0, 160)
        const mime = String(body.mime || 'application/octet-stream')
        const size = typeof body.size === 'number' ? body.size : 0
        const kindHint =
          body.kind === 'video' || body.kind === 'image' || body.kind === 'file'
            ? body.kind
            : undefined
        const signed = await createCustomSiteAssetUpload({
          tenantId,
          fileName,
          mime,
          size,
          kindHint,
        })
        return NextResponse.json({
          upload: {
            signedUrl: signed.signedUrl,
            token: signed.token,
            path: signed.path,
            publicUrl: signed.publicUrl,
            contentType: signed.contentType,
            kind: signed.kind,
            name: signed.name,
          },
        })
      }

      if (body.action === 'complete') {
        // After direct PUT to Supabase — optionally apply into draft.
        if (!body.url?.trim() || !body.path?.trim()) {
          return NextResponse.json(
            { error: 'complete requires url and path' },
            { status: 400 }
          )
        }
        const kind: CustomAssetKind =
          body.kind === 'video' || body.kind === 'image' || body.kind === 'file'
            ? body.kind
            : 'file'
        const apply = String(body.apply || 'none').trim()
        const label = String(body.label || 'Asset').slice(0, 120)
        const applied = await applyAssetUrl({
          tenantId,
          apply,
          url: body.url.trim(),
          kind,
          label,
        })
        await logAdminAction({
          actor: adminUser,
          action: 'site.custom_asset_upload',
          targetType: 'tenant',
          targetId: tenantId,
          metadata: {
            path: body.path.trim(),
            kind,
            size: typeof body.size === 'number' ? body.size : null,
            applied,
            direct: true,
          },
        })
        return NextResponse.json({
          asset: {
            name: label,
            path: body.path.trim(),
            url: body.url.trim(),
            size: typeof body.size === 'number' ? body.size : null,
            contentType: body.mime || null,
            kind,
            updatedAt: new Date().toISOString(),
          },
          applied,
        })
      }

      if (body.action === 'apply') {
        if (!body.url?.trim()) {
          return NextResponse.json(
            { error: 'apply requires url' },
            { status: 400 }
          )
        }
        const apply = String(body.apply || 'none').trim()
        const kind: CustomAssetKind =
          body.kind === 'video' || body.kind === 'image' || body.kind === 'file'
            ? body.kind
            : 'file'
        const label = String(body.label || 'Asset').slice(0, 120)
        const applied = await applyAssetUrl({
          tenantId,
          apply,
          url: body.url.trim(),
          kind,
          label,
        })
        await logAdminAction({
          actor: adminUser,
          action: 'site.custom_asset_apply',
          targetType: 'tenant',
          targetId: tenantId,
          metadata: { url: body.url.trim(), kind, applied },
        })
        return NextResponse.json({ applied, url: body.url.trim() })
      }

      return NextResponse.json(
        { error: 'Unknown action. Use sign | complete | apply' },
        { status: 400 }
      )
    }

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }

    const kindHintRaw = String(form.get('kind') || '').trim()
    const kindHint =
      kindHintRaw === 'video' || kindHintRaw === 'image' || kindHintRaw === 'file'
        ? (kindHintRaw as CustomAssetKind)
        : undefined

    const apply = String(form.get('apply') || 'none').trim()
    // apply: none | video_home | append_home | append:<path>
    const label = String(form.get('label') || file.name || 'Asset').slice(0, 120)

    const buffer = Buffer.from(await file.arrayBuffer())
    const mime = file.type || 'application/octet-stream'

    const asset = await uploadCustomSiteAsset({
      tenantId,
      buffer,
      fileName: file.name || 'upload',
      mime,
      kindHint,
    })

    const applied = await applyAssetUrl({
      tenantId,
      apply,
      url: asset.url,
      kind: asset.kind,
      label,
    })

    await logAdminAction({
      actor: adminUser,
      action: 'site.custom_asset_upload',
      targetType: 'tenant',
      targetId: tenantId,
      metadata: {
        path: asset.path,
        kind: asset.kind,
        size: asset.size,
        applied,
      },
    })

    return NextResponse.json({ asset, applied })
  } catch (error) {
    console.error('custom-assets POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
