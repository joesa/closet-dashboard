import type { IntakeImageSelections } from '@/lib/intake/imageSelections'

export type ProspectSiteConfig = {
  theme?: string
  hero?: { headline?: string; imagePrompt?: string; image?: string }
  about?: { description?: string }
  products?: Array<{
    title?: string
    description?: string
    image?: string
    imagePrompt?: string
    [key: string]: unknown
  }>
  [key: string]: unknown
}

export type MergedProspectImages = {
  config: ProspectSiteConfig
  generated: {
    hero?: string
    products: { index: number; title?: string; image: string }[]
  }
}

const normLabel = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\b(\w+?)s\b/g, '$1').trim()

function labelMatchScore(serviceName: string, title: string): number {
  const a = new Set(normLabel(serviceName).split(' ').filter((w) => w.length > 2))
  const b = new Set(normLabel(title).split(' ').filter((w) => w.length > 2))
  let score = 0
  for (const w of a) if (b.has(w)) score++
  return score
}

/** True when ai_site_config carries real site content (not just logo metadata). */
export function extractProspectSiteConfig(aiRaw: unknown): ProspectSiteConfig | null {
  if (!aiRaw || typeof aiRaw !== 'object') return null
  const o = aiRaw as Record<string, unknown>
  const bundle =
    o.siteConfig && typeof o.siteConfig === 'object'
      ? (o.siteConfig as ProspectSiteConfig)
      : (o as ProspectSiteConfig)
  const hasSiteContent =
    !!(
      bundle.hero?.headline ||
      bundle.about?.description ||
      (Array.isArray(bundle.products) && bundle.products.length > 0) ||
      bundle.theme
    )
  return hasSiteContent ? bundle : null
}

/**
 * Merge a prospect's intake studio image selections onto their AI site config.
 * When the brief has no product slots (common when only images were generated),
 * product entries are synthesized from the selected service images.
 */
export function mergeProspectImageSelections(
  config: ProspectSiteConfig,
  selections: IntakeImageSelections
): MergedProspectImages {
  const heroUrl = selections.hero?.selectedUrl || undefined
  const selected = (selections.products ?? []).filter((p) => !!p.selectedUrl)
  const configProducts = Array.isArray(config.products) ? [...config.products] : []
  const generatedProducts: MergedProspectImages['generated']['products'] = []

  if (configProducts.length === 0 && selected.length > 0) {
    const nextProducts = selected.map((s, i) => {
      const image = s.selectedUrl!
      generatedProducts.push({ index: i, title: s.serviceName, image })
      return {
        title: s.serviceName || `Service ${i + 1}`,
        image,
        imagePrompt: s.prompt,
      }
    })
    return {
      config: {
        ...config,
        products: nextProducts,
        hero: { ...config.hero, ...(heroUrl ? { image: heroUrl } : {}) },
      },
      generated: { hero: heroUrl, products: generatedProducts },
    }
  }

  const used = new Set<number>()
  const pickFor = (title: string, index: number): string | undefined => {
    const byIndex = selected.find((s) => s.productIndex === index && !!s.selectedUrl)
    if (byIndex?.selectedUrl) return byIndex.selectedUrl

    let bestIdx = -1
    let bestScore = 0
    selected.forEach((s, i) => {
      if (used.has(i)) return
      const score = labelMatchScore(s.serviceName ?? '', title)
      if (score > bestScore) {
        bestScore = score
        bestIdx = i
      }
    })
    if (bestIdx < 0) bestIdx = selected.findIndex((_, i) => !used.has(i))
    if (bestIdx < 0) return undefined
    used.add(bestIdx)
    return selected[bestIdx].selectedUrl || undefined
  }

  const nextProducts = configProducts.map((p, i) => {
    if (p.image) {
      generatedProducts.push({ index: i, title: p.title, image: p.image })
      return p
    }
    const url = pickFor(p.title ?? '', i)
    if (url) {
      generatedProducts.push({ index: i, title: p.title, image: url })
      return { ...p, image: url }
    }
    return p
  })

  // Include any selected product images that did not map onto an AI slot so
  // the admin onboarding preview still shows everything the prospect picked.
  selected.forEach((s, i) => {
    const url = s.selectedUrl!
    const alreadyShown = generatedProducts.some((g) => g.image === url)
    if (!alreadyShown) {
      generatedProducts.push({
        index: nextProducts.length + generatedProducts.length,
        title: s.serviceName,
        image: url,
      })
    }
  })

  return {
    config: {
      ...config,
      products: nextProducts,
      hero: { ...config.hero, ...(heroUrl ? { image: heroUrl } : {}) },
    },
    generated: { hero: heroUrl, products: generatedProducts },
  }
}
