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
import { isCustomSiteConfig } from '@/lib/customSite'

// Vercel Hobby allows up to 60s; keep generation compact to fit.
export const maxDuration = 60
export const runtime = 'nodejs'

/**
 * Admin custom-site build API.
 *
 * Actions:
 *  - clone     → copy current live site into custom_config_draft (no AI redesign)
 *  - generate  → AI builds/iterates custom_config_draft (never goes live)
 *  - publish   → copy draft → custom_config, set render_mode=custom, revalidate
 *  - revert    → set render_mode=engine (keeps draft + published artifacts)
 *  - discard   → clear custom_config_draft
 *  - status    → return current render_mode + draft/published page keys
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
        .select('render_mode, custom_config, custom_config_draft, custom_updated_at')
        .eq('tenant_id', tenantId)
        .single()
      if (error || !data) {
        return NextResponse.json({ error: 'Site config not found' }, { status: 404 })
      }
      const draft = isCustomSiteConfig(data.custom_config_draft) ? data.custom_config_draft : null
      const published = isCustomSiteConfig(data.custom_config) ? data.custom_config : null
      return NextResponse.json({
        renderMode: data.render_mode === 'custom' ? 'custom' : 'engine',
        customUpdatedAt: data.custom_updated_at,
        draft: draft
          ? { mode: draft.mode, pageKeys: Object.keys(draft.pages || {}) }
          : null,
        published: published
          ? { mode: published.mode, pageKeys: Object.keys(published.pages || {}) }
          : null,
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
      })
    }

    if (action === 'generate') {
      const prompt = typeof body.prompt === 'string' ? body.prompt.trim().slice(0, 4000) : ''
      const mode = body.mode === 'iframe' ? 'iframe' : body.mode === 'inline' ? 'inline' : undefined
      // Prefer explicit intent; legacy iterate:true → surgical.
      // Default without intent used to be full (AI redesign) — callers must
      // send intent explicitly. UI uses clone for baseline, full for redesign.
      const intent =
        body.intent === 'full' || body.intent === 'surgical'
          ? body.intent
          : body.iterate === true
            ? 'surgical'
            : 'full'

      const result = await generateCustomSiteDraft({
        tenantId,
        prompt,
        mode,
        intent,
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
    .select('render_mode, custom_config, custom_config_draft, custom_updated_at')
    .eq('tenant_id', tenantId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Site config not found' }, { status: 404 })
  }

  const draft = isCustomSiteConfig(data.custom_config_draft) ? data.custom_config_draft : null
  const published = isCustomSiteConfig(data.custom_config) ? data.custom_config : null

  return NextResponse.json({
    renderMode: data.render_mode === 'custom' ? 'custom' : 'engine',
    customUpdatedAt: data.custom_updated_at,
    draft: draft
      ? { mode: draft.mode, pageKeys: Object.keys(draft.pages || {}) }
      : null,
    published: published
      ? { mode: published.mode, pageKeys: Object.keys(published.pages || {}) }
      : null,
  })
}
