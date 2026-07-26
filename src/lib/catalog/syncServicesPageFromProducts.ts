/**
 * Ensure the /services page content_blocks cover every product.
 *
 * AI Premium often emits only 2–4 service sections even when products_config
 * has more. After reconcile, rebuild the services page from the authoritative
 * product list while keeping a useful intro block when present.
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

function productBody(p: SyncProduct): string {
  const long =
    typeof p.details?.longDescription === 'string' ? p.details.longDescription.trim() : ''
  if (long) return long
  if (typeof p.description === 'string' && p.description.trim()) return p.description.trim()
  const title = typeof p.title === 'string' ? p.title : 'This service'
  return `${title} handled with care from first call through completion.`
}

/**
 * Prefer a short intro from the AI page (first text block), then one section
 * per product. Uses a grid when there are many services so the page stays
 * scannable; alternating image blocks when there are few.
 */
export function buildServicesBlocksFromProducts(
  products: SyncProduct[],
  existingBlocks?: SyncContentBlock[] | null
): SyncContentBlock[] {
  const list = (products || []).filter((p) => typeof p.title === 'string' && p.title.trim())
  if (list.length === 0) {
    return Array.isArray(existingBlocks) ? existingBlocks : []
  }

  const intro =
    Array.isArray(existingBlocks) &&
    existingBlocks.find(
      (b) =>
        b?.type === 'text' &&
        typeof b.body === 'string' &&
        b.body.trim().length > 0 &&
        !list.some(
          (p) =>
            typeof b.heading === 'string' &&
            b.heading.trim().toLowerCase() === (p.title || '').trim().toLowerCase()
        )
    )

  const blocks: SyncContentBlock[] = []
  if (intro) {
    blocks.push({
      type: 'text',
      heading: typeof intro.heading === 'string' ? intro.heading : 'Services',
      body: intro.body,
    })
  } else {
    blocks.push({
      type: 'text',
      heading: 'Services',
      body: 'Every offering below is available from our shop — ask us which fit your vehicle and timeline.',
    })
  }

  if (list.length > 4) {
    blocks.push({
      type: 'grid',
      heading: 'What we offer',
      body: '',
      items: list.map((p) => ({
        title: p.title!.trim(),
        description: productBody(p),
        ...(typeof p.image === 'string' && p.image ? { image: p.image } : {}),
      })),
    })
    return blocks
  }

  list.forEach((p, i) => {
    blocks.push({
      type: i % 2 === 0 ? 'image_left' : 'image_right',
      heading: p.title!.trim(),
      body: productBody(p),
      ...(typeof p.image === 'string' && p.image ? { image: p.image } : {}),
    })
  })
  return blocks
}

/** Patch pagesConfig / pages_config so /services lists every product. */
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
