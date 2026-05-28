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

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
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
    if (runId) {
      const leads = Array.isArray(payload.leads) ? payload.leads : []
      const stats = asObject(payload.stats)
      const artifacts = asObject(payload.artifacts)
      const webhooks = Array.isArray(payload.webhooks) ? payload.webhooks : []
      const targetLocations = toStringArray(payload.targetLocations)
      const selectedCities = toStringArray(payload.selectedCities)

      const { error: runResultError } = await admin.from('scraper_run_results').upsert(
        {
          run_id: runId,
          phase,
          lead_count: leads.length,
          stats,
          leads,
          webhooks,
          artifacts,
          target_locations: targetLocations,
          selected_cities: selectedCities,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'run_id' }
      )
      if (runResultError) {
        return NextResponse.json({ error: runResultError.message }, { status: 500 })
      }

      if (leads.length > 0) {
        const leadsToInsert = leads.map((lead: any) => ({
          run_id: runId,
          business_name: lead.businessName,
          email: lead.enrichment?.decisionMakerEmail || lead.enrichment?.primaryEmail,
          phone: lead.phoneNumber,
          website: lead.websiteUrl,
          address: lead.address,
          pipeline: lead.enrichment?.pipeline,
          outreach_rank: lead.enrichment?.outreachRank,
          source: 'scraper',
        }))

        // Insert leads without conflicting since run_id+email+phone duplicates might exist, but we just want to track them.
        const { error: insertLeadsError } = await admin.from('leads').insert(leadsToInsert)
        if (insertLeadsError) {
          console.error("Failed to insert leads into relation", insertLeadsError)
        }
      }
    }

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
