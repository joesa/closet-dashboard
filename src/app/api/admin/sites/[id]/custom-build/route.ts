import { NextResponse } from 'next/server'
import { getCurrentAdmin, logAdminAction } from '@/lib/admin'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  discardCustomDraft,
  generateCustomSiteDraft,
  publishCustomSiteDraft,
  revertToEngine,
} from '@/lib/ai/generateCustomSite'
import { cloneCurrentSiteToDraft } from '@/lib/ai/cloneEngineSite'
import { diffCustomDraftPages } from '@/lib/ai/customDraftDiff'
import { isCustomSiteConfig } from '@/lib/customSite'
import {
  getAndReconcileCustomBuildJob,
  hasEverFullRedesign,
  isCustomBuildJobActive,
  setCustomBuildJob,
  shouldRequeueCustomBuildJob,
} from '@/lib/ai/customBuildJob'
import { cancelCustomBuildJob } from '@/lib/ai/processCustomBuildJob'
import { canEnqueueBackgroundJobs, enqueueJob } from '@/lib/jobs/enqueueJob'
import { TASK_FULL_REDESIGN } from '@/lib/jobs/taskIds'
import { normalizeAdminImageRefs } from '@/lib/adminImageAttach'

// Full redesign is enqueued to Graphile Worker (Render) — this route only
// writes UI status + add_job. No Vercel maxDuration for the AI work itself.
export const maxDuration = 60
export const runtime = 'nodejs'

async function enqueueFullRedesign(tenantId: string, startedAt: string) {
  if (!canEnqueueBackgroundJobs()) {
    throw new Error(
      'DATABASE_URL is not configured — cannot enqueue Full redesign. Set a session-mode Postgres URI and run the Graphile Worker.'
    )
  }
  await enqueueJob(
    TASK_FULL_REDESIGN,
    { tenantId, startedAt },
    {
      jobKey: `full_redesign:${tenantId}`,
      jobKeyMode: 'replace',
      maxAttempts: 3,
    }
  )
}

async function loadCustomBuildStatus(tenantId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('site_configs')
    .select(
      'render_mode, custom_config, custom_config_draft, custom_updated_at, custom_build_job'
    )
    .eq('tenant_id', tenantId)
    .single()
  if (error || !data) return null

  const draft = isCustomSiteConfig(data.custom_config_draft)
    ? data.custom_config_draft
    : null
  const published = isCustomSiteConfig(data.custom_config) ? data.custom_config : null
  const draftDiffPages = diffCustomDraftPages(draft, published)
  const job = await getAndReconcileCustomBuildJob(tenantId)
  if (shouldRequeueCustomBuildJob(job) && job) {
    // Dead-letter re-enqueue if the worker never claimed a queued job.
    try {
      await enqueueFullRedesign(tenantId, job.started_at)
    } catch (err) {
      console.error('[custom-build] requeue enqueue failed:', err)
    }
  }

  return {
    renderMode: data.render_mode === 'custom' ? ('custom' as const) : ('engine' as const),
    customUpdatedAt: data.custom_updated_at,
    draft: draft
      ? { mode: draft.mode, pageKeys: Object.keys(draft.pages || {}) }
      : null,
    published: published
      ? { mode: published.mode, pageKeys: Object.keys(published.pages || {}) }
      : null,
    /** True when draft HTML differs from what visitors see (or nothing published yet). */
    draftAhead: !!(draft && (!published || draftDiffPages.length > 0)),
    draftDiffPages,
    job: job ? { ...job, images: undefined } : null,
    jobActive: isCustomBuildJobActive(job),
    fullRedesignEver: hasEverFullRedesign(job),
  }
}

