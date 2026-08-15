import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { checkAndIncrementAiUsage } from '@/lib/aiUsage'
import { generateImageVariants } from '@/lib/ai/generateImagesBatch'
import {
  imageSelectionsComplete,
  parseImageSelections,
  syncProductSlots,
  type IntakeImageSelections,
} from '@/lib/intake/imageSelections'
import { provisionServiceLabels } from '@/lib/intake/provisionServiceLabels'
import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'

/**
 * Generate and select hero and product images for a spec build — gate 4 of
 * `validateAiPremiumReady`, satisfied with nobody looking at a picker.
 *
 * Purpose-built rather than reusing `intake_generate_images`: that task is
 * organised around the studio's attempt history and per-slot retry budget,
 * which exist so a prospect can flip through variants and pick one. Nobody is
 * picking here, so this generates one variant per slot and takes it — three
 * variants would be three times the cost for a choice no one makes. The
 * completion check is `imageSelectionsComplete`, exactly the predicate gate 4
 * uses, so the two cannot drift.
 *
 * Before/after is skipped entirely; it is not part of the gate.
 */

function variantsPerSlot(): number {
  const raw = parseInt(process.env.SPEC_BUILD_IMAGE_VARIANTS || '1', 10)
  return Number.isFinite(raw) && raw > 0 ? raw : 1
}

type SiteConfigShape = {
  siteConfig?: {
    hero?: { imagePrompt?: string }
    products?: { title?: string; imagePrompt?: string }[]
  }
}

export type SpecImageResult =
  | { ok: true; generated: number; reused: number }
  | { ok: false; reason: string; retryable: boolean }

export async function generateSpecImages(row: ProspectIntakeRow): Promise<SpecImageResult> {
  const config = (row.ai_site_config ?? {}) as SiteConfigShape
  const labels = provisionServiceLabels(row)
  if (labels.length === 0) {
    return { ok: false, reason: 'No services to illustrate.', retryable: false }
  }

  let selections = syncProductSlots(parseImageSelections(row.image_selections), labels)
  const token = row.token
  let generated = 0
  let reused = 0

  const heroPrompt =
    config.siteConfig?.hero?.imagePrompt?.trim() ||
    `Photorealistic wide photograph of professional ${labels[0]} work, natural daylight, no text or logos.`

  // Each slot is skipped when it already has a selection, so a retry after a
  // partial failure only pays for what is still missing.
  if (!selections.hero.selectedUrl) {
    const url = await generateOne(heroPrompt, `intakes/${token}`, `hero-spec`)
    if (!url.ok) return url
    selections = {
      ...selections,
      hero: { ...selections.hero, selectedUrl: url.url, attemptsUsed: selections.hero.attemptsUsed + 1 },
    }
    generated += 1
  } else {
    reused += 1
  }

  const products = [...selections.products]
  for (let i = 0; i < products.length; i++) {
    if (products[i].selectedUrl) {
      reused += 1
      continue
    }
    const label = products[i].serviceName || labels[i] || labels[0]
    const prompt =
      config.siteConfig?.products?.[i]?.imagePrompt?.trim() ||
      `Photorealistic photograph of ${label} work in progress, natural light, no text or logos.`

    const url = await generateOne(prompt, `intakes/${token}`, `product-${i + 1}-spec`)
    if (!url.ok) return url
    products[i] = {
      ...products[i],
      selectedUrl: url.url,
      attemptsUsed: products[i].attemptsUsed + 1,
    }
    generated += 1
    await persist(row.id, { ...selections, products })
  }

  selections = { ...selections, products }
  await persist(row.id, selections)

  if (!imageSelectionsComplete(selections, labels)) {
    return {
      ok: false,
      reason: 'Image generation finished but some slots are still empty.',
      retryable: true,
    }
  }

  return { ok: true, generated, reused }
}

async function generateOne(
  prompt: string,
  storagePrefix: string,
  key: string
): Promise<{ ok: true; url: string } | { ok: false; reason: string; retryable: boolean }> {
  const usage = await checkAndIncrementAiUsage('generate_images')
  if (!usage.allowed) {
    return { ok: false, reason: usage.reason || 'Daily AI image limit reached.', retryable: true }
  }

  try {
    const urls = await generateImageVariants(prompt, storagePrefix, key, variantsPerSlot(), 'image_spec')
    if (!urls[0]) {
      return { ok: false, reason: 'Image generation returned nothing.', retryable: true }
    }
    return { ok: true, url: urls[0] }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // A quota or billing wall is not worth retrying — it will fail identically
    // until somebody tops up, and each attempt costs an API round trip.
    const retryable = !/quota|billing|insufficient|hard_limit/i.test(message)
    return { ok: false, reason: message.slice(0, 500), retryable }
  }
}

async function persist(intakeId: string, selections: IntakeImageSelections): Promise<void> {
  await getSupabaseAdmin()
    .from('prospect_intakes')
    .update({ image_selections: selections, updated_at: new Date().toISOString() })
    .eq('id', intakeId)
}
