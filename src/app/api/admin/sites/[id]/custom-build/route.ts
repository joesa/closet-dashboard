import { NextResponse, after } from 'next/server'
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
  getCustomBuildJob,
  isCustomBuildJob,
  isCustomBuildJobActive,
  setCustomBuildJob,
} from '@/lib/ai/customBuildJob'
import { processCustomBuildJob } from '@/lib/ai/processCustomBuildJob'
import { normalizeAdminImageDataUrls } from '@/lib/adminImageAttach'

// Full generates on Claude Fable 5 routinely take 3–5 minutes. Fluid compute
// allows 300s; we return immediately and finish the work in `after()`.
export const maxDuration = 300
export const runtime = 'nodejs'

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
      const supabase = getSupabaseAdmin()
      const { data, error } = await supabase
        .from('site_configs')
        .select(
          'render_mode, custom_config, custom_config_draft, custom_updated_at, custom_build_job'
        )
        .eq('tenant_id', tenantId)
        .single()
      if (error || !data) {
        return NextResponse.json({ error: 'Site config not found' }, { status: 404 })
      }
      const draft = isCustomSiteConfig(data.custom_config_draft) ? data.custom_config_draft : null
      const published = isCustomSiteConfig(data.custom_config) ? data.custom_config : null
      const draftDiffPages = diffCustomDraftPages(draft, published)
      const job = isCustomBuildJob(data.custom_build_job) ? data.custom_build_job : null
      return NextResponse.json({
        renderMode: data.render_mode === 'custom' ? 'custom' : 'engine',
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
        job,
        jobActive: isCustomBuildJobActive(job),
      })
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
      const images = normalizeAdminImageDataUrls(body.images)
      // Prefer explicit intent; legacy iterate:true → surgical.
      // Default without intent used to be full (AI redesign) — callers must
      // send intent explicitly. UI uses clone for baseline, full for redesign.
      const intent =
        body.intent === 'full' || body.intent === 'surgical'
          ? body.intent
          : body.iterate === true
            ? 'surgical'
            : 'full'

      // Full redesign: queue + finish in `after()` so the browser never sits
      // on a 4–5 minute request that Vercel kills with a 504.
      if (intent === 'full') {
        const existing = await getCustomBuildJob(tenantId)
        if (isCustomBuildJobActive(existing)) {
          return NextResponse.json({
            async: true,
            intent: 'full',
            job: existing,
            jobActive: true,
            reply: 'A full redesign is already running — hang tight, this panel will update when it finishes.',
          })
        }

        const job = {
          status: 'queued' as const,
          intent: 'full' as const,
          prompt,
          mode,
          images: images.length ? images : undefined,
          error: null,
          reply: null,
          started_at: new Date().toISOString(),
          finished_at: null,
        }
        await setCustomBuildJob(tenantId, job)

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
          },
        })

        after(async () => {
          try {
            await processCustomBuildJob(tenantId)
          } catch (err) {
            console.error('[custom-build after] process failed:', err)
          }
        })

        return NextResponse.json({
          async: true,
          intent: 'full',
          job: { ...job, images: undefined },
          jobActive: true,
          reply:
            'Full redesign started — Claude Fable 5 usually takes 3–5 minutes. This panel will refresh when the draft is ready.',
          nextStep: {
            preview: false,
            publish: false,
            message: 'Redesign running in the background. Leave this page open or come back shortly.',
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

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('site_configs')
    .select(
      'render_mode, custom_config, custom_config_draft, custom_updated_at, custom_build_job'
    )
    .eq('tenant_id', tenantId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Site config not found' }, { status: 404 })
  }

  const draft = isCustomSiteConfig(data.custom_config_draft) ? data.custom_config_draft : null
  const published = isCustomSiteConfig(data.custom_config) ? data.custom_config : null
  const job = isCustomBuildJob(data.custom_build_job) ? data.custom_build_job : null

  return NextResponse.json({
    renderMode: data.render_mode === 'custom' ? 'custom' : 'engine',
    customUpdatedAt: data.custom_updated_at,
    draft: draft
      ? { mode: draft.mode, pageKeys: Object.keys(draft.pages || {}) }
      : null,
    published: published
      ? { mode: published.mode, pageKeys: Object.keys(published.pages || {}) }
      : null,
    job,
    jobActive: isCustomBuildJobActive(job),
  })
}
