import { getSupabaseAdmin } from '@/lib/supabase-admin'

export type CustomBuildJobStatus =
  | 'queued'
  | 'processing'
  | 'succeeded'
  | 'failed'

export type CustomBuildJob = {
  status: CustomBuildJobStatus
  intent: 'full' | 'surgical'
  prompt: string
  mode?: 'inline' | 'iframe'
  /** Reference images as data URLs — cleared when the job finishes. */
  images?: string[]
  error?: string | null
  reply?: string | null
  warnings?: string[]
  changedPages?: string[]
  started_at: string
  finished_at?: string | null
  /**
   * Sticky flag: once a Full redesign has been started for this tenant,
   * keep it so the admin UI can show the Full redesign button again later
   * even if the latest job was surgical.
   */
  ever_full?: boolean
  /** Updated while the dedicated processor is alive — used for stale checks. */
  heartbeat_at?: string | null
}

/**
 * Wall-clock budget for the whole redesign (enhance + Claude + images).
 * Work runs on `/api/internal/process-custom-build` with maxDuration 800s;
 * allow headroom so the UI does not expire a still-running worker.
 */
export const CUSTOM_BUILD_JOB_STALE_MS = 14 * 60 * 1000

/** Re-kick processor if a job sits in queued without being claimed. */
export const CUSTOM_BUILD_JOB_REQUEUE_MS = 45 * 1000

/** True once this tenant has ever queued/run a Full redesign. */
export function hasEverFullRedesign(job: CustomBuildJob | null | undefined): boolean {
  if (!job) return false
  return job.ever_full === true || job.intent === 'full'
}

export function isCustomBuildJob(value: unknown): value is CustomBuildJob {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const v = value as Record<string, unknown>
  return (
    (v.status === 'queued' ||
      v.status === 'processing' ||
      v.status === 'succeeded' ||
      v.status === 'failed') &&
    typeof v.started_at === 'string'
  )
}

export function jobAgeMs(
  job: CustomBuildJob | null | undefined,
  nowMs: number = Date.now()
): number {
  if (!job?.started_at) return 0
  const started = Date.parse(job.started_at)
  if (!Number.isFinite(started)) return 0
  return Math.max(0, nowMs - started)
}

/** Age since last heartbeat (or started_at if none). */
export function jobIdleMs(
  job: CustomBuildJob | null | undefined,
  nowMs: number = Date.now()
): number {
  if (!job) return 0
  const anchor = job.heartbeat_at || job.started_at
  if (!anchor) return 0
  const t = Date.parse(anchor)
  if (!Number.isFinite(t)) return 0
  return Math.max(0, nowMs - t)
}

export function isCustomBuildJobStale(
  job: CustomBuildJob | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!job) return false
  if (job.status !== 'queued' && job.status !== 'processing') return false
  // Queued jobs: expire on wall clock from started_at.
  // Processing: expire if heartbeat went silent past the stale window
  // (covers a hard-killed 800s worker without failing a healthy long run).
  if (job.status === 'processing') {
    return jobIdleMs(job, nowMs) >= CUSTOM_BUILD_JOB_STALE_MS
  }
  return jobAgeMs(job, nowMs) >= CUSTOM_BUILD_JOB_STALE_MS
}

/**
 * If a queued/processing job outlived the serverless budget, mark it failed
 * so the admin UI unlocks. Returns the (possibly updated) job.
 */
export function expireStaleCustomBuildJob(
  job: CustomBuildJob | null,
  nowMs: number = Date.now()
): CustomBuildJob | null {
  if (!job || !isCustomBuildJobStale(job, nowMs)) return job
  return {
    ...job,
    status: 'failed',
    images: undefined,
    error:
      job.error ||
      'Full redesign stopped after the server budget elapsed. Click Full redesign to try again — the job will keep running in the background until it finishes.',
    finished_at: new Date(nowMs).toISOString(),
    ever_full: job.ever_full || job.intent === 'full' || undefined,
  }
}

export async function getCustomBuildJob(
  tenantId: string
): Promise<CustomBuildJob | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('site_configs')
    .select('custom_build_job')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (error || !data) return null
  return isCustomBuildJob(data.custom_build_job) ? data.custom_build_job : null
}

export async function setCustomBuildJob(
  tenantId: string,
  job: CustomBuildJob | null
): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('site_configs')
    .update({ custom_build_job: job })
    .eq('tenant_id', tenantId)
  if (error) throw new Error(`Failed to update custom build job: ${error.message}`)
}

/**
 * Load job, expire if stale (persist), return the live job for API responses.
 */
export async function getAndReconcileCustomBuildJob(
  tenantId: string
): Promise<CustomBuildJob | null> {
  const current = await getCustomBuildJob(tenantId)
  const reconciled = expireStaleCustomBuildJob(current)
  if (
    reconciled &&
    current &&
    reconciled.status === 'failed' &&
    current.status !== 'failed'
  ) {
    await setCustomBuildJob(tenantId, reconciled)
  }
  return reconciled
}

/** True when a redesign is still running (UI should poll). */
export function isCustomBuildJobActive(job: CustomBuildJob | null | undefined): boolean {
  if (!job) return false
  if (isCustomBuildJobStale(job)) return false
  return job.status === 'queued' || job.status === 'processing'
}

/** True when queued long enough that the processor likely never claimed it. */
export function shouldRequeueCustomBuildJob(
  job: CustomBuildJob | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!job || job.status !== 'queued') return false
  if (isCustomBuildJobStale(job, nowMs)) return false
  return jobAgeMs(job, nowMs) >= CUSTOM_BUILD_JOB_REQUEUE_MS
}

/**
 * Tenant ids with queued/processing Full redesign jobs (for cron / sweep).
 * Caps at 20 to keep cron invocations light.
 */
export async function listActiveCustomBuildTenantIds(): Promise<string[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('site_configs')
    .select('tenant_id, custom_build_job')
    .not('custom_build_job', 'is', null)
    .limit(80)
  if (error || !data) return []

  const now = Date.now()
  const ids: string[] = []
  for (const row of data) {
    if (ids.length >= 20) break
    const job = isCustomBuildJob(row.custom_build_job) ? row.custom_build_job : null
    if (!job) continue
    if (job.status !== 'queued' && job.status !== 'processing') continue
    if (isCustomBuildJobStale(job, now)) continue
    if (typeof row.tenant_id === 'string') ids.push(row.tenant_id)
  }
  return ids
}
