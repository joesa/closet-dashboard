import { NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/admin'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { cancelPendingProvisionJobs } from '@/lib/provision/cancelProvisionJobs'
import {
  presentationFromIntakeRow,
  resolveSitePresentationRules,
} from '@/lib/ai/resolveSitePresentation'
import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'
import {
  collectThemeLayoutPools,
  layoutsForTheme,
  pickBestLayout,
} from '@/lib/catalog/serviceCatalog'
import { pickDiverseTheme } from '@/lib/provision/pickDiverseTheme'
import { CTA_TO_LAYOUT } from '@/lib/catalog/sitePresentationCatalog'

export const runtime = 'nodejs'

// Admin-only: fetch a full intake by id so the onboarding page can pre-fill
// every captured field before the operator reviews and deploys.
export async function GET(req: Request) {
  const admin = await getCurrentAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = new URL(req.url).searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('prospect_intakes')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: 'Intake not found' }, { status: 404 })
  }

  // Recommend an industry-appropriate theme/layout for this prospect. Two
  // businesses in the SAME trade must NOT collapse onto one look (the sandbox
  // used to fall back to its garage demo theme). We spread new sites across the
  // industry's theme pool by probing which themes are already in use, so the
  // second tree service (etc.) diverges from the first instead of colliding on
  // a single hashed pick. Rules-only for layout (no AI call). The operator can
  // still override any of this in the sandbox before deploying.
  let presentation: { theme: string; layoutStyle: string } | null = null
  try {
    const row = data as ProspectIntakeRow
    const rules = resolveSitePresentationRules(presentationFromIntakeRow(row))
    const { themes } = collectThemeLayoutPools({
      industry: row.industry,
      services: row.services && row.services.length > 0 ? row.services : ['Walk-In Closets'],
      other_services: row.other_services,
    })
    const seed = (row.business_name || row.service_area || row.id || '').trim()
    const theme = await pickDiverseTheme({ supabase, pool: themes, seed, fallback: rules.theme })
    // Re-pick a layout that actually pairs with the (possibly different) theme.
    const { layouts } = collectThemeLayoutPools({
      industry: row.industry,
      services: row.services && row.services.length > 0 ? row.services : ['Walk-In Closets'],
      other_services: row.other_services,
    })
    const themeLayouts = layoutsForTheme(theme as never, layouts)
    const layoutStyle = pickBestLayout(
      themeLayouts.length > 0 ? themeLayouts : layouts,
      theme as never,
      row.primary_cta,
      CTA_TO_LAYOUT,
      seed
    )
    presentation = { theme, layoutStyle }
  } catch {
    /* non-fatal — sandbox falls back to its own defaults */
  }

  return NextResponse.json({ intake: data, presentation })
}

// Admin-only: set auto vs manual provisioning; switching to manual cancels queued jobs.
export async function PATCH(req: Request) {
  const admin = await getCurrentAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const id = typeof body.id === 'string' ? body.id : ''
  const mode = body.provisioningMode === 'manual' ? 'manual' : body.provisioningMode === 'auto' ? 'auto' : null

  if (!id || !mode) {
    return NextResponse.json({ error: 'id and provisioningMode (auto|manual) required' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('prospect_intakes')
    .update({
      provisioning_mode: mode,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (mode === 'manual') {
    await cancelPendingProvisionJobs(id)
  }

  return NextResponse.json({ success: true, provisioningMode: mode })
}
