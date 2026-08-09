import { NextResponse } from 'next/server'

import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { extractBearerOrHeaderToken } from '@/lib/scraper-control'
import {
  enqueueSpecBuildsForRun,
  type EnqueueFromRunSummary,
} from '@/lib/spec/enqueueFromScraperRun'
import type { ScrapedLeadShape } from '@/lib/spec/qualifyLead'

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

  let specBuildSummary: EnqueueFromRunSummary | null = null

  if (phase === 'completed') {
    if (runId) {
      const leads = Array.isArray(payload.leads) ? payload.leads : []
      const stats = asObject(payload.stats)
      const artifacts = asObject(payload.artifacts)
      const filters = asObject(payload.filters)
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
          filters,
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
        const leadsToInsert = leads.map((lead: {
          businessName?: string
          businessCategory?: string
          additionalCategories?: unknown[]
          servicesProvided?: unknown[]
          servicesSource?: string
          businessDescription?: string
          socialProfileUrl?: string
          hasOwnWebsite?: boolean
          phoneNumber?: string
          websiteUrl?: string
          address?: string
          enrichment?: {
            decisionMakerEmail?: string
            primaryEmail?: string
            pipeline?: string
            outreachRank?: number
          }
        }) => ({
          run_id: runId,
          business_name: lead.businessName,
          business_category: lead.businessCategory,
          additional_categories: toStringArray(lead.additionalCategories),
          services_provided: toStringArray(lead.servicesProvided),
          services_source: lead.servicesSource,
          business_description: lead.businessDescription,
          email: lead.enrichment?.decisionMakerEmail || lead.enrichment?.primaryEmail,
          phone: lead.phoneNumber,
          website: lead.websiteUrl,
          social_profile_url: lead.socialProfileUrl,
          has_own_website: lead.hasOwnWebsite === true,
          address: lead.address,
          pipeline: lead.enrichment?.pipeline,
          outreach_rank: lead.enrichment?.outreachRank,
          source: 'scraper',
        }))

        // Insert leads without conflicting since run_id+email+phone duplicates might exist, but we just want to track them.
        // `select('id')` returns the new rows in insertion order, which is what
        // lets a queued spec build point back at the lead it came from.
        const { data: insertedLeads, error: insertLeadsError } = await admin
          .from('scraper_leads')
          .insert(leadsToInsert)
          .select('id')
        if (insertLeadsError) {
          console.error('Failed to insert scraper_leads', insertLeadsError)
          return NextResponse.json(
            {
              ok: true,
              warnings: ['scraper_leads_insert_failed'],
              detail: insertLeadsError.message,
            },
            { status: 207 }
          )
        }

        // Spec builds: queue the no-website leads for an unattended site build.
        // Off unless SPEC_BUILD_ENABLED=true, capped by SPEC_BUILD_DAILY_MAX,
        // and never allowed to fail this webhook — the run results are already
        // committed above and matter more than the queueing.
        try {
          const pairs = (insertedLeads ?? []).map((inserted, i) => ({
            id: (inserted as { id: string }).id,
            row: leadsToInsert[i] as ScrapedLeadShape,
          }))
          specBuildSummary = await enqueueSpecBuildsForRun(runId, pairs)
        } catch (specErr) {
          console.error('[spec-builds] enqueue from run failed', specErr)
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

  return NextResponse.json(
    specBuildSummary ? { ok: true, specBuilds: specBuildSummary } : { ok: true },
    { status: 200 }
  )
}
