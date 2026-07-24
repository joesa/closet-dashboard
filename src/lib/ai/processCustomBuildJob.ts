import { generateCustomSiteDraft } from '@/lib/ai/generateCustomSite'
import {
  getCustomBuildJob,
  setCustomBuildJob,
  type CustomBuildJob,
} from '@/lib/ai/customBuildJob'

/**
 * Run a queued Full redesign job. Safe to call from Next.js `after()` or a
 * cron: claims the job (queued → processing), generates, then writes the
 * result. Concurrent callers that lose the claim are no-ops.
 */
export async function processCustomBuildJob(tenantId: string): Promise<void> {
  const current = await getCustomBuildJob(tenantId)
  if (!current || current.status !== 'queued') return

  const claimed: CustomBuildJob = {
    ...current,
    status: 'processing',
    started_at: current.started_at || new Date().toISOString(),
  }
  await setCustomBuildJob(tenantId, claimed)

  try {
    const result = await generateCustomSiteDraft({
      tenantId,
      prompt: current.prompt || '',
      mode: current.mode,
      intent: current.intent === 'surgical' ? 'surgical' : 'full',
      images: Array.isArray(current.images) ? current.images : undefined,
    })
    await setCustomBuildJob(tenantId, {
      ...claimed,
      status: 'succeeded',
      images: undefined,
      reply: result.reply,
      warnings: result.warnings,
      changedPages: result.changedPages,
      error: null,
      finished_at: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[processCustomBuildJob]', tenantId, message)
    await setCustomBuildJob(tenantId, {
      ...claimed,
      status: 'failed',
      images: undefined,
      error: message,
      finished_at: new Date().toISOString(),
    })
  }
}
