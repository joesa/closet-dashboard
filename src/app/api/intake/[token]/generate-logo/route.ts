import { NextResponse } from 'next/server'
import { getIntakeByToken } from '@/lib/intake/getIntakeByToken'
import { describeImageError } from '@/lib/ai/generateImagesBatch'
import { generateSquareImage, uploadSiteAsset } from '@/lib/openai-images'
import { checkRateLimit, hashRateKey } from '@/lib/rateLimit'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
const MAX_LOGO_BATCH_ATTEMPTS = 5

function inferLogoPrompt(opts: {
  businessName?: string
  serviceNames: string[]
  primaryColorHex?: string
}): string {
  const business = opts.businessName?.trim() || 'the business'
  const services = opts.serviceNames.slice(0, 6).join(', ')
  const color = opts.primaryColorHex?.trim() || '#4f46e5'

  return (
    `Create a premium, modern logo concept for ${business}. ` +
    `The business offers: ${services}. ` +
    `Infer visual motifs from those services (tools, materials, or symbols relevant to the trade) ` +
    `and design a clean, professional mark that feels trustworthy. ` +
    `Use ${color} as the primary accent color with neutral supporting tones. ` +
    'Deliver logo artwork only (no poster/mockup, no wall sign, no stationery), centered composition, ' +
    'high contrast, crisp edges, simple geometric forms, and no watermark.'
  )
}

async function generateLogoVariant(prompt: string): Promise<Buffer> {
  // OpenAI is preferred by generateSquareImage(); Gemini is automatic fallback
  // only when OpenAI is unavailable or quota/billing limited.
  return generateSquareImage(prompt)
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const row = await getIntakeByToken(token)
    if (!row) {
      return NextResponse.json({ error: 'Intake not found' }, { status: 404 })
    }
    if (row.status === 'archived') {
      return NextResponse.json({ error: 'This intake link is no longer active' }, { status: 410 })
    }
    if (row.intake_tier !== 'ai_premium') {
      return NextResponse.json(
        { error: 'AI logo generation is available for AI Premium only.' },
        { status: 403 }
      )
    }

    const aiConfig =
      row.ai_site_config && typeof row.ai_site_config === 'object'
        ? (row.ai_site_config as Record<string, unknown>)
        : {}
    const logoGeneration =
      aiConfig.logoGeneration && typeof aiConfig.logoGeneration === 'object'
        ? (aiConfig.logoGeneration as Record<string, unknown>)
        : {}
    const attemptsUsedRaw = Number(logoGeneration.attemptsUsed)
    const attemptsUsed = Number.isFinite(attemptsUsedRaw) ? attemptsUsedRaw : 0

    if (attemptsUsed >= MAX_LOGO_BATCH_ATTEMPTS) {
      return NextResponse.json(
        {
          error: 'No AI logo generation attempts remaining.',
          attemptsUsed,
          attemptsRemaining: 0,
          maxAttempts: MAX_LOGO_BATCH_ATTEMPTS,
        },
        { status: 400 }
      )
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

    const body = await req.json().catch(() => ({}))
    const serviceNames = Array.isArray(body.serviceNames)
      ? body.serviceNames
          .filter((s: unknown): s is string => typeof s === 'string')
          .map((s: string) => s.trim())
          .filter(Boolean)
      : []

    if (serviceNames.length === 0) {
      return NextResponse.json(
        { error: 'Provide at least one listed service to infer logo concepts.' },
        { status: 400 }
      )
    }

    const limit = await checkRateLimit(
      hashRateKey('intake_ai_logo', token),
      8,
      60 * 60 * 1000
    )
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many logo generation requests. Try again later.' },
        { status: 429 }
      )
    }

    const prompt = inferLogoPrompt({
      businessName: typeof body.businessName === 'string' ? body.businessName : row.business_name ?? '',
      serviceNames,
      primaryColorHex: typeof body.primaryColorHex === 'string' ? body.primaryColorHex : undefined,
    })

    const stamp = Date.now()
    const urls = await Promise.all(
      Array.from({ length: 3 }, async (_, i) => {
        const buffer = await generateLogoVariant(prompt)
        return uploadSiteAsset(buffer, `intakes/${token}`, `logo-ai-${stamp}-${i + 1}`)
      })
    )

    const nextAttemptsUsed = attemptsUsed + 1
    const supabase = getSupabaseAdmin()
    await supabase
      .from('prospect_intakes')
      .update({
        ai_site_config: {
          ...aiConfig,
          logoGeneration: {
            ...logoGeneration,
            attemptsUsed: nextAttemptsUsed,
            maxAttempts: MAX_LOGO_BATCH_ATTEMPTS,
            lastGeneratedAt: new Date().toISOString(),
            lastUrls: urls,
          },
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)

    return NextResponse.json({
      success: true,
      urls,
      attemptsUsed: nextAttemptsUsed,
      attemptsRemaining: MAX_LOGO_BATCH_ATTEMPTS - nextAttemptsUsed,
      maxAttempts: MAX_LOGO_BATCH_ATTEMPTS,
    })
  } catch (error) {
    console.error('intake generate-logo error:', error)
    const { status, message } = describeImageError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
