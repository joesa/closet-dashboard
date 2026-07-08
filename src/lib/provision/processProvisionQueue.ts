import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  provisionFromIntakeJob,
  classifyProvisionError,
  type ProvisionJobRow,
} from '@/lib/provision/provisionFromIntake'

const MAX_ATTEMPTS = parseInt(process.env.PROVISION_MAX_ATTEMPTS || '3', 10)
const BATCH_SIZE = parseInt(process.env.PROVISION_BATCH_SIZE || '5', 10)

export type ProvisionQueueResult = {
  jobId: string
  status: string
  error?: string
}

/** Process pending provision jobs (shared by cron and post-submit kick). */
export async function processProvisionQueue(
  loginOrigin: string,
  options?: { batchSize?: number; intakeId?: string }
): Promise<ProvisionQueueResult[]> {
  const admin = getSupabaseAdmin()
  const batchSize = options?.batchSize ?? BATCH_SIZE
  const results: ProvisionQueueResult[] = []

  let query = admin
    .from('provision_jobs')
    .select('id, intake_id, status, mode, attempts')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(batchSize)

  if (options?.intakeId) {
    query = query.eq('intake_id', options.intakeId)
  }

  const { data: pending } = await query

  for (const job of pending ?? []) {
    const started = new Date().toISOString()
    await admin
      .from('provision_jobs')
      .update({ status: 'processing', started_at: started, attempts: job.attempts + 1 })
      .eq('id', job.id)
      .eq('status', 'pending')

    try {
      await provisionFromIntakeJob(job as ProvisionJobRow, loginOrigin)
      await admin
        .from('provision_jobs')
        .update({
          status: 'succeeded',
          finished_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('id', job.id)
      results.push({ jobId: job.id, status: 'succeeded' })
    } catch (err) {
      const kind = classifyProvisionError(err)
      const message = err instanceof Error ? err.message : String(err)
      const attempts = job.attempts + 1
      const needsReview = kind === 'needs_review'
      const terminal = needsReview || attempts >= MAX_ATTEMPTS
      const nextStatus = needsReview ? 'needs_review' : terminal ? 'failed' : 'pending'

      await admin
        .from('provision_jobs')
        .update({
          status: nextStatus,
          last_error: message,
          finished_at: terminal ? new Date().toISOString() : null,
        })
        .eq('id', job.id)

      results.push({ jobId: job.id, status: nextStatus, error: message })
      console.error('provision job error', job.id, message)
    }
  }

  return results
}
