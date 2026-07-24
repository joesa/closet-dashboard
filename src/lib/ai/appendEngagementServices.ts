import type { SupabaseClient } from '@supabase/supabase-js'

export type EngagementModel = 'quote' | 'order' | 'booking' | 'ticket' | string

export type AppendEngagementService = {
  title: string
  description?: string
}

export type AppendEngagementResult = {
  appended: string[]
  skipped: string[]
  warnings: string[]
}

function norm(name: string): string {
  return name.trim().toLowerCase()
}

const DEFAULT_TIERS = { basic: 45, standard: 65, premium: 110 }

/**
 * Append brief-introduced services into the engagement engine tables.
 * Never deletes existing rows — only inserts missing names.
 */
export async function appendEngagementServices(opts: {
  supabase: SupabaseClient
  tenantId: string
  /** contractor_settings / widget id — usually tenants.widget_id */
  contractorId: string
  engagementModel?: EngagementModel | null
  services: AppendEngagementService[]
}): Promise<AppendEngagementResult> {
  const warnings: string[] = []
  const appended: string[] = []
  const skipped: string[] = []
  const services = (opts.services || []).filter(
    (s) => typeof s.title === 'string' && s.title.trim()
  )
  if (!services.length || !opts.contractorId) {
    return { appended, skipped, warnings }
  }

  const model = (opts.engagementModel || 'quote').toLowerCase()

  try {
    if (model === 'booking') {
      return await appendBooking(opts.supabase, opts.contractorId, services, warnings)
    }
    if (model === 'order') {
      return await appendOrder(opts.supabase, opts.contractorId, services, warnings)
    }
    if (model === 'ticket') {
      return await appendTicket(opts.supabase, opts.contractorId, services, warnings)
    }
    return await appendQuote(opts.supabase, opts.contractorId, services, warnings)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    warnings.push(`Engagement engine service sync failed: ${message}`)
    return { appended, skipped: services.map((s) => s.title.trim()), warnings }
  }
}

async function appendQuote(
  supabase: SupabaseClient,
  contractorId: string,
  services: AppendEngagementService[],
  warnings: string[]
): Promise<AppendEngagementResult> {
  const appended: string[] = []
  const skipped: string[] = []
  const { data: existing, error } = await supabase
    .from('contractor_rooms')
    .select('name, price_basic, price_standard, price_premium')
    .eq('contractor_id', contractorId)
  if (error) {
    warnings.push(`Could not read contractor_rooms: ${error.message}`)
    return { appended, skipped: services.map((s) => s.title.trim()), warnings }
  }
  const rows = existing || []
  const existingNames = new Set(
    rows.map((r) => norm(typeof r.name === 'string' ? r.name : '')).filter(Boolean)
  )
  const tiers = averageTiers(rows)

  const toInsert = []
  for (const s of services) {
    const title = s.title.trim()
    if (existingNames.has(norm(title))) {
      skipped.push(title)
      continue
    }
    existingNames.add(norm(title))
    toInsert.push({
      contractor_id: contractorId,
      name: title,
      price_basic: tiers.basic,
      price_standard: tiers.standard,
      price_premium: tiers.premium,
    })
    appended.push(title)
  }
  if (toInsert.length) {
    const { error: insErr } = await supabase.from('contractor_rooms').insert(toInsert)
    if (insErr) {
      warnings.push(`Failed to insert contractor_rooms: ${insErr.message}`)
      return { appended: [], skipped: [...skipped, ...appended], warnings }
    }
  }
  return { appended, skipped, warnings }
}

async function appendBooking(
  supabase: SupabaseClient,
  contractorId: string,
  services: AppendEngagementService[],
  warnings: string[]
): Promise<AppendEngagementResult> {
  const appended: string[] = []
  const skipped: string[] = []
  const { data: existing, error } = await supabase
    .from('service_catalog')
    .select('name, price_cents, sort_order')
    .eq('contractor_id', contractorId)
  if (error) {
    warnings.push(`Could not read service_catalog: ${error.message}`)
    return { appended, skipped: services.map((s) => s.title.trim()), warnings }
  }
  const rows = existing || []
  const existingNames = new Set(
    rows.map((r) => norm(typeof r.name === 'string' ? r.name : '')).filter(Boolean)
  )
  const avgCents =
    rows.length > 0
      ? Math.round(
          rows.reduce((sum, r) => sum + (Number(r.price_cents) || 0), 0) / rows.length
        )
      : DEFAULT_TIERS.standard * 100
  const maxSort = rows.reduce(
    (m, r) => Math.max(m, typeof r.sort_order === 'number' ? r.sort_order : 0),
    0
  )

  const toInsert = []
  let sort = maxSort + 1
  for (const s of services) {
    const title = s.title.trim()
    if (existingNames.has(norm(title))) {
      skipped.push(title)
      continue
    }
    existingNames.add(norm(title))
    toInsert.push({
      contractor_id: contractorId,
      name: title,
      duration_minutes: 60,
      price_cents: avgCents,
      sort_order: sort++,
    })
    appended.push(title)
  }
  if (toInsert.length) {
    const { error: insErr } = await supabase.from('service_catalog').insert(toInsert)
    if (insErr) {
      warnings.push(`Failed to insert service_catalog: ${insErr.message}`)
      return { appended: [], skipped: [...skipped, ...appended], warnings }
    }
  }
  return { appended, skipped, warnings }
}

