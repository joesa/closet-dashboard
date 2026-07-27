import type { Task } from 'graphile-worker'
import { processCustomBuildJob } from '@/lib/ai/processCustomBuildJob'
import {
  getCustomBuildJob,
  setCustomBuildJob,
} from '@/lib/ai/customBuildJob'

export type FullRedesignPayload = {
  tenantId: string
  /** Matches custom_build_job.started_at so retries resume the same run. */
  startedAt?: string
}

/**
 * Long-running Full redesign — no Vercel maxDuration. Updates
 * site_configs.custom_build_job for the admin UI poller.
 *
 * Multi-pass: each page is checkpointed to custom_config_draft. Graphile
 * retries (and stale-heartbeat reclaim) resume remaining paths instead of
 * regenerating completed ones. Admin cancel / a new Full redesign (new
 * startedAt + cleared draft) starts fresh.
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
    current.status === 'succeeded'
  ) {
    helpers.logger.info(`full_redesign skip — already succeeded for ${tenantId}`)
    return
  }

  // Admin cancel — do not reopen on Graphile retry.
  if (
    current &&
    startedAt &&
    current.started_at === startedAt &&
    current.status === 'failed' &&
    /cancel/i.test(current.error || '')
  ) {
    helpers.logger.info(`full_redesign skip — cancelled for ${tenantId}`)
    return
  }

  // Soft failure retry: reopen the same run so multipass can resume from draft.
  if (
    current &&
    startedAt &&
    current.started_at === startedAt &&
    current.status === 'failed'
  ) {
    const done = (current.passes_done || []).join(', ') || 'none yet'
    helpers.logger.info(
      `full_redesign reopen after failure ${tenantId} (checkpointed: ${done})`
    )
    await setCustomBuildJob(tenantId, {
      ...current,
      status: 'queued',
      error: null,
      finished_at: null,
      pass: 'resume',
      reply: `Retrying from checkpoint (done: ${done})…`,
    })
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
