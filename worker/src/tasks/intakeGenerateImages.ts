import type { Task } from 'graphile-worker'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getIntakeByToken } from '@/lib/intake/getIntakeByToken'
import {
  generateImageVariants,
  generateImageEditVariants,
} from '@/lib/ai/generateImagesBatch'
import { buildBeforeImagePrompt } from '@/lib/images/beforeAfterPrompt'
import { resolveIntakeBeforeAfterCategory } from '@/lib/intake/intakeBeforeAfter'
import { resolveStudioServiceNames } from '@/lib/intake/studioServiceNames'
import { checkAndIncrementAiUsage } from '@/lib/aiUsage'
import {
  maxAttemptsPerSlot,
  parseImageSelections,
  syncProductSlots,
  type ImageAttemptRecord,
} from '@/lib/intake/imageSelections'

export type IntakeGenerateImagesPayload = {
  token: string
  slot: 'hero' | 'product' | 'before'
  prompt?: string
  productIndex?: number
  serviceNames?: string[]
}

export const intakeGenerateImagesTask: Task = async (payload, helpers) => {
  const { token, slot, prompt: rawPrompt, productIndex, serviceNames } =
    payload as IntakeGenerateImagesPayload
  if (!token || !slot) throw new Error('intake_generate_images requires token + slot')

  const row = await getIntakeByToken(token)
  if (!row) throw new Error('Intake not found')

  const admin = getSupabaseAdmin()
  await admin
    .from('prospect_intakes')
    .update({
      background_job: {
        task: 'intake_generate_images',
        status: 'processing',
        slot,
        started_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)

  try {
    const prompt = typeof rawPrompt === 'string' ? rawPrompt.trim() : ''
    const maxAttempts = maxAttemptsPerSlot()
    const names = resolveStudioServiceNames(row, serviceNames)
    const selections = syncProductSlots(parseImageSelections(row.image_selections), names)
    const beforeState = selections.beforeAfter ?? { attemptsUsed: 0, history: [] }
    const afterUrl =
      selections.beforeAfter?.afterSelectedUrl || selections.hero.selectedUrl

    if (slot === 'before' && !afterUrl) {
      throw new Error('Select or upload an after photo first.')
    }

    const attemptNum =
      slot === 'hero'
        ? selections.hero.attemptsUsed + 1
        : slot === 'before'
          ? beforeState.attemptsUsed + 1
          : selections.products[productIndex ?? -1]?.attemptsUsed + 1

    if (!Number.isFinite(attemptNum) || attemptNum < 1) {
      throw new Error('Invalid product index or attempts exhausted')
    }
    if (attemptNum > maxAttempts) {
      throw new Error('No generation attempts remaining for this slot.')
    }

    const storagePrefix = `intakes/${token}`
    const keyPrefix =
      slot === 'hero'
        ? `hero-a${attemptNum}`
        : slot === 'before'
          ? `before-a${attemptNum}`
          : `product-${(productIndex ?? 0) + 1}-a${attemptNum}`

    // Same reasoning as intake_generate_site: the worker is the unattended,
    // bulk path, so the daily image cap has to be enforced here and not only
    // on /api/ai/generate-images. Counted once per batch, matching that route.
    const usage = await checkAndIncrementAiUsage('generate_images')
    if (!usage.allowed) {
      throw new Error(usage.reason || 'Daily AI image limit reached.')
    }

    let urls: string[]
    let effectivePrompt = prompt
    if (slot === 'before') {
      const category = await resolveIntakeBeforeAfterCategory({
        industry: row.industry,
        services: names,
        other_services: row.other_services,
      })
      if (category === 'not-applicable') {
        throw new Error('Before/after does not apply to this business type.')
      }
      effectivePrompt =
        prompt ||
        buildBeforeImagePrompt(afterUrl!, {
          industry: row.industry,
          services: names,
          otherServices: row.other_services,
        })
      urls = await generateImageEditVariants(
        afterUrl!,
        effectivePrompt,
        storagePrefix,
        keyPrefix,
        3
      )
    } else {
      if (!prompt) throw new Error('prompt is required')
      urls = await generateImageVariants(prompt, storagePrefix, keyPrefix, 3)
    }

    const record: ImageAttemptRecord = {
      attempt: attemptNum,
      urls,
      prompt: effectivePrompt,
    }

    if (slot === 'hero') {
      selections.hero.attemptsUsed = attemptNum
      selections.hero.prompt = prompt
      selections.hero.history = [...selections.hero.history, record]
    } else if (slot === 'before') {
      selections.beforeAfter = {
        ...beforeState,
        enabled: true,
        mode: beforeState.mode ?? 'ai_from_after',
        attemptsUsed: attemptNum,
        prompt: effectivePrompt,
        afterUrl,
        history: [...beforeState.history, record],
      }
    } else {
      const p = selections.products[productIndex ?? 0]
      p.attemptsUsed = attemptNum
      p.prompt = prompt
      p.history = [...p.history, record]
    }

    await admin
      .from('prospect_intakes')
      .update({
        image_selections: selections,
        background_job: {
          task: 'intake_generate_images',
          status: 'succeeded',
          slot,
          attempt: attemptNum,
          urls,
          finished_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)

    helpers.logger.info(`intake_generate_images succeeded ${token} ${slot}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await admin
      .from('prospect_intakes')
      .update({
        background_job: {
          task: 'intake_generate_images',
          status: 'failed',
          error: message,
          finished_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
    throw err
  }
}
