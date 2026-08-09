import Link from 'next/link'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { specBuildDailyMax, specBuildsEnabled } from '@/lib/spec/specBuilds'
import { SPEC_BUILD_STATUSES, type SpecBuildRow } from '@/lib/spec/types'
import BulkLeadForm from './BulkLeadForm'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const STATUS_STYLE: Record<string, string> = {
  queued: 'bg-gray-100 text-gray-700',
  researching: 'bg-blue-100 text-blue-700',
  drafting: 'bg-blue-100 text-blue-700',
  imaging: 'bg-blue-100 text-blue-700',
  provisioning: 'bg-blue-100 text-blue-700',
  building: 'bg-blue-100 text-blue-700',
  ready_for_review: 'bg-amber-100 text-amber-800',
  needs_attention: 'bg-red-100 text-red-700',
  rejected: 'bg-gray-100 text-gray-500',
  approved: 'bg-emerald-100 text-emerald-700',
  offer_sent: 'bg-indigo-100 text-indigo-700',
  offer_reminded: 'bg-indigo-100 text-indigo-700',
  accepted: 'bg-emerald-100 text-emerald-800',
  declined: 'bg-gray-100 text-gray-500',
  expired: 'bg-gray-100 text-gray-500',
  purged: 'bg-gray-100 text-gray-400',
}

function fmt(d?: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default async function SpecBuildsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const { status, q } = await searchParams
  const supabase = getSupabaseAdmin()

  let query = supabase
    .from('spec_builds')
    .select(
      'id, status, lead_source, business_name, phone_e164, city, tenant_id, last_error, status_reason, offer_deadline_at, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(500)

  if (status && (SPEC_BUILD_STATUSES as readonly string[]).includes(status)) {
    query = query.eq('status', status)
  }
  if (q?.trim()) {
    const safe = q.trim().replace(/[%,()]/g, '')
    if (safe) {
      query = query.or(
        `business_name.ilike.%${safe}%,phone_e164.ilike.%${safe}%,city.ilike.%${safe}%`
      )
    }
  }

  const { data, error } = await query
  const rows = (data ?? []) as Pick<
    SpecBuildRow,
    | 'id'
    | 'status'
    | 'lead_source'
    | 'business_name'
    | 'phone_e164'
    | 'city'
    | 'tenant_id'
    | 'last_error'
    | 'status_reason'
    | 'offer_deadline_at'
    | 'created_at'
  >[]

  const needsAttention = rows.filter((r) => r.status === 'needs_attention').length
  const readyForReview = rows.filter((r) => r.status === 'ready_for_review').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Spec Builds</h1>
        <p className="mt-1 text-sm text-gray-600">
          Sites built unattended for cold leads with no website. Every build is reviewed here
          before anything is sent to the business.
        </p>
      </div>

      {!specBuildsEnabled() && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong className="font-medium">Automatic queueing is off.</strong> Scraper runs will not
          enqueue spec builds until <code className="font-mono">SPEC_BUILD_ENABLED=true</code> is
          set. Leads added below are still queued. Daily cap: {specBuildDailyMax()}.
        </div>
      )}

      {(needsAttention > 0 || readyForReview > 0) && (
        <div className="flex gap-3 text-sm">
          {readyForReview > 0 && (
            <Link
              href="/admin/spec-builds?status=ready_for_review"
              className="rounded-md bg-amber-100 px-3 py-1.5 font-medium text-amber-800 hover:bg-amber-200"
            >
              {readyForReview} ready for review
            </Link>
          )}
          {needsAttention > 0 && (
            <Link
              href="/admin/spec-builds?status=needs_attention"
              className="rounded-md bg-red-100 px-3 py-1.5 font-medium text-red-700 hover:bg-red-200"
            >
              {needsAttention} need attention
            </Link>
          )}
        </div>
      )}

      <BulkLeadForm />

      <form className="flex flex-wrap items-end gap-3" method="GET">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">
            Status
          </label>
          <select
            name="status"
            defaultValue={status ?? ''}
            className="mt-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="">All</option>
            {SPEC_BUILD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">
            Search
          </label>
          <input
            name="q"
            defaultValue={q ?? ''}
            placeholder="Business, phone, or city"
            className="mt-1 w-64 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Filter
        </button>
      </form>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Could not load spec builds: {error.message}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Queued</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No spec builds yet. Add leads above, or let a scraper run queue them.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{row.business_name}</td>
                <td className="px-4 py-3 text-gray-600">{row.phone_e164}</td>
                <td className="px-4 py-3 text-gray-600">{row.city || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{row.lead_source}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_STYLE[row.status] ?? 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {row.status.replace(/_/g, ' ')}
                  </span>
                  {(row.status_reason || row.last_error) && (
                    <p className="mt-1 max-w-xs truncate text-xs text-gray-500">
                      {row.status_reason || row.last_error}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">{fmt(row.created_at)}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/spec-builds/${row.id}`}
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
