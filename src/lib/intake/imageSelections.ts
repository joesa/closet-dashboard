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

export type IntakeImageSelections = {
  hero: HeroImageSelection
  products: ProductImageSelection[]
}

export function emptyImageSelections(): IntakeImageSelections {
  return {
    hero: { attemptsUsed: 0, history: [] },
    products: [],
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
  }
}

export function maxAttemptsPerSlot(): number {
  const n = parseInt(process.env.INTAKE_AI_MAX_ATTEMPTS_PER_SLOT || '3', 10)
  return Number.isFinite(n) && n > 0 ? n : 3
}

export function syncProductSlots(
  selections: IntakeImageSelections,
  serviceNames: string[]
): IntakeImageSelections {
  const existing = new Map(selections.products.map((p) => [p.serviceName, p]))
  const products: ProductImageSelection[] = serviceNames.map((serviceName, productIndex) => {
    const prev = existing.get(serviceName)
    return (
      prev ?? {
        serviceName,
        productIndex,
        attemptsUsed: 0,
        history: [],
      }
    )
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
