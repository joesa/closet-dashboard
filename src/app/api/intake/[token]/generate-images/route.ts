import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  describeImageError,
  generateImageVariants,
  generateImageEditVariants,
} from '@/lib/ai/generateImagesBatch'
import { buildBeforeImagePrompt } from '@/lib/images/beforeAfterPrompt'
import { resolveIntakeBeforeAfterCategory } from '@/lib/intake/intakeBeforeAfter'
import { getIntakeByToken } from '@/lib/intake/getIntakeByToken'
import { assertDraftIntake, assertDepositPaid } from '@/lib/intake/intakeTierGates'
import { resolveStudioServiceNames } from '@/lib/intake/studioServiceNames'
import {
  maxAttemptsPerSlot,
  parseImageSelections,
  syncProductSlots,
  type ImageAttemptRecord,
} from '@/lib/intake/imageSelections'
import { checkRateLimit, hashRateKey } from '@/lib/rateLimit'

export const maxDuration = 300
export const runtime = 'nodejs'

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

    const draftErr = assertDraftIntake(row)
    if (draftErr) {
      return NextResponse.json({ error: draftErr }, { status: 410 })
    }

    const depositErr = assertDepositPaid(row)
    if (depositErr) {
      return NextResponse.json({ error: depositErr }, { status: 403 })
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
    const slot =
      body.slot === 'product'
        ? 'product'
        : body.slot === 'hero'
          ? 'hero'
          : body.slot === 'before'
            ? 'before'
            : null
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
    const productIndex =
      typeof body.productIndex === 'number' ? body.productIndex : parseInt(body.productIndex, 10)

    if (!slot || (!prompt && slot !== 'before')) {
      return NextResponse.json({ error: 'slot and prompt are required' }, { status: 400 })
    }

    const maxAttempts = maxAttemptsPerSlot()
    const serviceNames = resolveStudioServiceNames(row, body.serviceNames)
    const selections = syncProductSlots(
      parseImageSelections(row.image_selections),
      serviceNames
    )
    const beforeState = selections.beforeAfter ?? { attemptsUsed: 0, history: [] }

    // The "before" shot is derived from the selected hero ("after") image, so
    // both sides of the transformation slider show the same subject.
    const afterUrl = selections.hero.selectedUrl
    if (slot === 'before') {
      if (!afterUrl) {
        return NextResponse.json(
          { error: 'Select a hero image first — the before photo is derived from it.' },
          { status: 400 }
        )
      }
      // Not every business has a physical "before" state (restaurants, legal,
      // medical, booking…) — the site won't render a transformation slider for
      // these, so don't burn generation attempts on one.
      const category = await resolveIntakeBeforeAfterCategory({
        industry: row.industry,
        services: serviceNames,
        other_services: row.other_services,
      })
      if (category === 'not-applicable') {
        return NextResponse.json(
          {
            error:
              'A before/after transformation section does not apply to this type of business, so no before image is needed.',
          },
          { status: 400 }
        )
      }
    }

    if (slot === 'hero') {
      if (selections.hero.attemptsUsed >= maxAttempts) {
        return NextResponse.json({ error: 'No hero generation attempts remaining.' }, { status: 400 })
      }
    } else if (slot === 'before') {
      if (beforeState.attemptsUsed >= maxAttempts) {
        return NextResponse.json(
          { error: 'No before-image generation attempts remaining.' },
          { status: 400 }
        )
      }
    } else {
      const idx = Number.isFinite(productIndex) ? productIndex : -1
      const product = selections.products[idx]
      if (!product) {
        return NextResponse.json({ error: 'Invalid product index' }, { status: 400 })
      }
      if (product.attemptsUsed >= maxAttempts) {
        return NextResponse.json({ error: 'No attempts remaining for this product.' }, { status: 400 })
      }
    }

    const limit = await checkRateLimit(
      hashRateKey('intake_ai_images', `${token}:${slot}:${productIndex}`),
      12,
      60 * 60 * 1000
    )
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many image requests. Try again later.' }, { status: 429 })
    }

    const storagePrefix = `intakes/${token}`
    const attemptNum =
      slot === 'hero'
        ? selections.hero.attemptsUsed + 1
        : slot === 'before'
          ? beforeState.attemptsUsed + 1
          : selections.products[productIndex].attemptsUsed + 1
    const keyPrefix =
      slot === 'hero'
        ? `hero-a${attemptNum}`
        : slot === 'before'
          ? `before-a${attemptNum}`
          : `product-${productIndex + 1}-a${attemptNum}`

    let urls: string[]
    let effectivePrompt = prompt
    if (slot === 'before') {
      // Default to the trade-aware degradation prompt when the prospect didn't
      // customize it — same prompt provisioning would use, made visible/editable.
      effectivePrompt =
        prompt ||
        buildBeforeImagePrompt(afterUrl!, {
          industry: row.industry,
          services: serviceNames,
          otherServices: row.other_services,
        })
      urls = await generateImageEditVariants(afterUrl!, effectivePrompt, storagePrefix, keyPrefix, 3)
    } else {
      urls = await generateImageVariants(prompt, storagePrefix, keyPrefix, 3)
    }

    const record: ImageAttemptRecord = { attempt: attemptNum, urls, prompt: effectivePrompt }

    if (slot === 'hero') {
      selections.hero.attemptsUsed = attemptNum
      selections.hero.prompt = prompt
      selections.hero.history = [...selections.hero.history, record]
    } else if (slot === 'before') {
      selections.beforeAfter = {
        ...beforeState,
        attemptsUsed: attemptNum,
        prompt: effectivePrompt,
        afterUrl,
        history: [...beforeState.history, record],
      }
    } else {
      const p = selections.products[productIndex]
      p.attemptsUsed = attemptNum
      p.prompt = prompt
      p.history = [...p.history, record]
    }

    const admin = getSupabaseAdmin()
    await admin
      .from('prospect_intakes')
      .update({
        image_selections: selections,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)

    return NextResponse.json({
      success: true,
      slot,
      productIndex: slot === 'product' ? productIndex : undefined,
      attempt: attemptNum,
      attemptsRemaining: maxAttempts - attemptNum,
      urls,
    })
  } catch (error) {
    console.error('intake generate-images error:', error)
    const { status, message } = describeImageError(error)
    return NextResponse.json({ error: message }, { status })
  }
}
