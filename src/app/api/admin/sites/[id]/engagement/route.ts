import { NextResponse } from 'next/server'
import { getCurrentAdmin, logAdminAction } from '@/lib/admin'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  normalizeDomainConfig,
  normalizeRoomPricing,
  type DomainConfig,
  type RoomPricing,
} from '@/lib/rooms'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ENGAGEMENT_MODELS = ['quote', 'order', 'booking', 'ticket'] as const
type EngagementModel = (typeof ENGAGEMENT_MODELS)[number]

function isEngagementModel(v: unknown): v is EngagementModel {
  return typeof v === 'string' && (ENGAGEMENT_MODELS as readonly string[]).includes(v)
}

async function resolveTenantWidget(tenantId: string) {
  const supabase = getSupabaseAdmin()
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('id, business_name, widget_id')
    .eq('id', tenantId)
    .maybeSingle()
  if (error || !tenant) return { error: 'Tenant not found' as const, status: 404 as const }
  if (!tenant.widget_id) {
    return { error: 'Tenant has no widget_id linked' as const, status: 400 as const }
  }
  return { tenant, supabase }
}

/**
 * Admin engagement tools for one tenant.
 *
 * GET  → engagement model + contractor settings + catalog rows
 * PATCH → update engagement_model and/or quote settings
 * POST  → add catalog item (menu / service / availability / event)
 * DELETE → remove catalog item by kind + id
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await getCurrentAdmin()
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: tenantId } = await params
  const resolved = await resolveTenantWidget(tenantId)
  if ('error' in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  }
  const { tenant, supabase } = resolved
  const widgetId = tenant.widget_id as string

  const [{ data: siteConfig }, { data: settings }] = await Promise.all([
    supabase
      .from('site_configs')
      .select('engagement_model')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    supabase
      .from('contractor_settings')
      .select(
        'id, company_name, primary_color_hex, room_pricing, domain_config, tier_names'
      )
      .eq('id', widgetId)
      .maybeSingle(),
  ])

  const engagementModel = isEngagementModel(siteConfig?.engagement_model)
    ? siteConfig!.engagement_model
    : 'quote'

  const [
    { data: menuItems },
    { data: services },
    { data: availability },
    { data: events },
  ] = await Promise.all([
    supabase
      .from('menu_items')
      .select('*')
      .eq('contractor_id', widgetId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('service_catalog')
      .select('*')
      .eq('contractor_id', widgetId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('booking_availability')
      .select('*')
      .eq('contractor_id', widgetId)
      .order('day_of_week', { ascending: true }),
    supabase
      .from('ticket_events')
      .select('*')
      .eq('contractor_id', widgetId)
      .order('event_date', { ascending: true }),
  ])

  return NextResponse.json({
    tenantId,
    businessName: tenant.business_name,
    widgetId,
    engagementModel,
    settings: settings
      ? {
          companyName: settings.company_name || '',
          primaryColorHex: settings.primary_color_hex || '#6C47FF',
          roomPricing: normalizeRoomPricing(settings.room_pricing),
          domainConfig: normalizeDomainConfig(settings.domain_config),
          tierNames: (settings.tier_names as Record<string, string> | null) || {
            basic: 'Basic',
            standard: 'Standard',
            premium: 'Premium',
          },
        }
      : null,
    catalog: {
      menuItems: menuItems || [],
      services: services || [],
      availability: availability || [],
      events: events || [],
    },
  })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await getCurrentAdmin()
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: tenantId } = await params
  const resolved = await resolveTenantWidget(tenantId)
  if ('error' in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  }
  const { tenant, supabase } = resolved
  const widgetId = tenant.widget_id as string
  const body = await req.json().catch(() => ({}))

  const updates: string[] = []

  if (body.engagementModel !== undefined) {
    if (!isEngagementModel(body.engagementModel)) {
      return NextResponse.json(
        { error: 'engagementModel must be quote|order|booking|ticket' },
        { status: 400 }
      )
    }
    const { error } = await supabase
      .from('site_configs')
      .update({ engagement_model: body.engagementModel })
      .eq('tenant_id', tenantId)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    updates.push(`engagement_model=${body.engagementModel}`)
  }

  if (body.settings && typeof body.settings === 'object') {
    const s = body.settings as {
      companyName?: string
      primaryColorHex?: string
      roomPricing?: unknown
      domainConfig?: unknown
      tierNames?: unknown
    }
    const patch: Record<string, unknown> = {}
    if (typeof s.companyName === 'string') patch.company_name = s.companyName
    if (typeof s.primaryColorHex === 'string') patch.primary_color_hex = s.primaryColorHex
    if (s.roomPricing !== undefined) {
      patch.room_pricing = normalizeRoomPricing(s.roomPricing) as RoomPricing
    }
    if (s.domainConfig !== undefined) {
      patch.domain_config = normalizeDomainConfig(s.domainConfig) as DomainConfig
    }
    if (s.tierNames && typeof s.tierNames === 'object') {
      const t = s.tierNames as Record<string, unknown>
      patch.tier_names = {
        basic: typeof t.basic === 'string' ? t.basic : 'Basic',
        standard: typeof t.standard === 'string' ? t.standard : 'Standard',
        premium: typeof t.premium === 'string' ? t.premium : 'Premium',
      }
    }
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase
        .from('contractor_settings')
        .update(patch)
        .eq('id', widgetId)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      updates.push('contractor_settings')
    }
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
  }

  await logAdminAction({
    actor: adminUser,
    action: 'site.engagement_update',
    targetType: 'tenant',
    targetId: tenantId,
    metadata: { updates, widgetId },
  })

  return NextResponse.json({ ok: true, updates })
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await getCurrentAdmin()
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: tenantId } = await params
  const resolved = await resolveTenantWidget(tenantId)
  if ('error' in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  }
  const { supabase } = resolved
  const widgetId = resolved.tenant.widget_id as string
  const body = await req.json().catch(() => ({}))
  const kind = body.kind as string
  const data = (body.data || {}) as Record<string, unknown>

  let table = ''
  let row: Record<string, unknown> = { contractor_id: widgetId }

  if (kind === 'menu') {
    table = 'menu_items'
    row = {
      ...row,
      name: String(data.name || '').trim(),
      description: String(data.description || ''),
      price: Number(data.price) || 0,
      category: String(data.category || 'Menu'),
      available: true,
      sort_order: Number(data.sort_order) || 0,
    }
    if (!row.name) {
      return NextResponse.json({ error: 'Menu item name required' }, { status: 400 })
    }
  } else if (kind === 'service') {
    table = 'service_catalog'
    row = {
      ...row,
      name: String(data.name || '').trim(),
      duration_minutes: Number(data.duration_minutes) || 60,
      price_cents: Number(data.price_cents) || 0,
      sort_order: Number(data.sort_order) || 0,
    }
    if (!row.name) {
      return NextResponse.json({ error: 'Service name required' }, { status: 400 })
    }
  } else if (kind === 'availability') {
    table = 'booking_availability'
    row = {
      ...row,
      day_of_week: Number(data.day_of_week) ?? 1,
      start_time: String(data.start_time || '09:00'),
      end_time: String(data.end_time || '17:00'),
      slot_duration_minutes: Number(data.slot_duration_minutes) || 60,
    }
  } else if (kind === 'event') {
    table = 'ticket_events'
    row = {
      ...row,
      name: String(data.name || '').trim(),
      description: String(data.description || ''),
      event_date: String(data.event_date || ''),
      event_time: String(data.event_time || '19:00'),
      venue: String(data.venue || ''),
      capacity: Number(data.capacity) || 100,
      price_cents: Number(data.price_cents) || 0,
      is_active: true,
    }
    if (!row.name || !row.event_date) {
      return NextResponse.json({ error: 'Event name and date required' }, { status: 400 })
    }
  } else {
    return NextResponse.json(
      { error: 'kind must be menu|service|availability|event' },
      { status: 400 }
    )
  }

  const { data: inserted, error } = await supabase
    .from(table)
    .insert(row)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAdminAction({
    actor: adminUser,
    action: 'site.engagement_catalog_add',
    targetType: 'tenant',
    targetId: tenantId,
    metadata: { kind, id: inserted?.id, widgetId },
  })

  return NextResponse.json({ ok: true, item: inserted })
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await getCurrentAdmin()
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: tenantId } = await params
  const resolved = await resolveTenantWidget(tenantId)
  if ('error' in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status })
  }
  const { supabase } = resolved
  const widgetId = resolved.tenant.widget_id as string
  const body = await req.json().catch(() => ({}))
  const kind = body.kind as string
  const itemId = body.id as string

  if (!itemId) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const table =
    kind === 'menu'
      ? 'menu_items'
      : kind === 'service'
        ? 'service_catalog'
        : kind === 'availability'
          ? 'booking_availability'
          : kind === 'event'
            ? 'ticket_events'
            : null

  if (!table) {
    return NextResponse.json(
      { error: 'kind must be menu|service|availability|event' },
      { status: 400 }
    )
  }

  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', itemId)
    .eq('contractor_id', widgetId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAdminAction({
    actor: adminUser,
    action: 'site.engagement_catalog_delete',
    targetType: 'tenant',
    targetId: tenantId,
    metadata: { kind, id: itemId, widgetId },
  })

  return NextResponse.json({ ok: true })
}
