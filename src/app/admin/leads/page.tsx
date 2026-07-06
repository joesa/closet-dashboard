import Link from 'next/link'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Lead = {
  id: string
  contractor_id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  room_type: string | null
  finish_type: string | null
  linear_feet: number | null
  estimated_total: number | null
  range_low: number | null
  range_high: number | null
  source_origin: string | null
  created_at: string
}

type ContractorLite = {
  id: string
  company_name: string | null
  domain_config?: {
    unitAbbrev?: string
  } | null
}

const RANGE_OPTIONS = [
  { key: '24h',  label: 'Last 24h',  hours: 24 },
  { key: '7d',   label: 'Last 7 days',  hours: 24 * 7 },
  { key: '30d',  label: 'Last 30 days', hours: 24 * 30 },
  { key: '90d',  label: 'Last 90 days', hours: 24 * 90 },
  { key: 'all',  label: 'All time',  hours: 0 },
]

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString()
}

function buildQs(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v)
  return sp.toString()
}

export default async function LeadsInboxPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    contractor?: string
    range?: string
    origin?: string
  }>
}) {
  const { q = '', contractor = '', range = '30d', origin = '' } = await searchParams
  const admin = getSupabaseAdmin()

  const selectedRange = RANGE_OPTIONS.find((r) => r.key === range) ?? RANGE_OPTIONS[2]
  const sinceIso =
    selectedRange.hours > 0
      // eslint-disable-next-line react-hooks/purity -- async Server Component renders once per request; request time is intentional here
      ? new Date(Date.now() - selectedRange.hours * 3600 * 1000).toISOString()
      : null

  let query = admin
    .from('leads')
    .select(
      'id, contractor_id, first_name, last_name, email, phone, room_type, finish_type, linear_feet, estimated_total, range_low, range_high, source_origin, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(500)

  if (sinceIso) query = query.gte('created_at', sinceIso)
  if (contractor) query = query.eq('contractor_id', contractor)
  if (origin) query = query.ilike('source_origin', `%${origin}%`)
  if (q.trim()) {
    const t = `%${q.trim()}%`
    query = query.or(
      `first_name.ilike.${t},last_name.ilike.${t},email.ilike.${t},phone.ilike.${t}`
    )
  }

  const [{ data, error }, { data: contractorsList }] = await Promise.all([
    query,
    admin
      .from('contractor_settings')
      .select('id, company_name, domain_config')
      .order('company_name', { ascending: true })
      .limit(500),
  ])

  const rows = (data ?? []) as Lead[]
  const contractors = (contractorsList ?? []) as ContractorLite[]
  const cMap = new Map(contractors.map((c) => [c.id, c.company_name]))

  // Roll-up stats for the current filter
  const totalValue = rows.reduce((acc, r) => acc + Number(r.estimated_total ?? 0), 0)
  const avgValue = rows.length > 0 ? totalValue / rows.length : 0

  const exportQs = buildQs({
    q,
    contractor,
    range,
    origin,
  })

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Leads inbox</h1>
          <p className="mt-1 text-sm text-gray-500">
            {rows.length} {rows.length === 1 ? 'lead' : 'leads'} · total ${totalValue.toLocaleString(undefined, {maximumFractionDigits: 0})} · avg ${avgValue.toLocaleString(undefined, {maximumFractionDigits: 0})}
          </p>
        </div>
        <a
          href={`/admin/leads/export${exportQs ? `?${exportQs}` : ''}`}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          Export CSV
        </a>
      </header>

      <form className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name, email, phone…"
          className="min-w-[200px] flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
        <select
          name="contractor"
          defaultValue={contractor}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="">All contractors</option>
          {contractors.map((c) => (
            <option key={c.id} value={c.id}>{c.company_name || '(unnamed)'}</option>
          ))}
        </select>
        <select
          name="range"
          defaultValue={range}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          {RANGE_OPTIONS.map((r) => (
            <option key={r.key} value={r.key}>{r.label}</option>
          ))}
        </select>
        <input
          name="origin"
          defaultValue={origin}
          placeholder="Origin contains…"
          className="w-44 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
        >
          Apply
        </button>
        {(q || contractor || origin || range !== '30d') && (
          <Link href="/admin/leads" className="text-xs text-gray-500 hover:text-gray-700">
            clear
          </Link>
        )}
      </form>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error.message}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2.5">Created</th>
              <th className="px-3 py-2.5">Contractor</th>
              <th className="px-3 py-2.5">Customer</th>
              <th className="px-3 py-2.5">Contact</th>
              <th className="px-3 py-2.5">Project</th>
              <th className="px-3 py-2.5 text-right">Estimate</th>
              <th className="px-3 py-2.5">Origin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">
                  No leads match.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const name = [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || '(unknown)'
              const cInfo = contractors.find((c) => c.id === r.contractor_id)
              const unit = cInfo?.domain_config?.unitAbbrev || 'ft'
              const project = [r.room_type, r.finish_type, r.linear_feet ? `${r.linear_feet}${unit}` : null].filter(Boolean).join(' · ')
              return (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-xs text-gray-500">{fmt(r.created_at)}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/contractors/${r.contractor_id}`}
                      className="text-blue-700 hover:underline"
                    >
                      {cMap.get(r.contractor_id) || r.contractor_id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-3 py-2 font-medium text-gray-900">{name}</td>
                  <td className="px-3 py-2 text-gray-700">
                    <div>{r.email || '—'}</div>
                    {r.phone && <div className="text-xs text-gray-500">{r.phone}</div>}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700">{project || '—'}</td>
                  <td className="px-3 py-2 text-right font-medium text-gray-900">
                    {r.estimated_total != null
                      ? `$${Number(r.estimated_total).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                      : (r.range_low != null && r.range_high != null
                          ? `$${Number(r.range_low).toLocaleString(undefined, {maximumFractionDigits: 0})}–$${Number(r.range_high).toLocaleString(undefined, {maximumFractionDigits: 0})}`
                          : '—')}
                  </td>
                  <td className="px-3 py-2 truncate text-xs text-gray-500" title={r.source_origin ?? ''}>
                    {r.source_origin
                      ? r.source_origin.replace(/^https?:\/\//, '').slice(0, 32)
                      : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {rows.length === 500 && (
        <p className="text-xs text-gray-400">
          Showing the most recent 500 leads in this window. Narrow the filter or export CSV for the full set.
        </p>
      )}
    </div>
  )
}
