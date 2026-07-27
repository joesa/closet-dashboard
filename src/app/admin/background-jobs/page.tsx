import Link from 'next/link'
import { getBackgroundJobsSnapshot } from '@/lib/jobs/backgroundJobsAdmin'
import RequeueCustomBuildButton from './RequeueCustomBuildButton'

export const dynamic = 'force-dynamic'

function ageLabel(iso: string | null | undefined): string {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return '—'
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000))
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.round(sec / 60)}m`
  return `${Math.round(sec / 3600)}h`
}

export default async function BackgroundJobsPage() {
  const snap = await getBackgroundJobsSnapshot()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Background jobs</h1>
        <p className="mt-1 text-sm text-gray-500">
          Graphile Worker queue plus Full redesign (`custom_build_job`) status. Re-queue
          resumes from draft checkpoint; Full redesign on the site page starts fresh.
        </p>
        <Link
          href="/admin/provision-jobs"
          className="mt-2 inline-block text-sm text-blue-600 hover:underline"
        >
          Provision jobs →
        </Link>
      </div>

      {!snap.databaseConfigured ? (
        <p className="mb-4 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          DATABASE_URL is not configured — Graphile enqueue/list unavailable.
        </p>
      ) : null}

      {snap.alerts.length > 0 ? (
        <div className="mb-6 space-y-2">
          {snap.alerts.map((a, i) => (
            <p
              key={`${a.kind}-${a.tenantId}-${i}`}
              className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            >
              [{a.kind}] {a.message}
            </p>
          ))}
        </div>
      ) : (
        <p className="mb-6 text-sm text-gray-500">No SLO alerts right now.</p>
      )}

      <h2 className="mb-2 text-lg font-medium text-gray-900">Custom build jobs</h2>
      <div className="mb-10 overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Site</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Pass</th>
              <th className="px-4 py-3">Age</th>
              <th className="px-4 py-3">Alert</th>
              <th className="px-4 py-3">Error</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {snap.customBuilds.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No active or recent failed Full redesign jobs.
                </td>
              </tr>
            ) : (
              snap.customBuilds.map((row) => (
                <tr
                  key={row.tenantId}
                  className={row.alert ? 'bg-red-50/60' : 'hover:bg-gray-50'}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/sites/${row.tenantId}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {row.brandName || row.tenantId.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {row.job.status}
                    {row.job.dead_lettered ? ' · DLQ' : ''}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {row.job.pass || '—'} (
                    {(row.job.passes_done || []).length}/
                    {(row.job.required_paths || []).length || '?'})
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {ageLabel(row.job.started_at)} wall · hb{' '}
                    {ageLabel(row.job.heartbeat_at)}
                  </td>
                  <td className="px-4 py-3 text-xs text-red-700">
                    {row.alert || '—'}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-xs text-gray-600">
                    {row.job.error || '—'}
                  </td>
                  <td className="px-4 py-3">
                    {row.job.status === 'failed' &&
                    !/cancel/i.test(row.job.error || '') ? (
                      <RequeueCustomBuildButton tenantId={row.tenantId} />
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 text-lg font-medium text-gray-900">Graphile Worker jobs</h2>
      {snap.graphileError ? (
        <p className="mb-4 text-sm text-red-600">{snap.graphileError}</p>
      ) : null}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Task</th>
              <th className="px-4 py-3">Attempts</th>
              <th className="px-4 py-3">Key</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Locked</th>
              <th className="px-4 py-3">Last error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {snap.graphileJobs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No rows in graphile_worker.jobs (queue empty or schema missing).
                </td>
              </tr>
            ) : (
              snap.graphileJobs.map((j) => (
                <tr key={j.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{j.taskIdentifier}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {j.attempts}/{j.maxAttempts}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{j.key || '—'}</td>
                  <td className="px-4 py-3 text-xs">{ageLabel(j.createdAt)}</td>
                  <td className="px-4 py-3 text-xs">{ageLabel(j.lockedAt)}</td>
                  <td className="max-w-sm truncate px-4 py-3 text-xs text-gray-600">
                    {j.lastError || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
