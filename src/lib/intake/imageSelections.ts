export type ImageAttemptRecord = {
  attempt: number
  urls: string[]
  prompt: string
}

export type HeroImageSelection = {
  selectedUrl?: string
  selectedAttempt?: number
  attemptsUsed: number
  prompt?: string
  history: ImageAttemptRecord[]
}

export type ProductImageSelection = {
  serviceName: string
  productIndex: number
  selectedUrl?: string
  selectedAttempt?: number
  attemptsUsed: number
  prompt?: string
  history: ImageAttemptRecord[]
}

/**
 * The transformation slider's "before" shot. Generated as an image-to-image
 * edit of the selected hero ("after") photo so both sides show the same
 * subject, or uploaded by the prospect as their own real before photo. The
 * "after" side of the slider is always the selected hero image.
 */
export type BeforeImageSelection = {
  /** Hero URL the last generation batch was derived from (staleness check). */
  afterUrl?: string
  selectedUrl?: string
  selectedAttempt?: number
  attemptsUsed: number
  prompt?: string
  history: ImageAttemptRecord[]
}

export type IntakeImageSelections = {
  hero: HeroImageSelection
  products: ProductImageSelection[]
  beforeAfter?: BeforeImageSelection
}

export function emptyImageSelections(): IntakeImageSelections {
  return {
    hero: { attemptsUsed: 0, history: [] },
    products: [],
    beforeAfter: { attemptsUsed: 0, history: [] },
  }
}

export function parseImageSelections(raw: unknown): IntakeImageSelections {
  if (!raw || typeof raw !== 'object') return emptyImageSelections()
  const o = raw as Partial<IntakeImageSelections>
  return {
    hero: {
      attemptsUsed: o.hero?.attemptsUsed ?? 0,
      selectedUrl: o.hero?.selectedUrl,
      selectedAttempt: o.hero?.selectedAttempt,
      prompt: o.hero?.prompt,
      history: Array.isArray(o.hero?.history) ? o.hero!.history : [],
    },
    products: Array.isArray(o.products) ? o.products : [],
    beforeAfter: {
      attemptsUsed: o.beforeAfter?.attemptsUsed ?? 0,
      afterUrl: o.beforeAfter?.afterUrl,
      selectedUrl: o.beforeAfter?.selectedUrl,
      selectedAttempt: o.beforeAfter?.selectedAttempt,
      prompt: o.beforeAfter?.prompt,
      history: Array.isArray(o.beforeAfter?.history) ? o.beforeAfter!.history : [],
    },
  }
}

export function maxAttemptsPerSlot(): number {
  const n = parseInt(process.env.INTAKE_AI_MAX_ATTEMPTS_PER_SLOT || '5', 10)
  return Number.isFinite(n) && n > 0 ? n : 5
}

export function syncProductSlots(
  selections: IntakeImageSelections,
  serviceNames: string[]
): IntakeImageSelections {
  const existing = new Map(selections.products.map((p) => [p.serviceName, p]))
  const products: ProductImageSelection[] = serviceNames.map((serviceName, productIndex) => {
    const prev = existing.get(serviceName)
    // Always normalize productIndex to the current array position. Reusing a
    // stale stored index lets the client (which matches slots by productIndex)
    // and the server (which indexes the array by position) disagree whenever
    // the service list order/content changes, producing "Invalid product index"
    // or "URL not from a generated product batch" on selection.
    return prev ? { ...prev, productIndex } : { serviceName, productIndex, attemptsUsed: 0, history: [] }
  })
  return { ...selections, products }
}

export function imageSelectionsComplete(
  selections: IntakeImageSelections,
  serviceNames: string[]
): boolean {
  if (!selections.hero.selectedUrl) return false
  const synced = syncProductSlots(selections, serviceNames)
  if (serviceNames.length === 0) return true
  return synced.products.every((p) => !!p.selectedUrl)
}
