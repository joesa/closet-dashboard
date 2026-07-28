import { NextResponse } from 'next/server'
import { getCurrentAdmin, logAdminAction } from '@/lib/admin'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  discardCustomDraft,
  publishCustomSiteDraft,
  restoreDraftCssFromPublished,
  revertToEngine,
} from '@/lib/ai/generateCustomSite'
import { cloneCurrentSiteToDraft } from '@/lib/ai/cloneEngineSite'
import { diffCustomDraftPages } from '@/lib/ai/customDraftDiff'
import { draftCssLooksBroken } from '@/lib/ai/surgicalIntegrity'
import { isCustomSiteConfig } from '@/lib/customSite'
import {
  getAndReconcileCustomBuildJob,
  hasEverFullRedesign,
  isCustomBuildJobActive,
  setCustomBuildJob,
  shouldRequeueCustomBuildJob,
} from '@/lib/ai/customBuildJob'
import { cancelCustomBuildJob, requeueCustomBuildJob } from '@/lib/ai/processCustomBuildJob'
import { canEnqueueBackgroundJobs, enqueueJob } from '@/lib/jobs/enqueueJob'
import { TASK_FULL_REDESIGN } from '@/lib/jobs/taskIds'
import { normalizeAdminImageRefs } from '@/lib/adminImageAttach'

// Full redesign + surgical edits are enqueued to Graphile Worker (Render) —
// this route only writes UI status + add_job. No Vercel maxDuration for the AI work.
export const maxDuration = 60
export const runtime = 'nodejs'

