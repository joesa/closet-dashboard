import { NextResponse } from 'next/server'
import { getCurrentAdmin, logAdminAction } from '@/lib/admin'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  discardCustomDraft,
  generateCustomSiteDraft,
  publishCustomSiteDraft,
  revertToEngine,
} from '@/lib/ai/generateCustomSite'
import { isCustomSiteConfig } from '@/lib/customSite'

export const maxDuration = 300
export const runtime = 'nodejs'

/**
 * Admin custom-site build API.
 *
 * Actions:
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

    if (action === 'generate') {
      const prompt = typeof body.prompt === 'string' ? body.prompt.trim().slice(0, 4000) : ''
      const mode = body.mode === 'iframe' ? 'iframe' : body.mode === 'inline' ? 'inline' : undefined
      const iterate = body.iterate === true

      const result = await generateCustomSiteDraft({
        tenantId,
        prompt,
        mode,
        iterate,
      })

      await logAdminAction({
        actor: adminUser,
        action: 'site.custom_build_generate',
        targetType: 'tenant',
        targetId: tenantId,
        metadata: {
          prompt: prompt.slice(0, 500),
          iterate,
          mode: result.draft.mode,
          pageKeys: Object.keys(result.draft.pages || {}),
          warnings: result.warnings,
          errors: result.errors,
        },
      })

      return NextResponse.json({
        reply: result.reply,
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
