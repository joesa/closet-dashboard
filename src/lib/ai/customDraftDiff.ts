import { isCustomSiteConfig, type CustomSiteConfig } from '@/lib/customSite'

/** Pages whose html/css/title/description differ between draft and published. */
export function diffCustomDraftPages(
  draft: unknown,
  published: unknown
): string[] {
  if (!isCustomSiteConfig(draft)) return []
  if (!isCustomSiteConfig(published)) {
    return Object.keys(draft.pages || {})
  }
  const keys = new Set([
    ...Object.keys(draft.pages || {}),
    ...Object.keys(published.pages || {}),
  ])
  const changed: string[] = []
  for (const key of keys) {
    const a = draft.pages[key]
    const b = published.pages[key]
    if (!a && b) {
      changed.push(key)
      continue
    }
    if (a && !b) {
      changed.push(key)
      continue
    }
    if (!a || !b) continue
    if (
      (a.html || '') !== (b.html || '') ||
      (a.css || '') !== (b.css || '') ||
      (a.title || '') !== (b.title || '') ||
      (a.description || '') !== (b.description || '')
    ) {
      changed.push(key)
    }
  }
  if ((draft.globalCss || '') !== (published.globalCss || '')) {
    if (!changed.includes('(globalCss)')) changed.push('(globalCss)')
  }
  if (draft.mode !== published.mode && !changed.includes('(mode)')) {
    changed.push('(mode)')
  }
  return changed.sort()
}

export function draftFingerprint(config: CustomSiteConfig | null): string {
  if (!config) return ''
  try {
    return JSON.stringify({
      mode: config.mode,
      globalCss: config.globalCss || '',
      pages: config.pages,
    })
  } catch {
    return ''
  }
}
