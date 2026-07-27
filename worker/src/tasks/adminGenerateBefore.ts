import type { Task } from 'graphile-worker'
import { generateBeforeImage } from '@/lib/openai-images'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export type AdminGenerateBeforePayload = {
  jobKey: string
  tenantId: string
  afterImageUrl: string
  slug: string
  industry?: string
  services?: string[]
}

/**
 * Admin "before" image regen for the Before/After slider.
 * Writes result into before_after_config + background_job.
 */
export const adminGenerateBeforeTask: Task = async (payload, helpers) => {
  const { jobKey, tenantId, afterImageUrl, slug, industry, services } =
    payload as AdminGenerateBeforePayload
  if (!jobKey || !tenantId || !afterImageUrl || !slug) {
    throw new Error(
      'admin_generate_before requires jobKey, tenantId, afterImageUrl, slug'
    )
  }

  const admin = getSupabaseAdmin()
  const mark = async (patch: Record<string, unknown>) => {
    await admin
      .from('site_configs')
      .update({
        background_job: {
          task: 'admin_generate_before',
          jobKey,
          ...patch,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
  }

  await mark({ status: 'processing', started_at: new Date().toISOString() })

  try {
    let resolvedIndustry = industry
    if (!resolvedIndustry) {
      const { data: settingsRow } = await admin
        .from('contractor_settings')
        .select('industry')
        .eq('id', tenantId)
        .maybeSingle()
      resolvedIndustry = (settingsRow?.industry as string | undefined) || undefined
    }

    const beforeImageUrl = await generateBeforeImage(afterImageUrl, slug, {
      industry: resolvedIndustry,
      services,
    })

    const { data: existing } = await admin
      .from('site_configs')
      .select('before_after_config')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (existing) {
      const updated = {
        ...((existing.before_after_config as Record<string, unknown>) || {}),
        beforeImage: beforeImageUrl,
      }
      await admin
        .from('site_configs')
        .update({
          before_after_config: updated,
          background_job: {
            task: 'admin_generate_before',
            jobKey,
            status: 'succeeded',
            finished_at: new Date().toISOString(),
            beforeImageUrl,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
    } else {
      await mark({
        status: 'succeeded',
        finished_at: new Date().toISOString(),
        beforeImageUrl,
      })
    }

    helpers.logger.info(`admin_generate_before succeeded ${tenantId}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await mark({
      status: 'failed',
      error: message,
      finished_at: new Date().toISOString(),
    })
    throw err
  }
}
