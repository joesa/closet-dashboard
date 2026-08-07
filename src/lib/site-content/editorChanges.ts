import type { ContentChange, SiteContentDocument } from './types'

export type ImagePresentation = { widthPercent: number; aspectRatio: number }

const ENGINE_RESTORE_ROOTS = [
  'brand_name', 'hero_config', 'about_config', 'process_config', 'products_config',
  'before_after_config', 'quiz_config', 'nav_links', 'pages_config', 'seo_config',
  'logo_url', 'pricing_notes', 'content_structure',
] as const
const CUSTOM_RESTORE_ROOTS = ['brand_name', 'seo_config', 'logo_url', 'custom_config'] as const

export function restoreDocumentChanges(
  document: SiteContentDocument,
  renderMode: 'engine' | 'custom'
): ContentChange[] {
  const roots = renderMode === 'engine' ? ENGINE_RESTORE_ROOTS : CUSTOM_RESTORE_ROOTS
  return roots.map((root) => ({
    op: 'set',
    path: `/${root}`,
    value: document[root as keyof SiteContentDocument],
  }))
}

export function imagePresentationChange(
  document: SiteContentDocument,
  imagePath: string,
  presentation: ImagePresentation
): ContentChange {
  const current = document.content_structure.imagePresentation
  const presentations = current && typeof current === 'object' && !Array.isArray(current)
    ? current as Record<string, ImagePresentation>
    : {}
  return {
    op: 'set',
    path: '/content_structure/imagePresentation',
    value: { ...presentations, [imagePath]: presentation },
  }
}

/**
 * Expand a page action into the navigation updates the browser must paint and
 * persist in the same autosave. The API independently validates the resulting
 * document, while this keeps the optimistic preview identical to that result.
 */
export function coupledEngineChanges(
  document: SiteContentDocument,
  change: ContentChange
): ContentChange[] {
  if (change.op === 'insert' && change.path === '/pages_config') {
    const page = change.value as { slug?: unknown; title?: unknown; is_active?: unknown } | null
    const slug = typeof page?.slug === 'string' ? page.slug : ''
    const title = typeof page?.title === 'string' ? page.title : ''
    const alreadyLinked = (document.nav_links as Array<{ slug?: unknown }>).some((link) => link?.slug === slug)
    if (slug && title && page?.is_active !== false && !alreadyLinked && document.nav_links.length < 30) {
      return [change, {
        op: 'insert',
        path: '/nav_links',
        index: document.nav_links.length,
        value: { label: title, slug },
      }]
    }
    return [change]
  }

  const match = change.path.match(/^\/pages_config\/(\d+)\/(title|slug|is_active)$/)
  const removeMatch = change.op === 'remove' ? change.path.match(/^\/pages_config\/(\d+)$/) : null
  const pageIndex = Number(match?.[1] ?? removeMatch?.[1])
  if (!Number.isInteger(pageIndex)) return [change]
  const page = document.pages_config[pageIndex] as { slug?: unknown } | undefined
  const oldSlug = typeof page?.slug === 'string' ? page.slug : ''
  if (!oldSlug) return [change]
  const matchingLinks = (document.nav_links as Array<{ slug?: unknown }>).flatMap((link, index) =>
    link?.slug === oldSlug ? [index] : []
  )
  if (match && change.op === 'set' && match[2] === 'title' && typeof change.value === 'string') {
    return [change, ...matchingLinks.map((index): ContentChange => ({
      op: 'set', path: `/nav_links/${index}/label`, value: change.value,
    }))]
  }
  if (match && change.op === 'set' && match[2] === 'slug' && typeof change.value === 'string') {
    return [change, ...matchingLinks.map((index): ContentChange => ({
      op: 'set', path: `/nav_links/${index}/slug`, value: change.value,
    }))]
  }
  if ((match && change.op === 'set' && match[2] === 'is_active' && change.value === false) || removeMatch) {
    return [
      ...matchingLinks.sort((a, b) => b - a).map((index): ContentChange => ({
        op: 'remove', path: `/nav_links/${index}`,
      })),
      change,
    ]
  }
  return [change]
}
