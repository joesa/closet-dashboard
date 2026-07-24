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

/** True when a redesign is still running (UI should poll). */
export function isCustomBuildJobActive(job: CustomBuildJob | null | undefined): boolean {
  return !!job && (job.status === 'queued' || job.status === 'processing')
}
