import Link from 'next/link'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Row = {
  id: string
  type: string
  received_at: string
  processed_at: string | null
  process_error: string | null
}

const STATUS_FILTERS = [
  { key: '',          label: 'All' },
  { key: 'processed', label: 'Processed' },
  { key: 'unprocessed', label: 'Unprocessed' },
  { key: 'errored',   label: 'Errored' },
]

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString()
}

export default async function StripeEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; q?: string }>
}) {
  const { type = '', status = '', q = '' } = await searchParams
  const admin = getSupabaseAdmin()

  let query = admin
    .from('stripe_webhook_events')
    .select('id, type, received_at, processed_at, process_error')
    .order('received_at', { ascending: false })
    .limit(300)

  if (type) query = query.eq('type', type)
  if (status === 'processed') query = query.not('processed_at', 'is', null)
  if (status === 'unprocessed') query = query.is('processed_at', null)
  if (status === 'errored') query = query.not('process_error', 'is', null)
  if (q.trim()) {
    const t = `%${q.trim()}%`
    query = query.or(`id.ilike.${t},type.ilike.${t}`)
  }

  const [{ data, error }, { data: typesRaw }] = await Promise.all([
    query,
    admin
      .from('stripe_webhook_events')
      .select('type')
      .order('received_at', { ascending: false })
      .limit(2000),
  ])

  const rows = (data ?? []) as Row[]
  const types = Array.from(
    new Set(((typesRaw ?? []) as Array<{ type: string }>).map((r) => r.type))
  ).sort()

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Stripe events</h1>
          <p className="mt-1 text-sm text-gray-500">
            {rows.length} event{rows.length === 1 ? '' : 's'} · most recent first
          </p>
        </div>
      </header>

      <form className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search id or type…"
          className="min-w-[220px] flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
        <select
          name="type"
          defaultValue={type}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
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
        {(q || type || status) && (
          <Link href="/admin/stripe-events" className="text-xs text-gray-500 hover:text-gray-700">
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
              <th className="px-3 py-2.5">Received</th>
              <th className="px-3 py-2.5">Type</th>
              <th className="px-3 py-2.5">Event ID</th>
              <th className="px-3 py-2.5">Processed</th>
              <th className="px-3 py-2.5">Error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">
                  No events recorded yet. They&apos;ll appear here as Stripe POSTs to the webhook.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-xs text-gray-500">{fmt(r.received_at)}</td>
                <td className="px-3 py-2 font-mono text-xs text-gray-800">{r.type}</td>
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/stripe-events/${encodeURIComponent(r.id)}`}
                    className="font-mono text-xs text-blue-700 hover:underline"
                  >
                    {r.id}
                  </Link>
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.process_error ? (
                    <span className="inline-flex rounded-full bg-rose-100 px-2 py-0.5 font-medium text-rose-700">
                      errored
                    </span>
                  ) : r.processed_at ? (
                    <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-800">
                      ok
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
                      pending
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 truncate text-xs text-rose-700" title={r.process_error ?? ''}>
                  {r.process_error
                    ? r.process_error.slice(0, 60) + (r.process_error.length > 60 ? '…' : '')
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
