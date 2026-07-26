/**
 * Keep /services content_blocks as intro copy only.
 *
 * Product cards (short teaser + detail drawer) render from products_config in
 * the websites engine. AI Premium used to embed full service copy in page
 * blocks — which both truncated coverage and broke the clickable card UX.
 */

export type SyncProduct = {
  title?: string
  description?: string
  image?: string
  details?: {
    longDescription?: string
    [key: string]: unknown
  }
}

export type SyncContentBlock = {
  type?: string
  heading?: string
  body?: string
  image?: string
  items?: Array<{ title?: string; description?: string; image?: string }>
  [key: string]: unknown
}

export type SyncPage = {
  slug?: string
  title?: string
  content_blocks?: SyncContentBlock[]
  [key: string]: unknown
}

function isServicesSlug(slug: unknown): boolean {
  if (typeof slug !== 'string') return false
  const key = slug.toLowerCase().replace(/^\/+/, '').split(/[-_/]/)[0]
  return ['services', 'service', 'offerings', 'menu'].includes(key)
}

/**
 * Preserve a useful intro text block; drop grid/image service listings so the
 * renderer can paint clickable product cards from products_config.
 */
export function buildServicesBlocksFromProducts(
  products: SyncProduct[],
  existingBlocks?: SyncContentBlock[] | null
): SyncContentBlock[] {
  const list = (products || []).filter((p) => typeof p.title === 'string' && p.title.trim())
  const productTitles = new Set(list.map((p) => (p.title || '').trim().toLowerCase()))

  const intro =
    Array.isArray(existingBlocks) &&
    existingBlocks.find(
      (b) =>
        b?.type === 'text' &&
        typeof b.body === 'string' &&
        b.body.trim().length > 0 &&
        !(
          typeof b.heading === 'string' &&
          productTitles.has(b.heading.trim().toLowerCase())
        )
    )

  if (intro) {
    return [
      {
        type: 'text',
        heading: typeof intro.heading === 'string' ? intro.heading : 'Services',
        body: intro.body,
      },
    ]
  }

  return [
    {
      type: 'text',
      heading: 'Services',
      body: 'Every offering below is available from our shop — ask us which fit your vehicle and timeline.',
    },
  ]
}

/** Patch pagesConfig / pages_config so /services keeps intro copy only. */
export function syncServicesPageFromProducts<T extends SyncPage>(
  pages: T[] | null | undefined,
  products: SyncProduct[]
): T[] {
  if (!Array.isArray(pages) || pages.length === 0) return pages || []
  if (!Array.isArray(products) || products.length === 0) return pages

  return pages.map((page) => {
    if (!isServicesSlug(page.slug)) return page
    return {
      ...page,
      content_blocks: buildServicesBlocksFromProducts(products, page.content_blocks),
    }
  })
}
