import { NextResponse } from 'next/server'

import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { extractBearerOrHeaderToken, normalizeScraperControlConfig } from '@/lib/scraper-control'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function normalizeCityKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
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

export async function GET(req: Request) {
  const authError = assertControlPlaneToken(req)
  if (authError) return authError

  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('scraper_config')
    .select('settings, updated_at')
    .eq('id', 'default')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const config = normalizeScraperControlConfig(data?.settings ?? {})

  let selectedCities = config.targetLocations
  if (config.autoModeEnabled) {
    const pool = config.cityPool.length ? config.cityPool : config.targetLocations
    let candidates = pool

    if (config.autoAvoidDuplicates && pool.length > 0) {
      const { data: ledgerRows } = await admin
        .from('scraper_city_ledger')
        .select('city_key')

      const seen = new Set((ledgerRows ?? []).map((r) => String(r.city_key || '')))
      candidates = pool.filter((city) => !seen.has(normalizeCityKey(city)))
    }

    if (candidates.length > 0) {
      const ordered = config.autoRandomize ? shuffle(candidates) : candidates
      selectedCities = ordered.slice(0, config.autoCitiesPerRun)
    }
  }

  const effectiveConfig = {
    ...config,
    targetLocations: selectedCities,
  }

  return NextResponse.json(
    {
      ok: true,
      config: effectiveConfig,
      orchestration: {
        autoModeEnabled: config.autoModeEnabled,
        selectedCities,
      },
      updatedAt: data?.updated_at ?? null,
    },
    { status: 200 }
  )
}
