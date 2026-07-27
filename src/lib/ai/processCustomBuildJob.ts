import { generateCustomSiteDraft } from '@/lib/ai/generateCustomSite'
import {
  getCustomBuildJob,
  setCustomBuildJob,
  type CustomBuildJob,
} from '@/lib/ai/customBuildJob'

const HEARTBEAT_MS = 45_000

/**
 * Run a queued Full redesign job on the dedicated processor route
 * (fresh maxDuration budget). Claims queued → processing, heartbeats while
 * generating, then writes succeeded/failed.
 */
export async function processCustomBuildJob(tenantId: string): Promise<void> {
  const current = await getCustomBuildJob(tenantId)
  if (!current) {
    console.info('[processCustomBuildJob] skip', tenantId, 'none')
    return
  }

  // Already finished — nothing to do.
  if (current.status === 'succeeded' || current.status === 'failed') {
    console.info('[processCustomBuildJob] skip', tenantId, current.status)
    return
  }

  // Another worker already claimed this job.
  if (current.status === 'processing') {
    // Allow resume only if we were kicked while still processing (same worker
    // restart). Skip if a heartbeat is recent — another invocation is alive.
    const hb = current.heartbeat_at ? Date.parse(current.heartbeat_at) : 0
    if (Number.isFinite(hb) && Date.now() - hb < HEARTBEAT_MS * 2) {
      console.info('[processCustomBuildJob] skip — another worker alive', tenantId)
      return
    }
    // Stale processing with silent heartbeat: take over.
  }

  if (current.status !== 'queued' && current.status !== 'processing') {
    return
  }

  const claimed: CustomBuildJob = {
    ...current,
    status: 'processing',
    started_at: current.started_at || new Date().toISOString(),
    heartbeat_at: new Date().toISOString(),
    ever_full: current.ever_full || current.intent === 'full' || undefined,
  }
  await setCustomBuildJob(tenantId, claimed)
  console.info('[processCustomBuildJob] claimed', tenantId)

  let stopped = false
  const heartbeat = setInterval(() => {
    if (stopped) return
    void getCustomBuildJob(tenantId)
      .then(async (live) => {
        if (!live || live.status !== 'processing') return
        await setCustomBuildJob(tenantId, {
          ...live,
          heartbeat_at: new Date().toISOString(),
        })
      })
      .catch((err) => console.warn('[processCustomBuildJob] heartbeat failed', err))
  }, HEARTBEAT_MS)
  // Don't keep the event loop alive solely for heartbeat once work ends.
  heartbeat.unref?.()

  try {
    const result = await generateCustomSiteDraft({
      tenantId,
      prompt: current.prompt || '',
      mode: current.mode,
      intent: current.intent === 'surgical' ? 'surgical' : 'full',
      images: Array.isArray(current.images) ? current.images : undefined,
    })
    stopped = true
    clearInterval(heartbeat)
    await setCustomBuildJob(tenantId, {
      ...claimed,
      status: 'succeeded',
      images: undefined,
      reply: result.reply,
      warnings: result.warnings,
      changedPages: result.changedPages,
      error: null,
      finished_at: new Date().toISOString(),
      heartbeat_at: new Date().toISOString(),
      ever_full: true,
    })
    console.info('[processCustomBuildJob] succeeded', tenantId, result.changedPages)
  } catch (err) {
    stopped = true
    clearInterval(heartbeat)
    const message = err instanceof Error ? err.message : String(err)
    console.error('[processCustomBuildJob] failed', tenantId, message)
    await setCustomBuildJob(tenantId, {
      ...claimed,
      status: 'failed',
      images: undefined,
      error: message,
      finished_at: new Date().toISOString(),
      heartbeat_at: new Date().toISOString(),
      ever_full: claimed.ever_full || claimed.intent === 'full' || undefined,
    })
  }
}

/** Mark a queued/processing job failed so the admin UI unlocks. */
export async function cancelCustomBuildJob(
  tenantId: string,
  reason = 'Full redesign cancelled.'
): Promise<CustomBuildJob | null> {
  const current = await getCustomBuildJob(tenantId)
  if (!current) return null
  if (current.status !== 'queued' && current.status !== 'processing') return current
  const cancelled: CustomBuildJob = {
    ...current,
    status: 'failed',
    images: undefined,
    error: reason,
    finished_at: new Date().toISOString(),
    ever_full: current.ever_full || current.intent === 'full' || undefined,
  }
  await setCustomBuildJob(tenantId, cancelled)
  return cancelled
}
