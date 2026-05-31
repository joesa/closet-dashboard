import Link from 'next/link'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import RetryJobButton from './RetryJobButton'

export const dynamic = 'force-dynamic'

type JobRow = {
  id: string
  intake_id: string
  status: string
  mode: string
  attempts: number
  last_error: string | null
  created_at: string
}

export default async function ProvisionJobsPage() {
  const admin = getSupabaseAdmin()
  const { data: jobs, error } = await admin
    .from('provision_jobs')
    .select('id, intake_id, status, mode, attempts, last_error, created_at')
    .in('status', ['pending', 'processing', 'failed', 'needs_review'])
    .order('created_at', { ascending: false })
    .limit(200)

  const rows = (jobs ?? []) as JobRow[]
  const intakeIds = [...new Set(rows.map((j) => j.intake_id))]
  const intakeMap = new Map<string, { business_name: string | null; contact_email: string | null }>()

  if (intakeIds.length > 0) {
    const { data: intakes } = await admin
      .from('prospect_intakes')
      .select('id, business_name, contact_email')
      .in('id', intakeIds)
    for (const it of intakes ?? []) {
      intakeMap.set(it.id, {
        business_name: it.business_name,
        contact_email: it.contact_email,
      })
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Provision jobs</h1>
        <p className="mt-1 text-sm text-gray-500">
          Async tenant builds from submitted intakes. Retry failed or needs-review jobs after fixing data.
        </p>
        <Link href="/admin/intakes" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
          ← Prospect intakes
        </Link>
      </div>

      {error && <p className="text-red-600 mb-4">{error.message}</p>}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Mode</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Attempts</th>
              <th className="px-4 py-3">Error</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No queued or failed jobs.
                </td>
              </tr>
            ) : (
              rows.map((job) => {
                const intake = intakeMap.get(job.intake_id)
                return (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {intake?.business_name ?? '—'}
                      <div className="text-xs text-gray-400">{intake?.contact_email}</div>
                    </td>
                    <td className="px-4 py-3">{job.mode}</td>
                    <td className="px-4 py-3">{job.status}</td>
                    <td className="px-4 py-3">{job.attempts}</td>
                    <td className="px-4 py-3 max-w-xs truncate text-red-600" title={job.last_error ?? ''}>
                      {job.last_error ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {(job.status === 'failed' || job.status === 'needs_review') && (
                        <RetryJobButton jobId={job.id} />
                      )}
                      <Link
                        href={`/admin/sandbox/onboarding?intake=${job.intake_id}`}
                        className="ml-2 text-xs text-gray-500 hover:underline"
                      >
                        Manual
                      </Link>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
