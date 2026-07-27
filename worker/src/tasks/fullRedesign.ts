import type { Task } from 'graphile-worker'
import { processCustomBuildJob } from '@/lib/ai/processCustomBuildJob'
import {
  getCustomBuildJob,
  setCustomBuildJob,
} from '@/lib/ai/customBuildJob'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { isCustomSiteConfig } from '@/lib/customSite'

export type FullRedesignPayload = {
  tenantId: string
  /** Matches custom_build_job.started_at so retries resume the same run. */
  startedAt?: string
}

function htmlSizesFromDraft(draft: unknown): Record<string, number> {
  if (!isCustomSiteConfig(draft)) return {}
  const out: Record<string, number> = {}
  for (const [path, page] of Object.entries(draft.pages || {})) {
    out[path] = typeof page?.html === 'string' ? page.html.length : 0
  }
  return out
}

/**
 * Long-running custom build (Full redesign or surgical) — no Vercel maxDuration.
 * Updates site_configs.custom_build_job for the admin UI poller.
 *
 * Full: multipass with draft checkpoints; Graphile retries resume remaining paths.
 * Surgical: one model call on the existing draft (draft is not cleared on enqueue).
 */
export const fullRedesignTask: Task = async (payload, helpers) => {
  const { tenantId, startedAt } = payload as FullRedesignPayload
  if (!tenantId || typeof tenantId !== 'string') {
    throw new Error('full_redesign requires tenantId')
  }

  const jobId = helpers.job.id
  const attempt = helpers.job.attempts
  const maxAttempts = helpers.job.max_attempts
  const t0 = Date.now()

  const current = await getCustomBuildJob(tenantId)
  const intent = current?.intent === 'surgical' ? 'surgical' : 'full'

  if (
    current &&
    startedAt &&
    current.started_at === startedAt &&
    current.status === 'succeeded'
  ) {
    helpers.logger.info(
      JSON.stringify({
        event: 'custom_build_skip',
        reason: 'succeeded',
        intent,
        tenantId,
        jobId,
        attempt,
      })
    )
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
    helpers.logger.info(
      JSON.stringify({
        event: 'custom_build_skip',
        reason: 'cancelled',
        intent,
        tenantId,
        jobId,
        attempt,
      })
    )
    return
  }

  // Soft failure retry: reopen the same run (full resumes checkpoints; surgical re-runs).
  if (
    current &&
    startedAt &&
    current.started_at === startedAt &&
    current.status === 'failed'
  ) {
    const done = (current.passes_done || []).join(', ') || 'none yet'
    helpers.logger.info(
      JSON.stringify({
        event: 'custom_build_reopen',
        intent,
        tenantId,
        jobId,
        attempt,
        maxAttempts,
        checkpointed: done,
      })
    )
    await setCustomBuildJob(tenantId, {
      ...current,
      status: 'queued',
      error: null,
      finished_at: null,
      pass: intent === 'surgical' ? 'surgical' : 'resume',
      dead_lettered: false,
      reply:
        intent === 'surgical'
          ? 'Retrying surgical edit…'
          : `Retrying from checkpoint (done: ${done})…`,
    })
  }

  helpers.logger.info(
    JSON.stringify({
      event: 'custom_build_start',
      intent,
      tenantId,
      jobId,
      attempt,
      maxAttempts,
      passesDone: current?.passes_done || [],
    })
  )
  await processCustomBuildJob(tenantId)

  const after = await getCustomBuildJob(tenantId)
  const afterIntent = after?.intent === 'surgical' ? 'surgical' : intent
  const durationMs = Date.now() - t0
  let htmlSizes: Record<string, number> = {}
  try {
    const { data } = await getSupabaseAdmin()
      .from('site_configs')
      .select('custom_config_draft')
      .eq('tenant_id', tenantId)
      .maybeSingle()
    htmlSizes = htmlSizesFromDraft(data?.custom_config_draft)
  } catch {
    /* ignore size probe errors */
  }

  const pageCount = Object.keys(htmlSizes).length
  if (after?.status === 'failed') {
    const finalAttempt = Number(attempt) >= Number(maxAttempts || 3)
    if (finalAttempt) {
      await setCustomBuildJob(tenantId, {
        ...after,
        dead_lettered: true,
      })
    }
    helpers.logger.error(
      JSON.stringify({
        event: 'custom_build_failed',
        intent: afterIntent,
        tenantId,
        jobId,
        attempt,
        maxAttempts,
        durationMs,
        pageCount,
        htmlSizes,
        deadLettered: finalAttempt,
        error: after.error,
      })
    )
    throw new Error(after.error || 'Custom build failed')
  }

  helpers.logger.info(
    JSON.stringify({
      event: 'custom_build_done',
      intent: afterIntent,
      tenantId,
      jobId,
      attempt,
      maxAttempts,
      durationMs,
      pageCount,
      htmlSizes,
      status: after?.status,
      passesDone: after?.passes_done || [],
    })
  )
}
