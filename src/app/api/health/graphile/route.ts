import { NextResponse } from 'next/server'
import {
  canEnqueueBackgroundJobs,
  createGraphilePool,
  getGraphileDatabaseUrl,
} from '@/lib/jobs/databaseUrl'
import { WORKER_STALE_AFTER_MS } from '@/lib/jobs/workerInstance'

/**
 * Production readiness for background work.
 *
 * This proved only that Vercel could reach Postgres — `select 1`. It said
 * nothing about whether a worker was alive to claim the jobs, which is the
 * thing that actually breaks: the VM can be down for hours while this endpoint
 * reports healthy. The heartbeat that answers it existed already, but only
 * behind requireAdmin, so no external uptime monitor could ever see it.
 *
 * Reports the worker as a separate field rather than failing the whole check:
 * enqueue genuinely still works with no worker running, and jobs wait rather
 * than fail. Monitors should alert on `workerAlive`.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const isProd = process.env.NODE_ENV === 'production'
  const configured = canEnqueueBackgroundJobs()

  if (!configured) {
    return NextResponse.json(
      {
        ok: false,
        graphile: false,
        error: 'DATABASE_URL is not configured',
      },
      { status: isProd ? 503 : 200 }
    )
  }

  let reachable = false
  let detail: string | null = null
  const pool = createGraphilePool()
  try {
    getGraphileDatabaseUrl()
    await pool.query('select 1 as ok')
    reachable = true
  } catch (err) {
    detail = err instanceof Error ? err.message : String(err)
  } finally {
    await pool.end().catch(() => undefined)
  }

  if (!reachable) {
    return NextResponse.json(
      {
        ok: false,
        graphile: false,
        error: detail || 'DATABASE_URL unreachable',
      },
      { status: isProd ? 503 : 200 }
    )
  }

  // Is anything actually claiming jobs? Read from the heartbeat registry, not
  // from graphile's internals, so a worker that is up but wedged still counts
  // as stale once its beat stops.
  let workerAlive = false
  let lastSeenAt: string | null = null
  const registryPool = createGraphilePool()
  try {
    const { rows } = await registryPool.query<{ last_seen_at: string }>(
      `select last_seen_at from public.worker_instances
        where stopped_at is null
        order by last_seen_at desc
        limit 1`
    )
    lastSeenAt = rows[0]?.last_seen_at ?? null
    if (lastSeenAt) {
      workerAlive = Date.now() - new Date(lastSeenAt).getTime() < WORKER_STALE_AFTER_MS
    }
  } catch (err) {
    detail = err instanceof Error ? err.message : String(err)
  } finally {
    await registryPool.end().catch(() => undefined)
  }

  return NextResponse.json({
    ok: true,
    graphile: true,
    workerAlive,
    workerLastSeenAt: lastSeenAt,
    staleAfterMs: WORKER_STALE_AFTER_MS,
    ...(detail ? { workerDetail: detail } : {}),
  })
}
