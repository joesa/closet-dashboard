/**
 * Merge AI Site Assistant column patches into the live config.
 *
 * The model is asked for complete column values, but large arrays
 * (products_config / pages_config) are often truncated mid-JSON. Blind
 * replacement then drops services/pages. We merge by identity and only
 * allow shrinking when the admin explicitly asked to remove/delete.
 */

function norm(s: unknown): string {
  return typeof s === 'string' ? s.trim().toLowerCase() : ''
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

/** Shallow+deep merge for plain objects (incoming wins on scalars). */
export function deepMergeObjects(
  current: Record<string, unknown>,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...current }
  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined) continue
    const prev = out[key]
    if (isPlainObject(prev) && isPlainObject(value)) {
      out[key] = deepMergeObjects(prev, value)
    } else {
      out[key] = value
    }
  }
  return out
}

export function adminAskedToRemove(message: string): boolean {
  return /\b(remove|delete|drop|get rid of|take off|eliminate)\b/i.test(message || '')
}

export function mergeProductsConfig(
  current: unknown,
  incoming: unknown,
  opts?: { allowShrink?: boolean }
): unknown {
  if (!Array.isArray(incoming)) return current
  if (!Array.isArray(current) || current.length === 0) return incoming
  if (opts?.allowShrink || incoming.length >= current.length) return incoming

  const byTitle = new Map<string, Record<string, unknown>>()
  for (const row of current) {
    if (!isPlainObject(row)) continue
    const key = norm(row.title)
    if (key) byTitle.set(key, { ...row })
  }

  for (const row of incoming) {
    if (!isPlainObject(row)) continue
    const key = norm(row.title)
    if (!key) continue
    const prev = byTitle.get(key) || {}
    const details =
      isPlainObject(prev.details) || isPlainObject(row.details)
        ? deepMergeObjects(
            isPlainObject(prev.details) ? (prev.details as Record<string, unknown>) : {},
            isPlainObject(row.details) ? (row.details as Record<string, unknown>) : {}
          )
        : row.details ?? prev.details
    byTitle.set(key, { ...prev, ...row, ...(details ? { details } : {}) })
  }

  const seen = new Set<string>()
  const out: Record<string, unknown>[] = []
  for (const row of current) {
    if (!isPlainObject(row)) continue
    const key = norm(row.title)
    if (!key || seen.has(key)) continue
    out.push(byTitle.get(key) || row)
    seen.add(key)
  }
  for (const row of incoming) {
    if (!isPlainObject(row)) continue
    const key = norm(row.title)
    if (!key || seen.has(key)) continue
    out.push(byTitle.get(key) || row)
    seen.add(key)
  }
  return out
}

export function mergePagesConfig(
  current: unknown,
  incoming: unknown,
  opts?: { allowShrink?: boolean }
): unknown {
  if (!Array.isArray(incoming)) return current
  if (!Array.isArray(current) || current.length === 0) return incoming
  if (opts?.allowShrink || incoming.length >= current.length) return incoming

  const bySlug = new Map<string, Record<string, unknown>>()
  for (const row of current) {
    if (!isPlainObject(row)) continue
    const key = norm(row.slug)
    if (key) bySlug.set(key, { ...row })
  }
  for (const row of incoming) {
    if (!isPlainObject(row)) continue
    const key = norm(row.slug)
    if (!key) continue
    const prev = bySlug.get(key) || {}
    bySlug.set(key, deepMergeObjects(prev, row))
  }

  const seen = new Set<string>()
  const out: Record<string, unknown>[] = []
  for (const row of current) {
    if (!isPlainObject(row)) continue
    const key = norm(row.slug)
    if (!key || seen.has(key)) continue
    out.push(bySlug.get(key) || row)
    seen.add(key)
  }
  for (const row of incoming) {
    if (!isPlainObject(row)) continue
    const key = norm(row.slug)
    if (!key || seen.has(key)) continue
    out.push(bySlug.get(key) || row)
    seen.add(key)
  }
  return out
}

export function mergeNavLinks(
  current: unknown,
  incoming: unknown,
  opts?: { allowShrink?: boolean }
): unknown {
  if (!Array.isArray(incoming)) return current
  if (!Array.isArray(current) || current.length === 0) return incoming
  if (opts?.allowShrink || incoming.length >= current.length) return incoming

  const bySlug = new Map<string, Record<string, unknown>>()
  for (const row of [...current, ...incoming]) {
    if (!isPlainObject(row)) continue
    const key = norm(row.slug)
    if (!key) continue
    bySlug.set(key, { ...(bySlug.get(key) || {}), ...row })
  }
  // Prefer incoming order when present, then any current-only leftovers.
  const out: Record<string, unknown>[] = []
  const seen = new Set<string>()
  for (const row of incoming) {
    if (!isPlainObject(row)) continue
    const key = norm(row.slug)
    if (!key || seen.has(key)) continue
    out.push(bySlug.get(key) || row)
    seen.add(key)
  }
  for (const row of current) {
    if (!isPlainObject(row)) continue
    const key = norm(row.slug)
    if (!key || seen.has(key)) continue
    out.push(bySlug.get(key) || row)
    seen.add(key)
  }
  return out
}

/** Apply one validated column value onto the current config value. */
export function mergeSiteChatColumn(
  column: string,
  current: unknown,
  incoming: unknown,
  lastAdminMessage: string
): unknown {
  const allowShrink = adminAskedToRemove(lastAdminMessage)

  if (column === 'products_config') {
    return mergeProductsConfig(current, incoming, { allowShrink })
  }
  if (column === 'pages_config') {
    return mergePagesConfig(current, incoming, { allowShrink })
  }
  if (column === 'nav_links') {
    return mergeNavLinks(current, incoming, { allowShrink })
  }
  if (
    (column === 'hero_config' ||
      column === 'about_config' ||
      column === 'process_config' ||
      column === 'seo_config' ||
      column === 'before_after_config' ||
      column === 'quiz_config') &&
    isPlainObject(current) &&
    isPlainObject(incoming)
  ) {
    return deepMergeObjects(current, incoming)
  }
  return incoming
}
