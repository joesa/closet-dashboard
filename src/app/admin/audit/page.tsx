import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Row = {
  id: number
  action: string
  actor_email: string | null
  target_type: string | null
  target_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export default async function AdminAuditPage() {
  const admin = getSupabaseAdmin()
  const { data } = await admin
    .from('admin_audit_log')
    .select('id, action, actor_email, target_type, target_id, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  const rows = (data ?? []) as Row[]

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">Audit Log</h1>
        <p className="mt-1 text-sm text-gray-500">
          Last 200 privileged actions taken from the admin surface.
        </p>
      </header>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2 font-medium">When</th>
              <th className="px-4 py-2 font-medium">Actor</th>
              <th className="px-4 py-2 font-medium">Action</th>
              <th className="px-4 py-2 font-medium">Target</th>
              <th className="px-4 py-2 font-medium">Metadata</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No admin actions logged yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-gray-500">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-gray-700">
                    {r.actor_email ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-gray-900">
                    {r.action}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-gray-600">
                    {r.target_type ? `${r.target_type}:${r.target_id ?? ''}` : '—'}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500">
                    <pre className="max-w-md overflow-x-auto whitespace-pre-wrap break-words font-mono">
                      {Object.keys(r.metadata ?? {}).length === 0
                        ? '—'
                        : JSON.stringify(r.metadata, null, 2)}
                    </pre>
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
