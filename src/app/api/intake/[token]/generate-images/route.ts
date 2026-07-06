import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  describeImageError,
  generateImageVariants,
} from '@/lib/ai/generateImagesBatch'
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
    const slot = body.slot === 'product' ? 'product' : body.slot === 'hero' ? 'hero' : null
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
    const productIndex =
      typeof body.productIndex === 'number' ? body.productIndex : parseInt(body.productIndex, 10)

    if (!slot || !prompt) {
      return NextResponse.json({ error: 'slot and prompt are required' }, { status: 400 })
    }

    const maxAttempts = maxAttemptsPerSlot()
    const serviceNames = resolveStudioServiceNames(row, body.serviceNames)
    const selections = syncProductSlots(
      parseImageSelections(row.image_selections),
      serviceNames
    )

    if (slot === 'hero') {
      if (selections.hero.attemptsUsed >= maxAttempts) {
        return NextResponse.json({ error: 'No hero generation attempts remaining.' }, { status: 400 })
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
        : selections.products[productIndex].attemptsUsed + 1
    const keyPrefix =
      slot === 'hero'
        ? `hero-a${attemptNum}`
        : `product-${productIndex + 1}-a${attemptNum}`

    const urls = await generateImageVariants(prompt, storagePrefix, keyPrefix, 3)

    const record: ImageAttemptRecord = { attempt: attemptNum, urls, prompt }

    if (slot === 'hero') {
      selections.hero.attemptsUsed = attemptNum
      selections.hero.prompt = prompt
      selections.hero.history = [...selections.hero.history, record]
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