async function appendOrder(
  supabase: SupabaseClient,
  contractorId: string,
  services: AppendEngagementService[],
  warnings: string[]
): Promise<AppendEngagementResult> {
  const appended: string[] = []
  const skipped: string[] = []
  const { data: existing, error } = await supabase
    .from('menu_items')
    .select('name, price, sort_order')
    .eq('contractor_id', contractorId)
  if (error) {
    warnings.push(`Could not read menu_items: ${error.message}`)
    return { appended, skipped: services.map((s) => s.title.trim()), warnings }
  }
  const rows = existing || []
  const existingNames = new Set(
    rows.map((r) => norm(typeof r.name === 'string' ? r.name : '')).filter(Boolean)
  )
  const avgPrice =
    rows.length > 0
      ? Math.round(
          (rows.reduce((sum, r) => sum + (Number(r.price) || 0), 0) / rows.length) * 100
        ) / 100
      : DEFAULT_TIERS.standard
  const maxSort = rows.reduce(
    (m, r) => Math.max(m, typeof r.sort_order === 'number' ? r.sort_order : 0),
    0
  )

  const toInsert = []
  let sort = maxSort + 1
  for (const s of services) {
    const title = s.title.trim()
    if (existingNames.has(norm(title))) {
      skipped.push(title)
      continue
    }
    existingNames.add(norm(title))
    toInsert.push({
      contractor_id: contractorId,
      name: title,
      category: 'Services',
      price: avgPrice,
      sort_order: sort++,
    })
    appended.push(title)
  }
  if (toInsert.length) {
    const { error: insErr } = await supabase.from('menu_items').insert(toInsert)
    if (insErr) {
      warnings.push(`Failed to insert menu_items: ${insErr.message}`)
      return { appended: [], skipped: [...skipped, ...appended], warnings }
    }
  }
  return { appended, skipped, warnings }
}

async function appendTicket(
  supabase: SupabaseClient,
  contractorId: string,
  services: AppendEngagementService[],
  warnings: string[]
): Promise<AppendEngagementResult> {
  const appended: string[] = []
  const skipped: string[] = []
  const { data: existing, error } = await supabase
    .from('ticket_events')
    .select('name, price_cents')
    .eq('contractor_id', contractorId)
  if (error) {
    warnings.push(`Could not read ticket_events: ${error.message}`)
    return { appended, skipped: services.map((s) => s.title.trim()), warnings }
  }
  const rows = existing || []
  const existingNames = new Set(
    rows.map((r) => norm(typeof r.name === 'string' ? r.name : '')).filter(Boolean)
  )
  const avgCents =
    rows.length > 0
      ? Math.round(
          rows.reduce((sum, r) => sum + (Number(r.price_cents) || 0), 0) / rows.length
        )
      : DEFAULT_TIERS.standard * 100

  const nextMonth = new Date()
  nextMonth.setMonth(nextMonth.getMonth() + 1)
  const eventDate = nextMonth.toISOString().split('T')[0]

  const toInsert = []
  for (const s of services) {
    const title = s.title.trim()
    if (existingNames.has(norm(title))) {
      skipped.push(title)
      continue
    }
    existingNames.add(norm(title))
    toInsert.push({
      contractor_id: contractorId,
      name: title,
      description: s.description || 'Join us for this event.',
      event_date: eventDate,
      event_time: '19:00',
      venue: 'Main Venue',
      capacity: 100,
      price_cents: avgCents,
      is_active: true,
    })
    appended.push(title)
  }
  if (toInsert.length) {
    const { error: insErr } = await supabase.from('ticket_events').insert(toInsert)
    if (insErr) {
      warnings.push(`Failed to insert ticket_events: ${insErr.message}`)
      return { appended: [], skipped: [...skipped, ...appended], warnings }
    }
  }
  return { appended, skipped, warnings }
}

function averageTiers(
  rows: Array<{
    price_basic?: number | null
    price_standard?: number | null
    price_premium?: number | null
  }>
): { basic: number; standard: number; premium: number } {
  if (!rows.length) return { ...DEFAULT_TIERS }
  const n = rows.length
  const avg = (key: 'price_basic' | 'price_standard' | 'price_premium', fallback: number) => {
    const sum = rows.reduce((s, r) => s + (Number(r[key]) || 0), 0)
    const v = Math.round(sum / n)
    return v > 0 ? v : fallback
  }
  return {
    basic: avg('price_basic', DEFAULT_TIERS.basic),
    standard: avg('price_standard', DEFAULT_TIERS.standard),
    premium: avg('price_premium', DEFAULT_TIERS.premium),
  }
}
