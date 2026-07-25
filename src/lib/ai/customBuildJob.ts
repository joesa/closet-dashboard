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
}

/**
 * Vercel maxDuration is 300s. Expire shortly after so a hard-killed worker
 * cannot leave the admin UI stuck on Working for many extra minutes.
 */
export const CUSTOM_BUILD_JOB_STALE_MS = 5.5 * 60 * 1000

/** Re-kick `after()` if a job sits in queued without being claimed. */
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

export function isCustomBuildJobStale(
  job: CustomBuildJob | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!job) return false
  if (job.status !== 'queued' && job.status !== 'processing') return false
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
      'Full redesign timed out (server stopped after ~5 minutes). Click Full redesign to try again — a shorter brief or fewer reference images can help.',
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

/** True when queued long enough that `after()` likely never claimed it. */
export function shouldRequeueCustomBuildJob(
  job: CustomBuildJob | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!job || job.status !== 'queued') return false
  if (isCustomBuildJobStale(job, nowMs)) return false
  return jobAgeMs(job, nowMs) >= CUSTOM_BUILD_JOB_REQUEUE_MS
}
