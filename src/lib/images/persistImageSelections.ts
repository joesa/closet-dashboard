import type { IntakeImageSelections } from '@/lib/intake/imageSelections'
import { persistImageUrl } from '@/lib/images/uploadOptimized'

/**
 * Replace any inline data: URLs in image selections with optimized, hosted
 * assets so provisioning and the live site serve fast CDN URLs instead of
 * multi-megabyte base64 blobs.
 */
export async function persistImageSelections(
  token: string,
  selections: IntakeImageSelections
): Promise<IntakeImageSelections> {
  const next: IntakeImageSelections = {
    hero: {
      ...selections.hero,
      history: selections.hero.history.map((batch) => ({ ...batch, urls: [...batch.urls] })),
    },
    products: selections.products.map((p) => ({
      ...p,
      history: p.history.map((batch) => ({ ...batch, urls: [...batch.urls] })),
    })),
  }

  for (let b = 0; b < next.hero.history.length; b++) {
    const batch = next.hero.history[b]
    batch.urls = await Promise.all(
      batch.urls.map((url, j) =>
        persistImageUrl(url, `intakes/${token}/hero/custom-a${batch.attempt}-${j + 1}`, 'hero')
      )
    )
  }
  if (next.hero.selectedUrl) {
    next.hero.selectedUrl = await persistImageUrl(
      next.hero.selectedUrl,
      `intakes/${token}/hero/selected`,
      'hero'
    )
  }

  for (const product of next.products) {
    const slot = product.productIndex + 1
    for (const batch of product.history) {
      batch.urls = await Promise.all(
        batch.urls.map((url, j) =>
          persistImageUrl(
            url,
            `intakes/${token}/products/${slot}/custom-a${batch.attempt}-${j + 1}`,
            'product'
          )
        )
      )
    }
    if (product.selectedUrl) {
      product.selectedUrl = await persistImageUrl(
        product.selectedUrl,
        `intakes/${token}/products/${slot}/selected`,
        'product'
      )
    }
  }

  return next
}
