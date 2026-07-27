import {
  CUSTOM_BUILD_JOB_QUEUED_ALERT_MS,
  CUSTOM_BUILD_JOB_STALE_MS,
  isCustomBuildJob,
  jobAgeMs,
  jobIdleMs,
  type CustomBuildJob,
} from '@/lib/ai/customBuildJob'
import { canEnqueueBackgroundJobs, createGraphilePool } from '@/lib/jobs/databaseUrl'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export type CustomBuildJobRow = {
  tenantId: string
  brandName: string | null
  job: CustomBuildJob
  alert: 'queued_slow' | 'stale_heartbeat' | null
}

export type GraphileJobRow = {
  id: string
  taskIdentifier: string
  attempts: number
  maxAttempts: number
  runAt: string | null
  createdAt: string | null
  lockedAt: string | null
  lastError: string | null
  key: string | null
  payload: unknown
}

export type BackgroundJobsSnapshot = {
  databaseConfigured: boolean
  customBuilds: CustomBuildJobRow[]
  graphileJobs: GraphileJobRow[]
  graphileError: string | null
  alerts: Array<{ kind: string; tenantId?: string; message: string }>
}

function classifyAlert(job: CustomBuildJob, now: number): CustomBuildJobRow['alert'] {
  if (job.status === 'queued' && jobAgeMs(job, now) >= CUSTOM_BUILD_JOB_QUEUED_ALERT_MS) {
    return 'queued_slow'
  }
  if (
    job.status === 'processing' &&
    jobIdleMs(job, now) >= Math.min(CUSTOM_BUILD_JOB_STALE_MS, 5 * 60 * 1000)
  ) {
    // Surface early warning after 5m silence (full expire is 45m).
    return 'stale_heartbeat'
  }
  return null
}

export async function listCustomBuildJobRows(): Promise<CustomBuildJobRow[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('site_configs')
    .select('tenant_id, brand_name, custom_build_job')
    .not('custom_build_job', 'is', null)
    .limit(200)
  if (error || !data) return []

  const now = Date.now()
  const rows: CustomBuildJobRow[] = []
  for (const row of data) {
    const job = isCustomBuildJob(row.custom_build_job) ? row.custom_build_job : null
    if (!job) continue
    if (
      job.status !== 'queued' &&
      job.status !== 'processing' &&
      job.status !== 'failed'
    ) {
      continue
    }
    // Keep recent failures + all active.
    if (job.status === 'failed') {
      const finished = job.finished_at ? Date.parse(job.finished_at) : 0
      if (Number.isFinite(finished) && now - finished > 7 * 24 * 60 * 60 * 1000) continue
    }
    if (typeof row.tenant_id !== 'string') continue
    rows.push({
      tenantId: row.tenant_id,
      brandName: typeof row.brand_name === 'string' ? row.brand_name : null,
      job,
      alert: classifyAlert(job, now),
    })
  }
  rows.sort((a, b) => {
    const aPri = a.alert ? 0 : a.job.status === 'failed' ? 2 : 1
    const bPri = b.alert ? 0 : b.job.status === 'failed' ? 2 : 1
    if (aPri !== bPri) return aPri - bPri
    return (b.job.started_at || '').localeCompare(a.job.started_at || '')
  })
  return rows
}

export async function listGraphileJobs(): Promise<{
  jobs: GraphileJobRow[]
  error: string | null
}> {
  if (!canEnqueueBackgroundJobs()) {
    return { jobs: [], error: 'DATABASE_URL not configured' }
  }
  const pool = createGraphilePool()
  try {
    const { rows } = await pool.query<{
      id: string
      task_identifier: string
      attempts: number
      max_attempts: number
      run_at: Date | null
      created_at: Date | null
      locked_at: Date | null
      last_error: string | null
      key: string | null
      payload: unknown
    }>(
      `select id::text, task_identifier, attempts, max_attempts,
              run_at, created_at, locked_at, last_error, key, payload
         from graphile_worker.jobs
        order by created_at desc nulls last
        limit 100`
    )
    return {
      jobs: rows.map((r) => ({
        id: r.id,
        taskIdentifier: r.task_identifier,
        attempts: r.attempts,
        maxAttempts: r.max_attempts,
        runAt: r.run_at ? r.run_at.toISOString() : null,
        createdAt: r.created_at ? r.created_at.toISOString() : null,
        lockedAt: r.locked_at ? r.locked_at.toISOString() : null,
        lastError: r.last_error,
        key: r.key,
        payload: r.payload,
      })),
      error: null,
    }
  } catch (err) {
    return {
      jobs: [],
      error: err instanceof Error ? err.message : String(err),
    }
  } finally {
    await pool.end().catch(() => undefined)
  }
}

export async function getBackgroundJobsSnapshot(): Promise<BackgroundJobsSnapshot> {
  const customBuilds = await listCustomBuildJobRows()
  const { jobs: graphileJobs, error: graphileError } = await listGraphileJobs()
  const alerts: BackgroundJobsSnapshot['alerts'] = []
  for (const row of customBuilds) {
    if (row.alert === 'queued_slow') {
      alerts.push({
        kind: 'queued_slow',
        tenantId: row.tenantId,
        message: `Full redesign queued >2m for ${row.brandName || row.tenantId}`,
      })
    }
    if (row.alert === 'stale_heartbeat') {
      alerts.push({
        kind: 'stale_heartbeat',
        tenantId: row.tenantId,
        message: `Full redesign stale heartbeat for ${row.brandName || row.tenantId}`,
      })
    }
    if (row.job.dead_lettered) {
      alerts.push({
        kind: 'dead_lettered',
        tenantId: row.tenantId,
        message: `Dead-lettered Full redesign for ${row.brandName || row.tenantId}`,
      })
    }
  }
  return {
    databaseConfigured: canEnqueueBackgroundJobs(),
    customBuilds,
    graphileJobs,
    graphileError,
    alerts,
  }
}
