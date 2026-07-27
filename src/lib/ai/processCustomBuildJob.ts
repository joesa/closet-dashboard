import { generateCustomSiteDraft } from '@/lib/ai/generateCustomSite'
import {
  getCustomBuildJob,
  setCustomBuildJob,
  type CustomBuildJob,
} from '@/lib/ai/customBuildJob'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { sanitizeCustomConfig } from '@/lib/customSite'
import { parseServiceUpdates } from '@/lib/ai/mergeBriefServices'

const HEARTBEAT_MS = 45_000

/**
 * Run a queued Full redesign job on Graphile Worker.
 * Claims queued → processing, multi-pass generates with draft checkpoints,
 * heartbeats while generating, then writes succeeded/failed.
 */
export async function processCustomBuildJob(tenantId: string): Promise<void> {
  const current = await getCustomBuildJob(tenantId)
  if (!current) {
    console.info('[processCustomBuildJob] skip', tenantId, 'none')
    return
  }

  if (current.status === 'succeeded' || current.status === 'failed') {
    console.info('[processCustomBuildJob] skip', tenantId, current.status)
    return
  }

  if (current.status === 'processing') {
    const hb = current.heartbeat_at ? Date.parse(current.heartbeat_at) : 0
    if (Number.isFinite(hb) && Date.now() - hb < HEARTBEAT_MS * 2) {
      console.info('[processCustomBuildJob] skip — another worker alive', tenantId)
      return
    }
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
    dead_lettered: false,
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
  heartbeat.unref?.()

  const patchProgress = async (patch: Partial<CustomBuildJob>) => {
    const live = await getCustomBuildJob(tenantId)
    if (!live || live.status !== 'processing') return
    await setCustomBuildJob(tenantId, {
      ...live,
      ...patch,
      heartbeat_at: new Date().toISOString(),
    })
  }

  try {
    const intent = current.intent === 'surgical' ? 'surgical' : 'full'
    if (intent === 'surgical') {
      await patchProgress({
        pass: 'surgical',
        reply: 'Applying surgical edit…',
      })
    }
    const result = await generateCustomSiteDraft({
      tenantId,
      prompt: current.prompt || '',
      mode: current.mode,
      intent,
      images: Array.isArray(current.images) ? current.images : undefined,
      resumeState:
        intent === 'full'
          ? {
              lockedBrief: current.locked_brief,
              serviceUpdates: current.service_updates
                ? parseServiceUpdates(current.service_updates)
                : null,
              foundationReply: current.foundation_reply,
            }
          : undefined,
      onProgress:
        intent === 'full'
          ? async (p) => {
              await patchProgress({
                pass: p.pass,
                passes_done: p.passesDone,
                required_paths: p.requiredPaths,
                reply: p.reply ?? undefined,
                changedPages: p.passesDone,
                locked_brief: p.lockedBrief ?? undefined,
                service_updates: p.serviceUpdates ?? undefined,
                foundation_reply: p.foundationReply ?? undefined,
              })
            }
          : async (p) => {
              await patchProgress({
                pass: p.pass || 'surgical',
                reply: p.reply ?? undefined,
                changedPages: p.passesDone,
              })
            },
      onCheckpoint:
        intent === 'full'
          ? async (draft) => {
              const supabase = getSupabaseAdmin()
              const sanitized = sanitizeCustomConfig(draft)
              const pages = sanitized.pages || {}
              const htmlSizes = Object.fromEntries(
                Object.entries(pages).map(([path, page]) => [
                  path,
                  typeof page?.html === 'string' ? page.html.length : 0,
                ])
              )
              const { error } = await supabase
                .from('site_configs')
                .update({
                  custom_config_draft: sanitized,
                  custom_updated_at: new Date().toISOString(),
                })
                .eq('tenant_id', tenantId)
              if (error) {
                console.warn(
                  '[processCustomBuildJob] checkpoint failed',
                  tenantId,
                  error.message
                )
              } else {
                console.info(
                  JSON.stringify({
                    event: 'custom_build_checkpoint',
                    tenantId,
                    intent,
                    pageCount: Object.keys(pages).length,
                    htmlSizes,
                  })
                )
              }
            }
          : undefined,
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
      pass: intent === 'surgical' ? 'surgical_done' : 'done',
      passes_done: result.changedPages,
      error: null,
      finished_at: new Date().toISOString(),
      heartbeat_at: new Date().toISOString(),
      ever_full: claimed.ever_full || intent === 'full' || undefined,
      dead_lettered: false,
    })
    console.info(
      '[processCustomBuildJob] succeeded',
      tenantId,
      intent,
      result.changedPages
    )
  } catch (err) {
    stopped = true
    clearInterval(heartbeat)
    const message = err instanceof Error ? err.message : String(err)
    console.error('[processCustomBuildJob] failed', tenantId, message)
    const live = await getCustomBuildJob(tenantId)
    await setCustomBuildJob(tenantId, {
      ...(live && live.status === 'processing' ? live : claimed),
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
    dead_lettered: false,
  }
  await setCustomBuildJob(tenantId, cancelled)
  return cancelled
}

/**
 * Re-queue a failed/dead-lettered custom build job without clearing the draft.
 * Full redesign resumes remaining empty pages; surgical re-runs the same prompt.
 */
export async function requeueCustomBuildJob(
  tenantId: string
): Promise<CustomBuildJob> {
  const current = await getCustomBuildJob(tenantId)
  if (!current) {
    throw new Error('No custom build job to re-queue.')
  }
  if (current.status === 'queued' || current.status === 'processing') {
    throw new Error('Job is already active.')
  }
  const intent = current.intent === 'surgical' ? 'surgical' : 'full'
  if (intent !== 'surgical' && current.intent !== 'full' && !current.ever_full) {
    throw new Error('Only Full redesign or surgical jobs can be re-queued.')
  }
  const startedAt = new Date().toISOString()
  const job: CustomBuildJob = {
    ...current,
    status: 'queued',
    intent,
    error: null,
    finished_at: null,
    started_at: startedAt,
    heartbeat_at: null,
    pass: intent === 'surgical' ? 'surgical' : 'queued',
    dead_lettered: false,
    reply:
      intent === 'surgical'
        ? 'Re-queued surgical edit…'
        : `Re-queued from checkpoint (done: ${(current.passes_done || []).join(', ') || 'none yet'})…`,
    ever_full: current.ever_full || intent === 'full' || undefined,
  }
  await setCustomBuildJob(tenantId, job)
  return job
}
