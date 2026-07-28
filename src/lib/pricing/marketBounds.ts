/**
 * Firecrawl-backed metro market price bounds research.
 * Timeout / failure → skip (catalog defaults still apply); never block provision.
 */
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { matchServiceDef } from '@/lib/catalog/serviceCatalog'
import type { IndustrySlug } from '@/lib/catalog/types'

export type MarketBound = {
  metro: string
  serviceKey: string
  industrySlug?: string | null
  low: number
  high: number
  samples: number
}

const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 14 // 14 days
const RESEARCH_TIMEOUT_MS = 12_000
const MIN_SAMPLES = 2

function serviceKeyFor(name: string, industrySlug?: IndustrySlug): string {
  const def = matchServiceDef(name, industrySlug)
  return (def?.label || name).trim().toLowerCase()
}

function parseDollarAmounts(text: string): number[] {
  const amounts: number[] = []
  // Require end of number (no more digits) so $250000 is one token, not $250.
  const re =
    /\$\s*([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)(?!\d)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const n = Number(m[1].replace(/,/g, ''))
    if (Number.isFinite(n) && n >= 15 && n <= 100_000) amounts.push(n)
  }
  return amounts
}

async function firecrawlSearchMarkdown(query: string): Promise<string> {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) return ''

  const base = (process.env.FIRECRAWL_API_URL || 'https://api.firecrawl.dev').replace(/\/$/, '')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), RESEARCH_TIMEOUT_MS)

  try {
    const res = await fetch(`${base}/v1/search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        limit: 4,
        scrapeOptions: { formats: ['markdown'], onlyMainContent: true },
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      console.warn(`[marketBounds] Firecrawl search ${res.status} for "${query}"`)
      return ''
    }
    const json = (await res.json()) as {
      data?: Array<{ markdown?: string; description?: string; title?: string }>
    }
    const parts = (json.data || []).map((d) =>
      [d.title, d.description, d.markdown].filter(Boolean).join('\n')
    )
    return parts.join('\n\n')
  } catch (err) {
    console.warn('[marketBounds] Firecrawl search failed:', err)
    return ''
  } finally {
    clearTimeout(timer)
  }
}

async function loadCached(
  metro: string,
  serviceKey: string
): Promise<MarketBound | null> {
  try {
    const admin = getSupabaseAdmin()
    const { data } = await admin
      .from('service_market_bounds')
      .select('metro, service_key, industry_slug, low, high, samples, fetched_at')
      .eq('metro', metro)
      .eq('service_key', serviceKey)
      .maybeSingle()
    if (!data) return null
    const age = Date.now() - new Date(data.fetched_at as string).getTime()
    if (age > CACHE_TTL_MS) return null
    return {
      metro: data.metro as string,
      serviceKey: data.service_key as string,
      industrySlug: data.industry_slug as string | null,
      low: Number(data.low),
      high: Number(data.high),
      samples: Number(data.samples) || 0,
    }
  } catch {
    return null
  }
}

async function saveCached(bound: MarketBound): Promise<void> {
  try {
    const admin = getSupabaseAdmin()
    await admin.from('service_market_bounds').upsert(
      {
        metro: bound.metro,
        service_key: bound.serviceKey,
        industry_slug: bound.industrySlug || null,
        low: bound.low,
        high: bound.high,
        samples: bound.samples,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'metro,service_key' }
    )
  } catch (err) {
    console.warn('[marketBounds] cache write failed:', err)
  }
}

async function researchOne(
  metro: string,
  service: string,
  industrySlug?: IndustrySlug,
  stateHint?: string
): Promise<MarketBound | null> {
  const key = serviceKeyFor(service, industrySlug)
  const cached = await loadCached(metro, key)
  if (cached && cached.samples >= MIN_SAMPLES) return cached

  const queries = [
    `${service} cost ${metro}`,
    `average price ${service} ${stateHint || metro}`,
  ]

  const amounts: number[] = []
  for (const q of queries) {
    const md = await firecrawlSearchMarkdown(q)
    if (md) amounts.push(...parseDollarAmounts(md))
  }

  if (amounts.length < MIN_SAMPLES) return cached

  amounts.sort((a, b) => a - b)
  const low = amounts[Math.floor(amounts.length * 0.15)] ?? amounts[0]
  const high = amounts[Math.floor(amounts.length * 0.85)] ?? amounts[amounts.length - 1]
  const bound: MarketBound = {
    metro,
    serviceKey: key,
    industrySlug: industrySlug || null,
    low,
    high: Math.max(high, low),
    samples: amounts.length,
  }
  await saveCached(bound)
  return bound
}

/**
 * Load (or research) metro market bounds for a list of services.
 * Never throws — returns whatever succeeded within the overall budget.
 */
export async function loadMarketBounds(opts: {
  metro?: string | null
  services: string[]
  industrySlug?: IndustrySlug
  state?: string | null
  /** Cap concurrent Firecrawl calls (default 3 services). */
  maxServices?: number
}): Promise<MarketBound[]> {
  const metro = (opts.metro || '').trim()
  if (!metro || !opts.services.length) return []
  if (!process.env.FIRECRAWL_API_KEY) return []

  const max = opts.maxServices ?? 3
  const services = opts.services.filter((s) => s.trim()).slice(0, max)
  const results: MarketBound[] = []

  // Sequential to stay polite on Firecrawl rate limits during provision.
  for (const service of services) {
    try {
      const bound = await researchOne(metro, service, opts.industrySlug, opts.state || undefined)
      if (bound) results.push(bound)
    } catch (err) {
      console.warn(`[marketBounds] research failed for ${service}:`, err)
    }
  }
  return results
}

/** Inject bounds into a seed pricing string for the AI prompt. */
export function formatMarketBoundsForPrompt(bounds: MarketBound[]): string {
  return bounds
    .filter((b) => b.samples >= MIN_SAMPLES)
    .map(
      (b) =>
        `- ${b.serviceKey}: keep basic≥$${b.low}, premium≤$${b.high} (${b.samples} samples)`
    )
    .join('\n')
}
