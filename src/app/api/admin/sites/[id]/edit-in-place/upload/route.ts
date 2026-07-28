import { NextResponse } from 'next/server'
import { getCurrentAdmin, logAdminAction } from '@/lib/admin'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  readEditInPlaceToken,
  verifyEditInPlaceToken,
} from '@/lib/editInPlaceToken'
import { uploadCustomSiteAsset } from '@/lib/customSiteAssets'

function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get('origin') || '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Edit-In-Place-Token',
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  }
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) })
}

/**
 * Upload an image while edit-in-place is active (admin session or edit token).
 * multipart: file
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await params
  const headers = corsHeaders(req)
  try {
    const admin = await getCurrentAdmin()
    const token = readEditInPlaceToken(req)
    const tokenOk = verifyEditInPlaceToken(token, tenantId)
    if (!admin && !tokenOk) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers })
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('site_configs')
      .select('edit_in_place, render_mode')
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (error) throw error
    if (!data?.edit_in_place || data.render_mode !== 'custom') {
      return NextResponse.json(
        { error: 'Edit in place is not enabled' },
        { status: 403, headers }
      )
    }

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'file is required' },
        { status: 400, headers }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const uploaded = await uploadCustomSiteAsset({
      tenantId,
      buffer,
      fileName: file.name || 'upload.jpg',
      mime: file.type || 'application/octet-stream',
      kindHint: 'image',
    })

    if (admin) {
      await logAdminAction({
        actor: admin,
        action: 'site.edit_in_place.upload',
        targetType: 'tenant',
        targetId: tenantId,
        metadata: { url: uploaded.url },
      })
    }

    return NextResponse.json({ url: uploaded.url }, { headers })
  } catch (error) {
    console.error('edit-in-place upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500, headers }
    )
  }
}
