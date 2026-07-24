/**
 * Merge intake products_config with Full redesign brief serviceUpdates.
 * Intake titles stay unless explicitly listed in `removed`. Brief `added`
 * titles are appended (no invented URLs for new images).
 */

export type ProductRow = {
  title?: string
  description?: string
  image?: string
  details?: unknown
  [key: string]: unknown
}

export type BriefServiceAdd = {
  title: string
  description?: string
}

export type BriefServiceRemove = {
  title: string
  reason?: string
}

export type ServiceUpdates = {
  added?: BriefServiceAdd[]
  removed?: BriefServiceRemove[]
}

export type MergeBriefServicesResult = {
  products: ProductRow[]
  added: BriefServiceAdd[]
  removed: BriefServiceRemove[]
}

function normTitle(title: string): string {
  return title.trim().toLowerCase()
}

/** Parse model JSON `serviceUpdates` into a safe shape. */
export function parseServiceUpdates(raw: unknown): ServiceUpdates {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { added: [], removed: [] }
  }
  const v = raw as Record<string, unknown>
  const added: BriefServiceAdd[] = []
  const removed: BriefServiceRemove[] = []

  if (Array.isArray(v.added)) {
    for (const item of v.added) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue
      const row = item as Record<string, unknown>
      const title = typeof row.title === 'string' ? row.title.trim() : ''
      if (!title) continue
      const description =
        typeof row.description === 'string' ? row.description.trim() : undefined
      added.push(description ? { title, description } : { title })
    }
  }

  if (Array.isArray(v.removed)) {
    for (const item of v.removed) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue
      const row = item as Record<string, unknown>
      const title = typeof row.title === 'string' ? row.title.trim() : ''
      if (!title) continue
      const reason = typeof row.reason === 'string' ? row.reason.trim() : undefined
      removed.push(reason ? { title, reason } : { title })
    }
  }

  return { added, removed }
}

/**
 * Start from intake products; drop only titles listed in removed; append
 * added titles that are not already present (case-insensitive).
 */
export function mergeIntakeServicesWithBriefUpdates(
  intake: ProductRow[],
  updates: ServiceUpdates | null | undefined
): MergeBriefServicesResult {
  const removedList = Array.isArray(updates?.removed) ? updates!.removed! : []
  const addedList = Array.isArray(updates?.added) ? updates!.added! : []

  const removeSet = new Set(
    removedList
      .map((r) => (typeof r.title === 'string' ? normTitle(r.title) : ''))
      .filter(Boolean)
  )

  const kept: ProductRow[] = []
  const actuallyRemoved: BriefServiceRemove[] = []
  const intakeTitles = new Set<string>()

  for (const row of intake) {
    const title = typeof row.title === 'string' ? row.title.trim() : ''
    if (!title) {
      kept.push(row)
      continue
    }
    const key = normTitle(title)
    if (removeSet.has(key)) {
      const meta = removedList.find((r) => normTitle(r.title) === key)
      actuallyRemoved.push({
        title,
        reason: meta?.reason,
      })
      continue
    }
    intakeTitles.add(key)
    kept.push({ ...row, title })
  }

  const actuallyAdded: BriefServiceAdd[] = []
  const poolImage = kept.find(
    (p) => typeof p.image === 'string' && p.image.startsWith('https')
  )?.image as string | undefined

  for (const add of addedList) {
    const title = typeof add.title === 'string' ? add.title.trim() : ''
    if (!title) continue
    const key = normTitle(title)
    if (intakeTitles.has(key)) continue
    if (kept.some((p) => typeof p.title === 'string' && normTitle(p.title) === key)) {
      continue
    }
    const description =
      typeof add.description === 'string' && add.description.trim()
        ? add.description.trim()
        : undefined
    const product: ProductRow = {
      title,
      description: description || `${title} offered by this business.`,
      ...(poolImage ? { image: poolImage } : {}),
    }
    kept.push(product)
    actuallyAdded.push(description ? { title, description } : { title })
    intakeTitles.add(key)
  }

  return {
    products: kept,
    added: actuallyAdded,
    removed: actuallyRemoved,
  }
}
