import type { ContentChange, SiteContentDocument } from './types'

export type ImagePresentation = { widthPercent: number; aspectRatio: number }
export type EngineEditorPage = {
  slug: string
  title: string
  isActive: boolean
  protected: boolean
  pageIndex: number | null
  navIndex: number | null
  navigationOnly: boolean
}

const ENGINE_RESTORE_ROOTS = [
  'brand_name', 'hero_config', 'about_config', 'process_config', 'products_config',
  'before_after_config', 'quiz_config', 'nav_links', 'pages_config', 'seo_config',
  'logo_url', 'pricing_notes', 'content_structure',
] as const
const CUSTOM_RESTORE_ROOTS = ['brand_name', 'seo_config', 'logo_url'] as const

/**
 * Build the engine editor's canonical page list. Home is stored outside
 * pages_config, and legacy navigation can contain a destination that has no
 * page record, so neither pages_config nor nav_links is complete on its own.
 */
export function engineEditorPages(document: SiteContentDocument): EngineEditorPage[] {
  const navLinks = document.nav_links as Array<{ label?: unknown; slug?: unknown }>
  const pages = document.pages_config as Array<{
    slug?: unknown
    title?: unknown
    is_active?: unknown
  }>
  const homeNavIndex = navLinks.findIndex((link) => link?.slug === '/')
  const homeLabel = homeNavIndex >= 0 && typeof navLinks[homeNavIndex]?.label === 'string'
    ? navLinks[homeNavIndex].label.trim()
    : ''
  const result: EngineEditorPage[] = [{
    slug: '/',
    title: homeLabel || 'Home',
    isActive: true,
    protected: true,
    pageIndex: null,
    navIndex: homeNavIndex >= 0 ? homeNavIndex : null,
    navigationOnly: false,
  }]
  const represented = new Set(['/'])

  pages.forEach((page, pageIndex) => {
    const slug = typeof page?.slug === 'string' ? page.slug : ''
    const title = typeof page?.title === 'string' && page.title.trim()
      ? page.title.trim()
      : 'Untitled page'
    const navIndex = navLinks.findIndex((link) => link?.slug === slug)
    result.push({
      slug,
      title,
      isActive: page?.is_active !== false,
      protected: false,
      pageIndex,
      navIndex: navIndex >= 0 ? navIndex : null,
      navigationOnly: false,
    })
    if (slug) represented.add(slug)
  })

  navLinks.forEach((link, navIndex) => {
    const slug = typeof link?.slug === 'string' ? link.slug : ''
    if (!slug || represented.has(slug)) return
    const label = typeof link?.label === 'string' && link.label.trim()
      ? link.label.trim()
      : slug
    result.push({
      slug,
      title: label,
      isActive: true,
      protected: true,
      pageIndex: null,
      navIndex,
      navigationOnly: true,
    })
    represented.add(slug)
  })

  return result
}

export function restoreDocumentChanges(
  document: SiteContentDocument,
  renderMode: 'engine' | 'custom'
): ContentChange[] {
  const roots = renderMode === 'engine' ? ENGINE_RESTORE_ROOTS : CUSTOM_RESTORE_ROOTS
  const changes: ContentChange[] = roots.map((root) => ({
    op: 'set',
    path: `/${root}`,
    value: document[root as keyof SiteContentDocument],
  }))
  if (renderMode === 'custom') {
    const custom = document.custom_config as { pages?: unknown } | undefined
    changes.push({ op: 'set', path: '/custom_config/pages', value: custom?.pages || {} })
  }
  return changes
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
