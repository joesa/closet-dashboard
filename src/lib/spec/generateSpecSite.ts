import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { checkAndIncrementAiUsage } from '@/lib/aiUsage'
import { generateSiteConfigFromInput } from '@/lib/ai/generateSiteConfig'
import { mergeAiSiteConfigWithPresentation } from '@/lib/ai/mergeAiSitePresentation'
import { buildIntakeBrief } from '@/lib/intake/buildIntakeBrief'
import { clampPagesForTier, pageSlugsToSitemap } from '@/lib/catalog/sitePages'
import { extractProspectSiteConfig } from '@/lib/intake/mergeProspectImages'
import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'

/**
 * Generate the AI site config for a spec build — gate 3 of
 * `validateAiPremiumReady`, satisfied without a prospect ever seeing a form.
 *
 * This is the same call the intake studio makes through the
 * `intake_generate_site` worker task. It is written separately rather than
 * shared because that task is built around `background_job` status the intake
 * UI polls; a spec build has no such UI and needs a synchronous answer it can
 * branch on. The expensive part — brief, model call, presentation merge — is
 * identical, so quality does not diverge.
 */
export async function generateSpecSiteConfig(
  row: ProspectIntakeRow
): Promise<{ ok: true; source: string; pages: number } | { ok: false; reason: string }> {
  // Idempotent: a redelivered step that finds the config already written must
  // not pay for a second generation.
  if (extractProspectSiteConfig(row.ai_site_config) !== null) {
    return { ok: true, source: 'existing', pages: (row.requested_pages ?? []).length }
  }

  const brief = buildIntakeBrief(row)
  if (!brief.trim()) {
    return { ok: false, reason: 'The intake has no business details to build a brief from.' }
  }

  const usage = await checkAndIncrementAiUsage('generate_site')
  if (!usage.allowed) {
    return { ok: false, reason: usage.reason || 'Daily AI generation limit reached.' }
  }

  const tier = row.intake_tier === 'ai_premium' ? 'ai_premium' : 'standard'
  const pageSlugs = clampPagesForTier(row.requested_pages, tier)
  const sitemap = pageSlugsToSitemap(pageSlugs)

  const intakeIndustry =
    typeof row.industry === 'string' && row.industry.trim()
      ? row.industry.trim()
      : (row.services ?? []).join(', ') || null

  const result = await generateSiteConfigFromInput(
    brief,
    sitemap,
    (row.page_contents as Record<string, string> | null) ?? null,
    intakeIndustry
  )
  const merged = await mergeAiSiteConfigWithPresentation(row, result.data)

  await getSupabaseAdmin()
    .from('prospect_intakes')
    .update({
      ai_site_config: merged,
      requested_pages: pageSlugs,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)

  return { ok: true, source: result.source, pages: pageSlugs.length }
}
