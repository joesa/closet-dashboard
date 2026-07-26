/**
 * Keep intake service labels as the product source of truth.
 *
 * AI Premium generateSiteConfig often collapses N intake services into ~4
 * products (and renames them). Provision used to replace intake products with
 * that truncated list, silently dropping offerings like "Auto Wrapping".
 *
 * Reconcile: one product per intake title; overlay AI copy/images when a
 * fuzzy match exists; stub the rest. Never drop an intake title.
 */

export type ReconcileProduct = {
  title?: string
  description?: string
  image?: string
  imagePrompt?: string
  details?: {
    subtitle?: string
    longDescription?: string
    specifications?: string[]
    [key: string]: unknown
  }
  [key: string]: unknown
}

function norm(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tokenSet(title: string): Set<string> {
  return new Set(
    norm(title)
      .split(/\s+/)
      .filter((w) => w.length > 2 && !['and', 'the', 'for', 'with'].includes(w))
  )
}

/** Similarity 0–100 between an intake label and an AI product title. */
export function scoreServiceTitleMatch(intakeTitle: string, aiTitle: string): number {
  const a = norm(intakeTitle)
  const b = norm(aiTitle)
  if (!a || !b) return 0
  if (a === b) return 100
  if (a.includes(b) || b.includes(a)) return 80
  const at = tokenSet(intakeTitle)
  const bt = tokenSet(aiTitle)
  if (at.size === 0 || bt.size === 0) return 0
  let overlap = 0
  for (const t of at) {
    if (bt.has(t)) overlap++
  }
  if (overlap === 0) return 0
  return Math.round((overlap / Math.max(at.size, bt.size)) * 60)
}

function stubProduct(title: string): ReconcileProduct {
  return {
    title,
    description: `${title} handled with care from first call through completion.`,
    details: {
      subtitle: 'What we offer',
      longDescription: `${title} from our shop — clear communication, quality materials, and a finish you can trust.`,
      specifications: [],
    },
  }
}

/**
 * Build products[] ordered exactly like intakeTitles. AI rows supply copy when
 * they match; unmatched intake titles get stubs. Extra AI-only products are
 * dropped (intake does not include them).
 */
export function reconcileAiProductsToIntake(
  intakeTitles: string[],
  aiProducts: ReconcileProduct[] | null | undefined
): ReconcileProduct[] {
  const titles = (intakeTitles || [])
    .map((t) => (typeof t === 'string' ? t.trim() : ''))
    .filter(Boolean)

  if (titles.length === 0) {
    return Array.isArray(aiProducts) ? aiProducts.map((p) => ({ ...p })) : []
  }

  const aiList = Array.isArray(aiProducts) ? aiProducts : []
  const used = new Set<number>()

  return titles.map((title) => {
    let bestIdx = -1
    let bestScore = 0
    for (let i = 0; i < aiList.length; i++) {
      if (used.has(i)) continue
      const aiTitle =
        typeof aiList[i]?.title === 'string' ? (aiList[i].title as string) : ''
      const score = scoreServiceTitleMatch(title, aiTitle)
      if (score > bestScore) {
        bestScore = score
        bestIdx = i
      }
    }

    // Require a meaningful match so "Auto Wrapping" does not steal paint copy.
    if (bestIdx < 0 || bestScore < 40) {
      return stubProduct(title)
    }

    used.add(bestIdx)
    const ai = aiList[bestIdx]
    const description =
      (typeof ai.description === 'string' && ai.description.trim()) ||
      stubProduct(title).description
    const details = {
      ...(ai.details && typeof ai.details === 'object' ? ai.details : {}),
      subtitle:
        (typeof ai.details?.subtitle === 'string' && ai.details.subtitle.trim()) ||
        'What we offer',
      longDescription:
        (typeof ai.details?.longDescription === 'string' &&
          ai.details.longDescription.trim()) ||
        description,
      specifications: Array.isArray(ai.details?.specifications)
        ? ai.details!.specifications
        : [],
    }

    return {
      ...ai,
      title,
      description,
      details,
    }
  })
}
