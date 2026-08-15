import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  summarizeWorkerInstances,
  type WorkerInstanceRow,
} from '@/lib/jobs/workerInstance'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/worker-status — which build of the Graphile Worker is running.
 *
 * Admin-gated: the commit SHA and hostname are deployment detail, not public
 * health. For the unauthenticated enqueue-readiness probe see
 * /api/health/graphile.
 */
export async function GET() {
  await requireAdmin()

  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('worker_instances')
    .select(
      'id, git_sha, image_built_at, hostname, concurrency, task_ids, started_at, last_seen_at, stopped_at'
    )
    .order('started_at', { ascending: false })
    .limit(10)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 503 })
  }

  const instances = summarizeWorkerInstances((data ?? []) as WorkerInstanceRow[])
  const live = instances.filter((i) => i.alive)

  return NextResponse.json({
    ok: true,
    // False is a real answer, not an error: no live worker means nothing is
    // claiming jobs, which is exactly what the caller wants to know.
    workerAlive: live.length > 0,
    runningBuilds: [...new Set(live.map((i) => i.git_sha ?? 'unknown'))],
    instances,
  })
}
