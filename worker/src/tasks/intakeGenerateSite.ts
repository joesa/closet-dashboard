import type { Task } from 'graphile-worker'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { generateSiteConfigFromInput } from '@/lib/ai/generateSiteConfig'
import { mergeAiSiteConfigWithPresentation } from '@/lib/ai/mergeAiSitePresentation'
import { buildIntakeBrief } from '@/lib/intake/buildIntakeBrief'
import { resolveIntakeBeforeAfterCategory } from '@/lib/intake/intakeBeforeAfter'
import { getIntakeByToken } from '@/lib/intake/getIntakeByToken'
import { clampPagesForTier, pageSlugsToSitemap } from '@/lib/catalog/sitePages'

export type IntakeGenerateSitePayload = {
  token: string
  pageSlugs?: string[]
  pageContents?: Record<string, string>
}

export const intakeGenerateSiteTask: Task = async (payload, helpers) => {
  const { token, pageSlugs: rawPages, pageContents } = payload as IntakeGenerateSitePayload
  if (!token) throw new Error('intake_generate_site requires token')

  const row = await getIntakeByToken(token)
  if (!row) throw new Error('Intake not found')

  const admin = getSupabaseAdmin()
  await admin
    .from('prospect_intakes')
    .update({
      background_job: {
        task: 'intake_generate_site',
        status: 'processing',
        started_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('token', token)

  try {
    const tier = row.intake_tier === 'ai_premium' ? 'ai_premium' : 'standard'
    let pageSlugs = clampPagesForTier(rawPages, tier)
    if (pageSlugs.length === 0) {
      pageSlugs = clampPagesForTier(row.requested_pages, tier)
    }
    const sitemap = pageSlugsToSitemap(pageSlugs)
    const effectivePageContents =
      pageContents && Object.keys(pageContents).length > 0
        ? { ...(row.page_contents || {}), ...pageContents }
        : (row.page_contents as Record<string, string> | null)

    const brief = buildIntakeBrief(row)
    if (!brief.trim()) {
      throw new Error('Fill in business details before generating the AI brief.')
    }

    const intakeIndustry =
      typeof row.industry === 'string' && row.industry.trim().length > 0
        ? row.industry.trim()
        : Array.isArray(row.services) && row.services.length > 0
          ? row.services.join(', ')
          : null

    const result = await generateSiteConfigFromInput(
      brief,
      sitemap,
      effectivePageContents,
      intakeIndustry
    )
    const merged = await mergeAiSiteConfigWithPresentation(row, result.data)
    const beforeAfterCategory = await resolveIntakeBeforeAfterCategory({
      industry: row.industry,
      services: row.services,
      other_services: row.other_services,
    })

    await admin
      .from('prospect_intakes')
      .update({
        ai_site_config: merged,
        requested_pages: pageSlugs,
        ...(effectivePageContents ? { page_contents: effectivePageContents } : {}),
        background_job: {
          task: 'intake_generate_site',
          status: 'succeeded',
          finished_at: new Date().toISOString(),
          beforeAfterApplicable: beforeAfterCategory !== 'not-applicable',
          source: result.source,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('token', token)

    helpers.logger.info(`intake_generate_site succeeded ${token}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await admin
      .from('prospect_intakes')
      .update({
        background_job: {
          task: 'intake_generate_site',
          status: 'failed',
          error: message,
          finished_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('token', token)
    throw err
  }
}
