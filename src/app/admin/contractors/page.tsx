import Link from 'next/link'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Row = {
  id: string
  company_name: string | null
  contact_email: string | null
  subscription_status: string | null
  subscription_plan: string | null
  trial_ends_at: string | null
  current_period_end: string | null
  stripe_customer_id: string | null
  created_at: string
}

const STATUS_FILTERS = [
  { key: '',           label: 'All' },
  { key: 'trialing',   label: 'Trialing' },
  { key: 'active',     label: 'Active' },
  { key: 'comp',       label: 'Comp' },
  { key: 'past_due',   label: 'Past due' },
  { key: 'canceled',   label: 'Canceled' },
  { key: 'incomplete', label: 'Incomplete' },
]

function statusBadge(s: string | null) {
  const map: Record<string, string> = {
    active:    'bg-green-100 text-green-800',
    trialing:  'bg-blue-100 text-blue-800',
    comp:      'bg-purple-100 text-purple-800',
    past_due:  'bg-amber-100 text-amber-800',
    canceled:  'bg-gray-200 text-gray-700',
    incomplete:'bg-rose-100 text-rose-800',
  }
  const cls = map[s ?? ''] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {s ?? 'unknown'}
    </span>
  )
}

function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString()
}

export default async function ContractorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const { q = '', status = '' } = await searchParams
  const admin = getSupabaseAdmin()

  let query = admin
    .from('contractor_settings')
    .select(
      'id, company_name, contact_email, subscription_status, subscription_plan, trial_ends_at, current_period_end, stripe_customer_id, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(200)

  if (status) query = query.eq('subscription_status', status)
  if (q.trim()) {
    const term = `%${q.trim()}%`
    query = query.or(`company_name.ilike.${term},contact_email.ilike.${term}`)
  }

  const { data, error } = await query
  const rows = (data ?? []) as Row[]

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Contractors</h1>
          <p className="mt-1 text-sm text-gray-500">
            {rows.length} {rows.length === 1 ? 'account' : 'accounts'}
            {status ? ` · status = ${status}` : ''}
            {q ? ` · matching “${q}”` : ''}
          </p>
        </div>
      </header>

      <form className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search company or email…"
          className="flex-1 min-w-[220px] rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
        <select
          name="status"
          defaultValue={status}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
        >
          Apply
        </button>
        {(q || status) && (
          <Link
            href="/admin/contractors"
            className="text-xs text-gray-500 hover:text-gray-700"
          >
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
              <th className="px-4 py-2.5">Company</th>
              <th className="px-4 py-2.5">Email</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Plan</th>
              <th className="px-4 py-2.5">Trial ends</th>
              <th className="px-4 py-2.5">Period ends</th>
              <th className="px-4 py-2.5">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">
                  No contractors match.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5">
                  <Link
                    href={`/admin/contractors/${r.id}`}
                    className="font-medium text-blue-700 hover:underline"
                  >
                    {r.company_name || '(unnamed)'}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-gray-700">{r.contact_email || '—'}</td>
                <td className="px-4 py-2.5">{statusBadge(r.subscription_status)}</td>
                <td className="px-4 py-2.5 text-gray-700">{r.subscription_plan ?? '—'}</td>
                <td className="px-4 py-2.5 text-gray-600">{fmtDate(r.trial_ends_at)}</td>
                <td className="px-4 py-2.5 text-gray-600">{fmtDate(r.current_period_end)}</td>
                <td className="px-4 py-2.5 text-gray-500">{fmtDate(r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
