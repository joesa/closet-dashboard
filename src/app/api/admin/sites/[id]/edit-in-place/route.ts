import { NextResponse } from 'next/server'
import { getCurrentAdmin, logAdminAction } from '@/lib/admin'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { mintEditInPlaceToken } from '@/lib/editInPlaceToken'
import { revalidateTenantSiteCache } from '@/lib/tenants/revalidateTenantSite'

function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get('origin') || '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
 * Toggle edit-in-place for a tenant custom site.
 * GET  → { enabled, renderMode, editToken? }
 * POST → { enabled: boolean }
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await params
  const headers = corsHeaders(req)
  try {
    const adminUser = await getCurrentAdmin()
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers })
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('site_configs')
      .select('edit_in_place, render_mode')
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (error) throw error

    const enabled = Boolean(data?.edit_in_place)
    const renderMode = data?.render_mode === 'custom' ? 'custom' : 'engine'
    let editToken: string | null = null
    if (enabled && renderMode === 'custom') {
      try {
        editToken = mintEditInPlaceToken(tenantId)
      } catch {
        editToken = null
      }
    }

    return NextResponse.json(
      { enabled, renderMode, editToken },
      { headers }
    )
  } catch (error) {
    console.error('edit-in-place GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500, headers }
    )
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await params
  const headers = corsHeaders(req)
  try {
    const adminUser = await getCurrentAdmin()
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers })
    }

    const body = (await req.json().catch(() => null)) as {
      enabled?: boolean
    } | null
    const enabled = Boolean(body?.enabled)

    const supabase = getSupabaseAdmin()
    const { data: row, error: loadErr } = await supabase
      .from('site_configs')
      .select('render_mode')
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (loadErr) throw loadErr
    if (!row) {
      return NextResponse.json(
        { error: 'Site config not found' },
        { status: 404, headers }
      )
    }

    if (enabled && row.render_mode !== 'custom') {
      return NextResponse.json(
        {
          error:
            'Edit in place requires a published custom site (render_mode=custom). Publish a custom build first.',
        },
        { status: 400, headers }
      )
    }

    const { error: upErr } = await supabase
      .from('site_configs')
      .update({
        edit_in_place: enabled,
        // Stamped so the renderer can expire an edit session nobody closed.
        edit_in_place_started_at: enabled ? new Date().toISOString() : null,
        custom_updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
    if (upErr) throw upErr

    await logAdminAction({
      actor: adminUser,
      action: enabled ? 'site.edit_in_place.enable' : 'site.edit_in_place.disable',
      targetType: 'tenant',
      targetId: tenantId,
    })

    try {
      await revalidateTenantSiteCache(tenantId)
    } catch (e) {
      console.warn('edit-in-place revalidate failed', e)
    }

    let editToken: string | null = null
    if (enabled) {
      try {
        editToken = mintEditInPlaceToken(tenantId)
      } catch {
        editToken = null
      }
    }

    return NextResponse.json(
      { enabled, renderMode: 'custom', editToken },
      { headers }
    )
  } catch (error) {
    console.error('edit-in-place POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500, headers }
    )
  }
}
