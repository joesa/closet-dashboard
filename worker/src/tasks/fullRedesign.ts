import type { Task } from 'graphile-worker'
import { processCustomBuildJob } from '@/lib/ai/processCustomBuildJob'
import { getCustomBuildJob } from '@/lib/ai/customBuildJob'

export type FullRedesignPayload = {
  tenantId: string
  /** Matches custom_build_job.started_at so retries no-op after success. */
  startedAt?: string
}

/**
 * Long-running Full redesign — no Vercel maxDuration. Updates
 * site_configs.custom_build_job for the admin UI poller.
 */
export const fullRedesignTask: Task = async (payload, helpers) => {
  const { tenantId, startedAt } = payload as FullRedesignPayload
  if (!tenantId || typeof tenantId !== 'string') {
    throw new Error('full_redesign requires tenantId')
  }

  const current = await getCustomBuildJob(tenantId)
  if (
    current &&
    startedAt &&
    current.started_at === startedAt &&
    (current.status === 'succeeded' || current.status === 'failed')
  ) {
    helpers.logger.info(
      `full_redesign skip — already ${current.status} for ${tenantId}`
    )
    return
  }

  helpers.logger.info(`full_redesign start ${tenantId}`)
  await processCustomBuildJob(tenantId)

  const after = await getCustomBuildJob(tenantId)
  if (after?.status === 'failed') {
    // Surface into Graphile retries (capped via maxAttempts on enqueue).
    throw new Error(after.error || 'Full redesign failed')
  }
  helpers.logger.info(`full_redesign done ${tenantId} status=${after?.status}`)
}
