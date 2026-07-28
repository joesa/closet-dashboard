import { NextResponse } from 'next/server'
import { getCurrentAdmin, logAdminAction } from '@/lib/admin'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  readEditInPlaceToken,
  verifyEditInPlaceToken,
} from '@/lib/editInPlaceToken'
import {
  isCustomSiteConfig,
  normalizeCustomPath,
  sanitizeCustomHtml,
  stripLiveWidgetsToPlaceholder,
  type CustomSiteConfig,
} from '@/lib/customSite'
import { revalidateTenantSiteCache } from '@/lib/tenants/revalidateTenantSite'

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

async function authorizeEdit(
  req: Request,
  tenantId: string
): Promise<{ ok: true; via: 'admin' | 'token' } | { ok: false; status: number; error: string }> {
  const admin = await getCurrentAdmin()
  if (admin) return { ok: true, via: 'admin' }
  const token = readEditInPlaceToken(req)
  if (verifyEditInPlaceToken(token, tenantId)) return { ok: true, via: 'token' }
  return { ok: false, status: 401, error: 'Unauthorized' }
}

/**
 * Persist one page of custom HTML from the edit-in-place editor.
 * Writes custom_config and mirrors into custom_config_draft.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await params
  const headers = corsHeaders(req)
  try {
    const auth = await authorizeEdit(req, tenantId)
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status, headers }
      )
    }

    const body = (await req.json().catch(() => null)) as {
      path?: string
      html?: string
    } | null
    const path = normalizeCustomPath(body?.path || '/')
    const rawHtml = typeof body?.html === 'string' ? body.html : ''
    if (!rawHtml.trim()) {
      return NextResponse.json(
        { error: 'html is required' },
        { status: 400, headers }
      )
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('site_configs')
      .select('edit_in_place, render_mode, custom_config, custom_config_draft')
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (error) throw error
    if (!data) {
      return NextResponse.json(
        { error: 'Site config not found' },
        { status: 404, headers }
      )
    }
    if (!data.edit_in_place) {
      return NextResponse.json(
        { error: 'Edit in place is not enabled for this site' },
        { status: 403, headers }
      )
    }
    if (data.render_mode !== 'custom') {
      return NextResponse.json(
        { error: 'Site is not in custom render mode' },
        { status: 400, headers }
      )
    }
    if (!isCustomSiteConfig(data.custom_config)) {
      return NextResponse.json(
        { error: 'No published custom_config to edit' },
        { status: 400, headers }
      )
    }

    const cleaned = sanitizeCustomHtml(stripLiveWidgetsToPlaceholder(rawHtml))
    const published: CustomSiteConfig = {
      ...data.custom_config,
      pages: {
        ...(data.custom_config.pages || {}),
        [path]: {
          ...(data.custom_config.pages?.[path] || {}),
          html: cleaned,
        },
      },
    }

    const draftBase: CustomSiteConfig = isCustomSiteConfig(data.custom_config_draft)
      ? data.custom_config_draft
      : { ...published }
    const draft: CustomSiteConfig = {
      ...draftBase,
      pages: {
        ...(draftBase.pages || {}),
        [path]: {
          ...(draftBase.pages?.[path] || published.pages[path]),
          html: cleaned,
        },
      },
    }

    const { error: upErr } = await supabase
      .from('site_configs')
      .update({
        custom_config: published,
        custom_config_draft: draft,
        custom_updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
    if (upErr) throw upErr

    const admin = await getCurrentAdmin()
    if (admin) {
      await logAdminAction({
        actor: admin,
        action: 'site.edit_in_place.save',
        targetType: 'tenant',
        targetId: tenantId,
        metadata: { path, via: auth.via },
      })
    }

    try {
      await revalidateTenantSiteCache(tenantId)
    } catch (e) {
      console.warn('edit-in-place save revalidate failed', e)
    }

    return NextResponse.json({ ok: true, path }, { headers })
  } catch (error) {
    console.error('edit-in-place save error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save' },
      { status: 500, headers }
    )
  }
}
