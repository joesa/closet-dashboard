import { requireAdmin } from '@/lib/admin'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ''
  const raw = typeof value === 'string' ? value : JSON.stringify(value)
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`
  }
  return raw
}

function asString(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

function leadsToCsv(leads: Record<string, unknown>[]): string {
  const headers = [
    'businessName',
    'websiteUrl',
    'phoneNumber',
    'address',
    'ratingText',
    'mapsPlaceUrl',
    'sourceKeyword',
    'sourceLocation',
    'sourceQuery',
    'pipeline',
    'outreachRank',
    'reason',
    'confidenceScore',
    'confidenceLabel',
    'primaryEmail',
    'decisionMakerName',
    'decisionMakerTitle',
    'decisionMakerEmail',
    'decisionMakerEmailType',
    'decisionMakerEmailConfidence',
    'decisionMakerEmailSource',
    'allEmails',
    'contactPageUrl',
    'pagesScanned',
  ]

  const lines = [headers.join(',')]

  for (const lead of leads) {
    const enrichment =
      lead.enrichment && typeof lead.enrichment === 'object' && !Array.isArray(lead.enrichment)
        ? (lead.enrichment as Record<string, unknown>)
        : {}

    const row = [
      asString(lead.businessName),
      asString(lead.websiteUrl),
      asString(lead.phoneNumber),
      asString(lead.address),
      asString(lead.ratingText),
      asString(lead.mapsPlaceUrl),
      asString(lead.sourceKeyword),
      asString(lead.sourceLocation),
      asString(lead.sourceQuery),
      asString(enrichment.pipeline),
      asString(enrichment.outreachRank),
      asString(enrichment.reason),
      asString(enrichment.confidenceScore),
      asString(enrichment.confidenceLabel),
      asString(enrichment.primaryEmail),
      asString(enrichment.decisionMakerName),
      asString(enrichment.decisionMakerTitle),
      asString(enrichment.decisionMakerEmail),
      asString(enrichment.decisionMakerEmailType),
      asString(enrichment.decisionMakerEmailConfidence),
      asString(enrichment.decisionMakerEmailSource),
      Array.isArray(enrichment.discoveredEmails)
        ? enrichment.discoveredEmails.map((v) => String(v || '')).filter(Boolean).join(';')
        : '',
      asString(enrichment.contactPageUrl),
      Array.isArray(enrichment.pagesScanned)
        ? enrichment.pagesScanned.map((v) => String(v || '')).filter(Boolean).join(';')
        : '',
    ].map(csvEscape)

    lines.push(row.join(','))
  }

  return `${lines.join('\n')}\n`
}

export async function GET(
  req: Request,
  context: { params: Promise<{ runId: string }> }
) {
  await requireAdmin()
  const { runId } = await context.params
  const requestedRunId = decodeURIComponent(runId || '').trim()
  if (!requestedRunId) {
    return new Response('run_id is required', { status: 400 })
  }

  const url = new URL(req.url)
  const format = (url.searchParams.get('format') || 'json').toLowerCase()

  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('scraper_run_results')
    .select(
      'run_id, phase, lead_count, stats, leads, webhooks, artifacts, target_locations, selected_cities, created_at, updated_at'
    )
    .eq('run_id', requestedRunId)
    .maybeSingle()

  if (error) {
    return new Response(`error: ${error.message}`, { status: 500 })
  }
  if (!data) {
    return new Response('run result not found', { status: 404 })
  }

  const safeRunId = requestedRunId.replace(/[^a-zA-Z0-9._-]/g, '_')

  if (format === 'csv') {
    const leads = Array.isArray(data.leads) ? (data.leads as Record<string, unknown>[]) : []
    const csv = leadsToCsv(leads)
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="scraper-run-${safeRunId}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  return new Response(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="scraper-run-${safeRunId}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
