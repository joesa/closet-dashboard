import { NextResponse } from 'next/server'
import { getCurrentAdmin, logAdminAction } from '@/lib/admin'
import { resolveTenantWidget } from '@/lib/resolveTenantWidget'
import {
  normalizeDomainConfig,
  normalizeRoomPricing,
  ROOM_TYPES,
  type DomainConfig,
  type RoomPricing,
} from '@/lib/rooms'
import {
  isWidgetThemeId,
  listWidgetThemesForAdmin,
  resolveWidgetTheme,
} from '@/lib/widgetThemes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
}

const ENGAGEMENT_MODELS = ['quote', 'order', 'booking', 'ticket'] as const
type EngagementModel = (typeof ENGAGEMENT_MODELS)[number]

function isEngagementModel(v: unknown): v is EngagementModel {
  return typeof v === 'string' && (ENGAGEMENT_MODELS as readonly string[]).includes(v)
}

/**
 * Admin engagement tools for one tenant.
 * Quote calculator state mirrors GET /api/settings (what the live widget shows).
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
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status, headers: NO_STORE }
    )
  }
  const { tenant, supabase, widgetId, healedWidgetId } = resolved

  const [{ data: siteConfig }, { data: settings }] = await Promise.all([
    supabase
      .from('site_configs')
      .select('engagement_model')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    supabase
      .from('contractor_settings')
      .select(
        'id, company_name, primary_color_hex, room_pricing, domain_config, tier_names, disabled_default_rooms, disabled_default_finishes, widget_theme_id, updated_at'
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
    { data: customRooms },
    { data: customFinishes },
    { data: addons },
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
    supabase
      .from('contractor_rooms')
      .select('id, name, price_basic, price_standard, price_premium')
      .eq('contractor_id', widgetId)
      .order('created_at', { ascending: true }),
    supabase
      .from('contractor_finishes')
      .select('id, label, description, swatch_hex, tier, sort_order')
      .eq('contractor_id', widgetId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('contractor_addons')
      .select('id, room_type, room_types, name, price')
      .eq('contractor_id', widgetId)
      .order('created_at', { ascending: true }),
  ])

  const disabledDefaultRooms =
    (settings?.disabled_default_rooms as string[] | null) || []
  const disabledDefaultFinishes =
    (settings?.disabled_default_finishes as string[] | null) || []
  const roomPricing = normalizeRoomPricing(settings?.room_pricing)
  const domainConfig = normalizeDomainConfig(settings?.domain_config)
  const tierNamesRaw = settings?.tier_names as
    | { basic?: string; standard?: string; premium?: string }
    | null
  const tierNames = {
    basic: tierNamesRaw?.basic || 'Basic',
    standard: tierNamesRaw?.standard || 'Standard',
    premium: tierNamesRaw?.premium || 'Premium',
  }

  // Same Step 1 list the widget builds (system defaults − disabled + custom).
  const step1Categories = [
    ...ROOM_TYPES.filter((r) => !disabledDefaultRooms.includes(r)).map((name) => ({
      kind: 'default' as const,
      id: name,
      name,
      prices: roomPricing[name],
    })),
    ...(customRooms || []).map((r) => ({
      kind: 'custom' as const,
      id: r.id,
      name: r.name,
      prices: {
        basic: Number(r.price_basic) || 0,
        standard: Number(r.price_standard) || 0,
        premium: Number(r.price_premium) || 0,
      },
    })),
  ]

  return NextResponse.json(
    {
      tenantId,
      businessName: tenant.business_name,
      widgetId,
      healedWidgetId,
      /** Same row the live widget + contractor dashboard should edit. */
      settingsUpdatedAt: settings?.updated_at ?? null,
      engagementModel,
      widgetThemeId: resolveWidgetTheme(
        (settings as { widget_theme_id?: string | null } | null)?.widget_theme_id
      ).id,
      widgetThemes: listWidgetThemesForAdmin(),
      settings: settings
        ? {
            companyName: settings.company_name || '',
            primaryColorHex: settings.primary_color_hex || '#6C47FF',
            roomPricing,
            domainConfig,
            tierNames,
            disabledDefaultRooms,
            disabledDefaultFinishes,
            widgetThemeId: resolveWidgetTheme(
              (settings as { widget_theme_id?: string | null }).widget_theme_id
            ).id,
          }
        : null,
      calculator: {
        step1Categories,
        customRooms: customRooms || [],
        customFinishes: customFinishes || [],
        addons: addons || [],
        systemRoomTypes: [...ROOM_TYPES],
      },
      catalog: {
        menuItems: menuItems || [],
        services: services || [],
        availability: availability || [],
        events: events || [],
      },
    },
    { headers: NO_STORE }
  )
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
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status, headers: NO_STORE }
    )
  }
  const { supabase, widgetId } = resolved
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
      disabledDefaultRooms?: unknown
      disabledDefaultFinishes?: unknown
      widgetThemeId?: unknown
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
    if (Array.isArray(s.disabledDefaultRooms)) {
      patch.disabled_default_rooms = s.disabledDefaultRooms.filter(
        (x): x is string => typeof x === 'string'
      )
    }
    if (Array.isArray(s.disabledDefaultFinishes)) {
      patch.disabled_default_finishes = s.disabledDefaultFinishes.filter(
        (x): x is string => typeof x === 'string'
      )
    }
    if (s.widgetThemeId !== undefined) {
      if (!isWidgetThemeId(s.widgetThemeId)) {
        return NextResponse.json(
          { error: 'Unknown widgetThemeId' },
          { status: 400, headers: NO_STORE }
        )
      }
      const theme = resolveWidgetTheme(s.widgetThemeId)
      patch.widget_theme_id = theme.id
      // Keep accent in sync so legacy readers stay matched to the pack.
      patch.primary_color_hex = theme.brand
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

  // Immediate price/name update for a custom room row.
  if (body.roomUpdate && typeof body.roomUpdate === 'object') {
    const u = body.roomUpdate as {
      id?: string
      name?: string
      price_basic?: number
      price_standard?: number
      price_premium?: number
    }
    if (!u.id) {
      return NextResponse.json({ error: 'roomUpdate.id required' }, { status: 400 })
    }
    const patch: Record<string, unknown> = {}
    if (typeof u.name === 'string' && u.name.trim()) patch.name = u.name.trim()
    if (typeof u.price_basic === 'number') patch.price_basic = u.price_basic
    if (typeof u.price_standard === 'number') patch.price_standard = u.price_standard
    if (typeof u.price_premium === 'number') patch.price_premium = u.price_premium
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'No room fields to update' }, { status: 400 })
    }
    const { error } = await supabase
      .from('contractor_rooms')
      .update(patch)
      .eq('id', u.id)
      .eq('contractor_id', widgetId)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    updates.push('contractor_rooms')
  }

  if (body.addonUpdate && typeof body.addonUpdate === 'object') {
    const u = body.addonUpdate as {
      id?: string
      name?: string
      price?: number
      room_type?: string | null
      room_types?: string[] | null
    }
    if (!u.id) {
      return NextResponse.json({ error: 'addonUpdate.id required' }, { status: 400 })
    }
    const patch: Record<string, unknown> = {}
    if (typeof u.name === 'string') patch.name = u.name.trim()
    if (typeof u.price === 'number') patch.price = u.price
    if (u.room_type !== undefined) patch.room_type = u.room_type
    if (u.room_types !== undefined) patch.room_types = u.room_types
    const { error } = await supabase
      .from('contractor_addons')
      .update(patch)
      .eq('id', u.id)
      .eq('contractor_id', widgetId)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    updates.push('contractor_addons')
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
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status, headers: NO_STORE }
    )
  }
  const { supabase, widgetId } = resolved
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
  } else if (kind === 'room') {
    table = 'contractor_rooms'
    const name = String(data.name || '').trim()
    if (!name) {
      return NextResponse.json({ error: 'Category name required' }, { status: 400 })
    }
    if ((ROOM_TYPES as readonly string[]).includes(name)) {
      return NextResponse.json(
        { error: `"${name}" is a system category — re-enable it instead of duplicating` },
        { status: 400 }
      )
    }
    row = {
      ...row,
      name,
      price_basic: Number(data.price_basic) || 0,
      price_standard: Number(data.price_standard) || 0,
      price_premium: Number(data.price_premium) || 0,
    }
  } else if (kind === 'finish') {
    table = 'contractor_finishes'
    const label = String(data.label || '').trim()
    if (!label) {
      return NextResponse.json({ error: 'Finish label required' }, { status: 400 })
    }
    row = {
      ...row,
      label,
      description: data.description != null ? String(data.description) : null,
      swatch_hex: String(data.swatch_hex || '#A78B6A'),
      tier: ['basic', 'standard', 'premium'].includes(String(data.tier))
        ? String(data.tier)
        : 'standard',
      sort_order: Number(data.sort_order) || 0,
    }
  } else if (kind === 'addon') {
    table = 'contractor_addons'
    const name = String(data.name || '').trim()
    if (!name) {
      return NextResponse.json({ error: 'Add-on name required' }, { status: 400 })
    }
    row = {
      ...row,
      name,
      price: Number(data.price) || 0,
      room_type: data.room_type != null ? String(data.room_type) : 'all',
      room_types: Array.isArray(data.room_types) ? data.room_types : null,
    }
  } else {
    return NextResponse.json(
      {
        error:
          'kind must be menu|service|availability|event|room|finish|addon',
      },
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
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status, headers: NO_STORE }
    )
  }
  const { supabase, widgetId } = resolved
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
            : kind === 'room'
              ? 'contractor_rooms'
              : kind === 'finish'
                ? 'contractor_finishes'
                : kind === 'addon'
                  ? 'contractor_addons'
                  : null

  if (!table) {
    return NextResponse.json(
      {
        error:
          'kind must be menu|service|availability|event|room|finish|addon',
      },
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
