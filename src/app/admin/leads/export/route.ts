import { requireAdmin, logAdminAction } from '@/lib/admin'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const COLUMNS = [
  'id',
  'created_at',
  'contractor_id',
  'company_name',
  'first_name',
  'last_name',
  'email',
  'phone',
  'room_type',
  'finish_type',
  'linear_feet',
  'estimated_total',
  'range_low',
  'range_high',
  'source_origin',
  'user_agent',
  'message',
] as const

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = typeof v === 'string' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function GET(req: Request) {
  const me = await requireAdmin()
  const url = new URL(req.url)
  const q = (url.searchParams.get('q') || '').trim()
  const contractor = url.searchParams.get('contractor') || ''
  const range = url.searchParams.get('range') || '30d'
  const origin = (url.searchParams.get('origin') || '').trim()

  const rangeMap: Record<string, number> = { '24h': 24, '7d': 168, '30d': 720, '90d': 2160, 'all': 0 }
  const hours = rangeMap[range] ?? 720
  const sinceIso = hours > 0 ? new Date(Date.now() - hours * 3600 * 1000).toISOString() : null

  const admin = getSupabaseAdmin()
  let query = admin
    .from('leads')
    .select(
      'id, contractor_id, first_name, last_name, email, phone, room_type, finish_type, linear_feet, estimated_total, range_low, range_high, source_origin, user_agent, message, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(10000)

  if (sinceIso) query = query.gte('created_at', sinceIso)
  if (contractor) query = query.eq('contractor_id', contractor)
  if (origin) query = query.ilike('source_origin', `%${origin}%`)
  if (q) {
    const t = `%${q}%`
    query = query.or(`first_name.ilike.${t},last_name.ilike.${t},email.ilike.${t},phone.ilike.${t}`)
  }

  const [{ data, error }, { data: contractorsData }] = await Promise.all([
    query,
    admin.from('contractor_settings').select('id, company_name').limit(2000),
  ])

  if (error) {
    return new Response(`error: ${error.message}`, { status: 500 })
  }

  const cMap = new Map(
    (contractorsData ?? []).map((c) => [
      (c as { id: string }).id,
      (c as { company_name: string | null }).company_name,
    ])
  )

  const rows = data ?? []
  const lines: string[] = [COLUMNS.join(',')]
  for (const r of rows) {
    const row = r as Record<string, unknown>
    lines.push(
      COLUMNS.map((col) => {
        if (col === 'company_name') return csvEscape(cMap.get(row.contractor_id as string) ?? '')
        return csvEscape(row[col])
      }).join(',')
    )
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `closet-leads-${range}-${ts}.csv`

  await logAdminAction({
    actor: me,
    action: 'leads.exported_csv',
    targetType: 'leads',
    metadata: {
      filters: { q, contractor, range, origin },
      row_count: rows.length,
    },
  })

  return new Response(lines.join('\n') + '\n', {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
