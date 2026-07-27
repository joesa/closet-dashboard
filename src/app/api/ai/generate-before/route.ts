import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { getCurrentAdmin } from '@/lib/admin'
import { checkAndIncrementAiUsage } from '@/lib/aiUsage'
import { generateBeforeImage } from '@/lib/openai-images'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { canEnqueueBackgroundJobs, enqueueJob } from '@/lib/jobs/enqueueJob'
import { TASK_ADMIN_GENERATE_BEFORE } from '@/lib/jobs/taskIds'

// gpt-image-1 renders take a while — prefer Graphile Worker when available.
export const maxDuration = 300
export const runtime = 'nodejs'

/**
 * POST /api/ai/generate-before
 *
 * Regenerates a per-site AI "before" image for the Before/After slider.
 * Admin-only. Accepts:
 *   { tenantId: string, afterImageUrl: string, slug: string, industry?: string, services?: string[] }
 *
 * When DATABASE_URL is set, enqueues Graphile task and returns
 * `{ async: true, jobKey }` — poll `site_configs.background_job`.
 * Otherwise runs sync (local/dev fallback).
 */
export async function POST(req: Request) {
  try {
    const adminUser = await getCurrentAdmin()
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const usage = await checkAndIncrementAiUsage('generate_images')
    if (!usage.allowed) {
      return NextResponse.json({ error: usage.reason || 'AI limit reached' }, { status: 429 })
    }

    if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        {
          error:
            'Image generation is not configured (missing OPENAI_API_KEY and GEMINI_API_KEY).',
        },
        { status: 500 }
      )
    }

    const body = await req.json()
    const { tenantId, afterImageUrl, slug, industry, services } = body as {
      tenantId?: string
      afterImageUrl?: string
      slug?: string
      industry?: string
      services?: string[]
    }

    if (!tenantId || !afterImageUrl || !slug) {
      return NextResponse.json(
        { error: 'tenantId, afterImageUrl, and slug are required.' },
        { status: 400 }
      )
    }

    const safeSlug =
      slug
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || tenantId

    const supabase = getSupabaseAdmin()

    if (canEnqueueBackgroundJobs()) {
      const jobKey = randomUUID()
      await supabase
        .from('site_configs')
        .update({
          background_job: {
            task: 'admin_generate_before',
            jobKey,
            status: 'queued',
            started_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)

      await enqueueJob(
        TASK_ADMIN_GENERATE_BEFORE,
        {
          jobKey,
          tenantId,
          afterImageUrl,
          slug: safeSlug,
          industry,
          services,
        },
        {
          jobKey: `admin_generate_before:${tenantId}:${jobKey}`,
          maxAttempts: 2,
        }
      )

      return NextResponse.json({
        async: true,
        success: true,
        jobKey,
        tenantId,
        reply: 'Before-image generation queued on the background worker.',
      })
    }

    let resolvedIndustry = industry
    if (!resolvedIndustry) {
      const { data: settingsRow } = await supabase
        .from('contractor_settings')
        .select('industry')
        .eq('id', tenantId)
        .maybeSingle()
      resolvedIndustry = (settingsRow?.industry as string | undefined) || undefined
    }
    const beforeImageUrl = await generateBeforeImage(afterImageUrl, safeSlug, {
      industry: resolvedIndustry,
      services,
    })

    const { data: existing, error: fetchError } = await supabase
      .from('site_configs')
      .select('before_after_config')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (fetchError) {
      console.error('[generate-before] Failed to fetch site_config:', fetchError)
    }

    if (existing) {
      const updated = {
        ...((existing.before_after_config as Record<string, unknown>) || {}),
        beforeImage: beforeImageUrl,
      }
      await supabase
        .from('site_configs')
        .update({ before_after_config: updated })
        .eq('tenant_id', tenantId)
    }

    return NextResponse.json({ beforeImageUrl })
  } catch (err) {
    console.error('[generate-before] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
