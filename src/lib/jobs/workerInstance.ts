import type { Pool } from 'pg'

/**
 * Worker build/liveness registry.
 *
 * The worker runs in a container on a VM with no inbound port, so the only way
 * to see which commit it was running was to SSH in. The queue cannot stand in
 * for that: when nothing is runnable, a live worker and a dead one produce
 * identical `graphile_worker.jobs` state. Each boot writes a row and then
 * heartbeats, which makes both questions answerable from the database.
 *
 * Write side runs in the worker (pg pool). Read side runs in Next (see
 * readWorkerInstances) so the admin API can show it.
 */

/** Heartbeat cadence. */
export const WORKER_HEARTBEAT_MS = 30_000

/**
 * How long after its last heartbeat an instance is presumed dead. Three missed
 * beats rather than one — a Full redesign pegging the event loop must not make
 * a healthy worker flap to "stale" on every page pass.
 */
export const WORKER_STALE_AFTER_MS = WORKER_HEARTBEAT_MS * 3

export type WorkerInstanceIdentity = {
  id: string
  gitSha: string | null
  imageBuiltAt: string | null
  hostname: string | null
  concurrency: number
  taskIds: string[]
}

export type WorkerInstanceRow = {
  id: string
  git_sha: string | null
  image_built_at: string | null
  hostname: string | null
  concurrency: number | null
  task_ids: string[] | null
  started_at: string
  last_seen_at: string
  stopped_at: string | null
}

export type WorkerInstanceStatus = WorkerInstanceRow & {
  /** Heartbeat is recent and no graceful shutdown was recorded. */
  alive: boolean
  msSinceHeartbeat: number
}

/** Commit baked into the image by the GIT_SHA build arg; null if built without one. */
export function workerGitSha(): string | null {
  return process.env.WORKER_GIT_SHA?.trim() || null
}

function workerImageBuiltAt(): string | null {
  const raw = process.env.WORKER_IMAGE_BUILT_AT?.trim()
  if (!raw) return null
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

/**
 * Identity for this process. The id is per boot, not per host — a redeploy
 * writes a new row so the previous build's history survives, and a
 * crash-looping container leaves a visible trail instead of one mutating row.
 */
export function buildWorkerIdentity(opts: {
  hostname: string
  concurrency: number
  taskIds: string[]
  now?: Date
  random?: () => number
}): WorkerInstanceIdentity {
  const now = opts.now ?? new Date()
  const rand = opts.random ?? Math.random
  const suffix = Math.floor(rand() * 0xffffff)
    .toString(16)
    .padStart(6, '0')
  return {
    id: `${opts.hostname}-${now.getTime().toString(36)}-${suffix}`,
    gitSha: workerGitSha(),
    imageBuiltAt: workerImageBuiltAt(),
    hostname: opts.hostname,
    concurrency: opts.concurrency,
    taskIds: opts.taskIds,
  }
}

/**
 * Record this boot. Best-effort by design: the registry is observability, so a
 * failure here must never stop the worker from claiming jobs. Callers get the
 * error back for logging rather than a throw.
 */
export async function registerWorkerInstance(
  pool: Pool,
  identity: WorkerInstanceIdentity
): Promise<{ ok: boolean; error?: string }> {
  try {
    await pool.query(
      `insert into public.worker_instances
         (id, git_sha, image_built_at, hostname, concurrency, task_ids, started_at, last_seen_at)
       values ($1, $2, $3, $4, $5, $6, now(), now())
       on conflict (id) do update
         set last_seen_at = now(), stopped_at = null`,
      [
        identity.id,
        identity.gitSha,
        identity.imageBuiltAt,
        identity.hostname,
        identity.concurrency,
        identity.taskIds,
      ]
    )
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** Advance last_seen_at. Best-effort, same reasoning as registerWorkerInstance. */
export async function heartbeatWorkerInstance(
  pool: Pool,
  id: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await pool.query(
      'update public.worker_instances set last_seen_at = now() where id = $1',
      [id]
    )
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** Mark a clean exit. A killed worker never gets here — that is the point. */
export async function markWorkerInstanceStopped(
  pool: Pool,
  id: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await pool.query(
      'update public.worker_instances set stopped_at = now(), last_seen_at = now() where id = $1',
      [id]
    )
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Drop rows for boots that ended long ago. Keeps the table from growing one row
 * per redeploy forever without hiding recent deploy history.
 */
export async function pruneWorkerInstances(
  pool: Pool,
  opts: { olderThanDays?: number } = {}
): Promise<number> {
  const days = opts.olderThanDays ?? 30
  try {
    const res = await pool.query(
      `delete from public.worker_instances
        where last_seen_at < now() - ($1 || ' days')::interval`,
      [String(days)]
    )
    return res.rowCount ?? 0
  } catch {
    return 0
  }
}

/** Decorate rows with liveness, newest boot first. */
export function summarizeWorkerInstances(
  rows: WorkerInstanceRow[],
  now: Date = new Date()
): WorkerInstanceStatus[] {
  return rows
    .map((row) => {
      const msSinceHeartbeat = now.getTime() - new Date(row.last_seen_at).getTime()
      return {
        ...row,
        msSinceHeartbeat,
        alive: !row.stopped_at && msSinceHeartbeat <= WORKER_STALE_AFTER_MS,
      }
    })
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
}
