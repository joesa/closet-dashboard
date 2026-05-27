import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Stat = { label: string; value: string | number; hint?: string }

async function loadStats(): Promise<{
  stats: Stat[]
  byStatus: Array<{ status: string; count: number }>
  recentAudit: Array<{ id: number; action: string; actor_email: string | null; created_at: string }>
}> {
  const admin = getSupabaseAdmin()

  const [
    contractors,
    leadsTotal,
    quoteEvents24h,
    leads24h,
    statusBuckets,
    webhooksUnprocessed,
    auditRecent,
  ] = await Promise.all([
    admin.from('contractor_settings').select('id', { count: 'exact', head: true }),
    admin.from('leads').select('id', { count: 'exact', head: true }),
    admin
      .from('quote_events')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString()),
    admin
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString()),
    admin
      .from('contractor_settings')
      .select('subscription_status'),
    admin
      .from('stripe_webhook_events')
      .select('id', { count: 'exact', head: true })
      .is('processed_at', null),
    admin
      .from('admin_audit_log')
      .select('id, action, actor_email, created_at')
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  const counts: Record<string, number> = {}
  for (const row of statusBuckets.data ?? []) {
    const s = (row as { subscription_status: string }).subscription_status || 'unknown'
    counts[s] = (counts[s] ?? 0) + 1
  }
  const byStatus = Object.entries(counts)
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count)

  const stats: Stat[] = [
    { label: 'Contractors',          value: contractors.count ?? 0 },
    { label: 'Leads (all-time)',     value: leadsTotal.count ?? 0 },
    { label: 'Leads · last 24h',     value: leads24h.count ?? 0 },
    { label: 'Quotes · last 24h',    value: quoteEvents24h.count ?? 0 },
    { label: 'Webhooks unprocessed', value: webhooksUnprocessed.count ?? 0, hint: 'should be 0' },
  ]

  return {
    stats,
    byStatus,
    recentAudit: (auditRecent.data ?? []) as Array<{
      id: number
      action: string
      actor_email: string | null
      created_at: string
    }>,
  }
}

export default async function AdminHealthPage() {
  const { stats, byStatus, recentAudit } = await loadStats()

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">System Health</h1>
        <p className="mt-1 text-sm text-gray-500">
          High-level counts and recent activity across the platform.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="text-xs uppercase tracking-wide text-gray-500">
              {s.label}
            </div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">
              {s.value}
            </div>
            {s.hint && (
              <div className="mt-1 text-xs text-gray-400">{s.hint}</div>
            )}
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">
          Contractors by subscription status
        </h2>
        {byStatus.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No contractors yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100 text-sm">
            {byStatus.map((b) => (
              <li
                key={b.status}
                className="flex items-center justify-between py-2"
              >
                <span className="font-mono text-xs text-gray-600">
                  {b.status}
                </span>
                <span className="font-semibold text-gray-900">{b.count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">
          Recent admin actions
        </h2>
        {recentAudit.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">
            No admin actions logged yet.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100 text-sm">
            {recentAudit.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between py-2 text-gray-700"
              >
                <div>
                  <span className="font-mono text-xs text-gray-500">
                    {a.action}
                  </span>
                  <span className="ml-3 text-xs text-gray-400">
                    by {a.actor_email ?? 'system'}
                  </span>
                </div>
                <time className="text-xs text-gray-400">
                  {new Date(a.created_at).toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
