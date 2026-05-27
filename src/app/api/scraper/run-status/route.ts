import { NextResponse } from 'next/server'

import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { extractBearerOrHeaderToken } from '@/lib/scraper-control'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function normalizeCityKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((v) => String(v || '').trim()).filter(Boolean)
}

type RunStatusPayload = {
  runId?: string | null
  phase?: 'started' | 'completed' | 'failed' | string
  payload?: Record<string, unknown>
}

function assertControlPlaneToken(req: Request): NextResponse | null {
  const configured = process.env.SCRAPER_CONTROL_PLANE_TOKEN || ''
  if (!configured) {
    return NextResponse.json(
      { error: 'SCRAPER_CONTROL_PLANE_TOKEN is not configured' },
      { status: 500 }
    )
  }

  const incoming = extractBearerOrHeaderToken(req)
  if (!incoming || incoming !== configured) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}

export async function POST(req: Request) {
  const authError = assertControlPlaneToken(req)
  if (authError) return authError

  let body: RunStatusPayload = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const phase = String(body.phase || '').trim()
  if (!phase) {
    return NextResponse.json({ error: 'phase is required' }, { status: 400 })
  }

  const runId = body.runId ? String(body.runId).trim() : null
  const payload = body.payload && typeof body.payload === 'object' ? body.payload : {}

  const admin = getSupabaseAdmin()
  const { error } = await admin.from('scraper_run_events').insert({
    run_id: runId,
    phase,
    source: 'scraper',
    payload,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (phase === 'completed') {
    const cities = [
      ...toStringArray(payload.targetLocations),
      ...toStringArray(payload.selectedCities),
    ]
    const uniqueCities = Array.from(new Set(cities))

    for (const city of uniqueCities) {
      const cityKey = normalizeCityKey(city)
      const { data: existing } = await admin
        .from('scraper_city_ledger')
        .select('city_key, run_count, first_run_id')
        .eq('city_key', cityKey)
        .maybeSingle()

      if (!existing) {
        await admin.from('scraper_city_ledger').insert({
          city_key: cityKey,
          city_label: city,
          first_run_id: runId,
          last_run_id: runId,
          first_scraped_at: new Date().toISOString(),
          last_scraped_at: new Date().toISOString(),
          run_count: 1,
          last_source: 'scraper',
        })
      } else {
        await admin
          .from('scraper_city_ledger')
          .update({
            city_label: city,
            last_run_id: runId,
            last_scraped_at: new Date().toISOString(),
            run_count: Number(existing.run_count || 1) + 1,
            last_source: 'scraper',
          })
          .eq('city_key', cityKey)
      }
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