async function enqueueFullRedesign(tenantId: string, startedAt: string) {
  if (!canEnqueueBackgroundJobs()) {
    throw new Error(
      'DATABASE_URL is not configured — cannot enqueue custom build jobs. Set a session-mode Postgres URI and run the Graphile Worker.'
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
      'render_mode, custom_config, custom_config_draft, custom_updated_at, custom_build_job, edit_in_place'
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
    editInPlace: Boolean(
      (data as { edit_in_place?: boolean }).edit_in_place
    ),
    customUpdatedAt: data.custom_updated_at,
    draft: draft
      ? {
          mode: draft.mode,
          pageKeys: Object.keys(draft.pages || {}),
          globalCssLength: (draft.globalCss || '').length,
        }
      : null,
    published: published
      ? {
          mode: published.mode,
          pageKeys: Object.keys(published.pages || {}),
          globalCssLength: (published.globalCss || '').length,
        }
      : null,
    /** True when draft HTML differs from what visitors see (or nothing published yet). */
    draftAhead: !!(draft && (!published || draftDiffPages.length > 0)),
    draftDiffPages,
    /** Draft globalCss looks gutted vs published (surgical wipe). */
    draftCssBroken: draftCssLooksBroken(draft?.globalCss, published?.globalCss),
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
 *  - restore-css → copy published globalCss into draft (recovery after surgical wipe)
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

      // Full redesign + surgical: Graphile Worker (Render) — no Vercel time limit.
      if (intent === 'full' || intent === 'surgical') {
        const existing = await getAndReconcileCustomBuildJob(tenantId)
        if (existing && isCustomBuildJobActive(existing)) {
          return NextResponse.json({
            async: true,
            intent: existing.intent === 'surgical' ? 'surgical' : 'full',
            job: { ...existing, images: undefined },
            jobActive: true,
            reply:
              existing.intent === 'surgical'
                ? 'A surgical edit is already running — hang tight, this panel will update when it finishes.'
                : 'A full redesign is already running — hang tight, this panel will update when it finishes.',
          })
        }

        const startedAt = new Date().toISOString()
        if (intent === 'full') {
          // Fresh Full redesign — clear prior draft so resume only applies within
          // this Graphile job's checkpoints (not yesterday's half-finished site).
          await getSupabaseAdmin()
            .from('site_configs')
            .update({
              custom_config_draft: null,
              custom_updated_at: startedAt,
            })
            .eq('tenant_id', tenantId)
        }

        const job = {
          status: 'queued' as const,
          intent: intent as 'full' | 'surgical',
          prompt,
          mode,
          images: images.length ? images : undefined,
          error: null,
          reply: null,
          started_at: startedAt,
          finished_at: null,
          ever_full: (intent === 'full' || existing?.ever_full === true) as
            | true
            | undefined,
          pass: intent === 'surgical' ? 'surgical' : 'queued',
          passes_done: [] as string[],
          dead_lettered: false,
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
            intent,
            mode,
            imageCount: images.length,
            queue: 'graphile',
          },
        })

        return NextResponse.json({
          async: true,
          intent,
          job: { ...job, images: undefined },
          jobActive: true,
          reply:
            intent === 'surgical'
              ? 'Surgical edit queued on the background worker. Usually under a couple of minutes — this panel updates when the draft is ready.'
              : 'Full redesign queued on the background worker (multi-pass: home, then each page with checkpoints). Usually several minutes — this panel updates as passes finish.',
          nextStep: {
            preview: false,
            publish: false,
            message:
              intent === 'surgical'
                ? 'Surgical edit running on Graphile Worker. Leave this page open or come back shortly.'
                : 'Redesign running on Graphile Worker. If the worker restarts mid-run, completed pages resume from the draft checkpoint.',
          },
        })
      }

      return NextResponse.json(
        { error: `Unknown generate intent: ${intent}` },
        { status: 400 }
      )
    }

    if (action === 'publish') {
      const result = await publishCustomSiteDraft(tenantId)
      await logAdminAction({
        actor: adminUser,
        action: 'site.custom_build_publish',
        targetType: 'tenant',
        targetId: tenantId,
        metadata: {
          warnings: result.warnings,
          liveNow: result.liveNow,
          siteStatus: result.siteStatus,
          publicVisible: result.publicVisible,
        },
      })
      const pendingPublic =
        !result.publicVisible && result.siteStatus === 'pending_approval'
      return NextResponse.json({
        ok: true,
        renderMode: 'custom',
        warnings: result.warnings,
        liveNow: result.liveNow,
        siteStatus: result.siteStatus,
        publicVisible: result.publicVisible,
        draftAhead: false,
        reply: pendingPublic
          ? 'Draft published to the custom build — but the public still sees “Under Construction” until you click Approve & Go Live on this site page.'
          : result.liveNow
            ? 'Published. Live cache cleared — open the public site (hard refresh) to see your changes.'
            : 'Published. If the public site looks stale, wait up to ~60s or hard-refresh.',
        nextStep: {
          preview: false,
          publish: false,
          message: pendingPublic
            ? 'Content is ready. Scroll up and click Approve & Go Live so visitors leave the holding page.'
            : 'Live site updated. Open the public URL (without ?draft=1) to confirm visitors see the new content.',
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

    if (action === 'restore-css') {
      const result = await restoreDraftCssFromPublished(tenantId)
      await logAdminAction({
        actor: adminUser,
        action: 'site.custom_build_restore_css',
        targetType: 'tenant',
        targetId: tenantId,
        metadata: {
          draftCssLength: result.draftCssLength,
          publishedCssLength: result.publishedCssLength,
        },
      })
      const status = await loadCustomBuildStatus(tenantId)
      return NextResponse.json({
        ok: true,
        ...result,
        ...status,
        reply: result.reply,
        nextStep: {
          preview: true,
          publish: true,
          message: result.reply,
        },
      })
    }

    if (action === 'cancel') {
      const live = await getAndReconcileCustomBuildJob(tenantId)
      const cancelReason =
        live?.intent === 'surgical'
          ? 'Surgical edit cancelled. Click Edit surgically to try again.'
          : 'Full redesign cancelled. Click Full redesign to try again.'
      const job = await cancelCustomBuildJob(tenantId, cancelReason)
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

    if (action === 'requeue') {
      const job = await requeueCustomBuildJob(tenantId)
      await enqueueFullRedesign(tenantId, job.started_at)
      await logAdminAction({
        actor: adminUser,
        action: 'site.custom_build_requeue',
        targetType: 'tenant',
        targetId: tenantId,
        metadata: {
          passesDone: job.passes_done,
          deadLettered: job.dead_lettered,
        },
      })
      return NextResponse.json({
        ok: true,
        job: { ...job, images: undefined },
        jobActive: true,
        reply:
          job.reply ||
          'Re-queued — Graphile will resume remaining pages from the draft checkpoint.',
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