/**
 * Admin custom-site build API.
 *
 * Actions:
 *  - clone     → copy current live site into custom_config_draft (no AI redesign)
 *  - generate  → AI builds/iterates custom_config_draft (never goes live)
 *                Full redesign is async (returns { async: true } + job status)
 *  - publish   → copy draft → custom_config, set render_mode=custom, revalidate
 *  - revert    → set render_mode=engine (keeps draft + published artifacts)
 *  - discard   → clear custom_config_draft
 *  - status    → return current render_mode + draft/published page keys + job
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await params

  try {
    const adminUser = await getCurrentAdmin()
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const action = typeof body.action === 'string' ? body.action : 'status'

    if (action === 'status') {
      const status = await loadCustomBuildStatus(tenantId)
      if (!status) {
        return NextResponse.json({ error: 'Site config not found' }, { status: 404 })
      }
      return NextResponse.json(status)
    }

    if (action === 'clone') {
      const mode = body.mode === 'iframe' ? 'iframe' : body.mode === 'inline' ? 'inline' : undefined
      const result = await cloneCurrentSiteToDraft(tenantId, { mode })
      await logAdminAction({
        actor: adminUser,
        action: 'site.custom_build_clone',
        targetType: 'tenant',
        targetId: tenantId,
        metadata: {
          source: result.source,
          pageKeys: result.pageKeys,
          warnings: result.warnings,
        },
      })
      return NextResponse.json({
        reply: result.reply,
        intent: 'clone',
        source: result.source,
        changedPages: result.pageKeys,
        draft: {
          mode: result.draft.mode,
          pageKeys: result.pageKeys,
        },
        warnings: result.warnings,
        errors: [],
        draftAhead: true,
        nextStep: {
          preview: true,
          publish: true,
          message:
            'Clone saved to DRAFT. Preview draft to review, then Publish draft to make it live.',
        },
      })
    }

    if (action === 'generate') {
      const prompt = typeof body.prompt === 'string' ? body.prompt.trim().slice(0, 4000) : ''
      const mode: 'inline' | 'iframe' | undefined =
        body.mode === 'iframe' ? 'iframe' : body.mode === 'inline' ? 'inline' : undefined
      // Prefer persisted CDN https URLs; still accept legacy data URLs.
      const images = normalizeAdminImageRefs([
        ...(Array.isArray(body.imageUrls) ? body.imageUrls : []),
        ...(Array.isArray(body.images) ? body.images : []),
      ])
      // Prefer explicit intent; legacy iterate:true → surgical.
      // Default without intent used to be full (AI redesign) — callers must
      // send intent explicitly. UI uses clone for baseline, full for redesign.
      const intent =
        body.intent === 'full' || body.intent === 'surgical'
          ? body.intent
          : body.iterate === true
            ? 'surgical'
            : 'full'

      // Full redesign: Graphile Worker (Render) — no Vercel time limit.
      if (intent === 'full') {
        const existing = await getAndReconcileCustomBuildJob(tenantId)
        if (isCustomBuildJobActive(existing)) {
          return NextResponse.json({
            async: true,
            intent: 'full',
            job: existing ? { ...existing, images: undefined } : existing,
            jobActive: true,
            reply: 'A full redesign is already running — hang tight, this panel will update when it finishes.',
          })
        }

        const startedAt = new Date().toISOString()
        // Fresh Full redesign — clear prior draft so resume only applies within
        // this Graphile job's checkpoints (not yesterday's half-finished site).
        await getSupabaseAdmin()
          .from('site_configs')
          .update({
            custom_config_draft: null,
            custom_updated_at: startedAt,
          })
          .eq('tenant_id', tenantId)

        const job = {
          status: 'queued' as const,
          intent: 'full' as const,
          prompt,
          mode,
          images: images.length ? images : undefined,
          error: null,
          reply: null,
          started_at: startedAt,
          finished_at: null,
          ever_full: true as const,
          pass: 'queued',
          passes_done: [] as string[],
        }
        await setCustomBuildJob(tenantId, job)

        try {
          await enqueueFullRedesign(tenantId, startedAt)
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          await setCustomBuildJob(tenantId, {
            ...job,
            status: 'failed',
            error: message,
            finished_at: new Date().toISOString(),
          })
          return NextResponse.json({ error: message }, { status: 500 })
        }

        await logAdminAction({
          actor: adminUser,
          action: 'site.custom_build_generate_queued',
          targetType: 'tenant',
          targetId: tenantId,
          metadata: {
            prompt: prompt.slice(0, 500),
            intent: 'full',
            mode,
            imageCount: images.length,
            queue: 'graphile',
          },
        })

        return NextResponse.json({
          async: true,
          intent: 'full',
          job: { ...job, images: undefined },
          jobActive: true,
          reply:
            'Full redesign queued on the background worker (multi-pass: home, then each page with checkpoints). Usually several minutes — this panel updates as passes finish.',
          nextStep: {
            preview: false,
            publish: false,
            message:
              'Redesign running on Graphile Worker. If the worker restarts mid-run, completed pages resume from the draft checkpoint.',
          },
        })
      }

      const result = await generateCustomSiteDraft({
        tenantId,
        prompt,
        mode,
        intent,
        images: images.length ? images : undefined,
      })

      await logAdminAction({
        actor: adminUser,
        action: 'site.custom_build_generate',
        targetType: 'tenant',
        targetId: tenantId,
        metadata: {
          prompt: prompt.slice(0, 500),
          intent: result.intent,
          changedPages: result.changedPages,
          mode: result.draft.mode,
          pageKeys: Object.keys(result.draft.pages || {}),
          warnings: result.warnings,
          errors: result.errors,
          imageCount: images.length,
        },
      })

      return NextResponse.json({
        reply: result.reply,
        intent: result.intent,
        changedPages: result.changedPages,
        draft: {
          mode: result.draft.mode,
          pageKeys: Object.keys(result.draft.pages || {}),
        },
        warnings: result.warnings,
        errors: result.errors,
        draftAhead: true,
        nextStep:
          result.changedPages.length > 0
            ? {
                preview: true,
                publish: true,
                message: `Saved to DRAFT only (${result.changedPages.join(', ')}). Click Preview draft to verify, then Publish draft — the live site will not update until you publish.`,
              }
            : {
                preview: false,
                publish: false,
                message: 'No pages changed in the draft.',
              },
      })
    }

    if (action === 'publish') {
      const result = await publishCustomSiteDraft(tenantId)
      await logAdminAction({
        actor: adminUser,
        action: 'site.custom_build_publish',
        targetType: 'tenant',
        targetId: tenantId,
        metadata: { warnings: result.warnings, liveNow: result.liveNow },
      })
      return NextResponse.json({
        ok: true,
        renderMode: 'custom',
        warnings: result.warnings,
        liveNow: result.liveNow,
        draftAhead: false,
        reply: result.liveNow
          ? 'Published. Live cache cleared — open the public site (hard refresh) to see your changes.'
          : 'Published. If the public site looks stale, wait up to ~60s or hard-refresh.',
        nextStep: {
          preview: false,
          publish: false,
          message:
            'Live site updated. Open the public URL (without ?draft=1) to confirm visitors see the new content.',
        },
      })
    }

    if (action === 'revert') {
      const result = await revertToEngine(tenantId)
      await logAdminAction({
        actor: adminUser,
        action: 'site.custom_build_revert',
        targetType: 'tenant',
        targetId: tenantId,
        metadata: { liveNow: result.liveNow },
      })
      return NextResponse.json({
        ok: true,
        renderMode: 'engine',
        liveNow: result.liveNow,
      })
    }

    if (action === 'discard') {
      await discardCustomDraft(tenantId)
      await logAdminAction({
        actor: adminUser,
        action: 'site.custom_build_discard_draft',
        targetType: 'tenant',
        targetId: tenantId,
      })
      return NextResponse.json({ ok: true })
    }

    if (action === 'cancel') {
      const job = await cancelCustomBuildJob(
        tenantId,
        'Full redesign cancelled. Click Full redesign to try again.'
      )
      await logAdminAction({
        actor: adminUser,
        action: 'site.custom_build_cancel',
        targetType: 'tenant',
        targetId: tenantId,
        metadata: { previousStatus: job?.status },
      })
      return NextResponse.json({
        ok: true,
        job: job ? { ...job, images: undefined } : null,
        jobActive: false,
        reply: job?.error || 'Cancelled.',
      })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (error) {
    console.error('custom-build error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Custom build failed' },
      { status: 500 }
    )
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await params
  const adminUser = await getCurrentAdmin()
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const status = await loadCustomBuildStatus(tenantId)
  if (!status) {
    return NextResponse.json({ error: 'Site config not found' }, { status: 404 })
  }
  return NextResponse.json(status)
}
