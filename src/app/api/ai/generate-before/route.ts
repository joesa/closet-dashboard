import { NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/admin'
import { checkAndIncrementAiUsage } from '@/lib/aiUsage'
import { generateBeforeImage } from '@/lib/openai-images'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// gpt-image-1 renders take a while — give the function room.
export const maxDuration = 300
export const runtime = 'nodejs'

/**
 * POST /api/ai/generate-before
 *
 * Regenerates a per-site AI "before" image for the Before/After slider.
 * Admin-only. Accepts:
 *   { tenantId: string, afterImageUrl: string, slug: string, industry?: string, services?: string[] }
 *
 * - `tenantId`    – used to patch `site_configs.before_after_config`
 * - `afterImageUrl` – the site's current hero/after image (used to anchor the
 *                    space-type prompt so before/after feel coherent)
 * - `slug`        – subdomain slug used as the storage path prefix
 *                   (e.g. "acme-closets" → site-assets/acme-closets/before.png)
 * - `industry`/`services` – optional business context so the "before" scene
 *                   matches the right subject category (vehicle, exterior,
 *                   fixture, or interior space) instead of assuming a messy
 *                   storage room. Falls back to `contractor_settings.industry`
 *                   when omitted.
 *
 * Returns: { beforeImageUrl: string }
 */
export async function POST(req: Request) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) {
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

    // Sanitize the slug to match the storage path convention used at provision time.
    const safeSlug = slug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || tenantId

    // Generate the new before image and upload to site-assets/<slug>/before.png
    const supabase = getSupabaseAdmin()
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

    // Patch the live site_config so the slider reflects the new image immediately.
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
