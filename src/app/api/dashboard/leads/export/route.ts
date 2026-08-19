import { loadOwnLeads, leadName } from '@/lib/leads/ownLeads'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * The contractor's own leads as CSV.
 *
 * Admin has had this since the beginning; the customer whose leads they are had
 * no way to get them out. Scoped by the same RLS policy as the screen — see
 * loadOwnLeads for why this does not use the service role.
 */
function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export async function GET() {
  const result = await loadOwnLeads(5000)
  if (!result.ok) {
    return new Response(result.error, { status: result.error.startsWith('Sign in') ? 401 : 500 })
  }

  const header = [
    'captured_at', 'name', 'email', 'phone', 'room_type', 'finish_type',
    'linear_feet', 'estimated_total', 'range_low', 'range_high', 'message', 'source',
    // Exported rather than filtered out: a follow-up often carries better
    // details than the first submission, and the spreadsheet should show why
    // the same person appears twice.
    'is_follow_up',
  ]
  const rows = result.leads.map((lead) =>
    [
      lead.created_at,
      leadName(lead),
      lead.email,
      lead.phone,
      lead.room_type,
      lead.finish_type,
      lead.linear_feet,
      lead.estimated_total,
      lead.range_low,
      lead.range_high,
      lead.message,
      lead.source_origin,
      lead.duplicate_of ? 'yes' : 'no',
    ]
      .map(csvCell)
      .join(',')
  )

  const filename = `leads-${new Date().toISOString().slice(0, 10)}.csv`
  return new Response([header.join(','), ...rows].join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
