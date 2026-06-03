/**
 * Curated catalog of optional website pages a prospect can request on the
 * intake form. "Home" is always built, so it is intentionally NOT listed here.
 *
 * Shared by the intake form (selection UI) and the API route (validation) so
 * the prospect's choices flow straight into the AI sitemap + provisioning,
 * meaning the admin never has to guess how many pages to build.
 */

export type SitePageOption = {
  /** Stable slug stored in prospect_intakes.requested_pages + used for routing. */
  slug: string
  /** Human label shown on the intake form and used as the AI page title. */
  label: string
  /** Short helper text describing what the page is for. */
  description: string
  /** Recommended as part of a strong default site. */
  recommended: boolean
}

export const SITE_PAGE_OPTIONS: SitePageOption[] = [
  {
    slug: 'about',
    label: 'About Us',
    description: 'Your story, team, and what sets your craftsmanship apart.',
    recommended: true,
  },
  {
    slug: 'services',
    label: 'Services',
    description: 'A dedicated breakdown of every service you offer.',
    recommended: true,
  },
  {
    slug: 'portfolio',
    label: 'Portfolio / Gallery',
    description: 'Showcase photos of completed projects to build trust.',
    recommended: true,
  },
  {
    slug: 'process',
    label: 'Our Process',
    description: 'Walk customers through consultation, design, and install.',
    recommended: false,
  },
  {
    slug: 'testimonials',
    label: 'Reviews & Testimonials',
    description: 'Social proof from happy clients to boost conversions.',
    recommended: false,
  },
  {
    slug: 'financing',
    label: 'Financing',
    description: 'Explain payment plans and financing options you offer.',
    recommended: false,
  },
  {
    slug: 'faq',
    label: 'FAQ',
    description: 'Answer common questions to reduce back-and-forth.',
    recommended: false,
  },
  {
    slug: 'service-areas',
    label: 'Service Areas',
    description: 'List the cities and regions you serve for local SEO.',
    recommended: false,
  },
  {
    slug: 'contact',
    label: 'Contact',
    description: 'A dedicated page with your form, phone, and address.',
    recommended: true,
  },
]

export const SITE_PAGE_SLUGS = SITE_PAGE_OPTIONS.map((p) => p.slug)

/**
 * Hard page caps per build tier (INCLUDING the always-built Home page):
 *   - AI Premium: up to 10 total pages (Home + 9 chosen)
 *   - Standard:   up to 5 total pages  (Home + 4 chosen)
 * These are the single source of truth used by the intake UI, the API
 * validation, AI sitemap generation, and provisioning.
 */
export const PAGE_CAP_BY_TIER: Record<'standard' | 'ai_premium', number> = {
  standard: 5,
  ai_premium: 10,
}

/** Total page cap (Home included) for a tier. Defaults to Standard. */
export function maxPagesForTier(tier: string | null | undefined): number {
  return tier === 'ai_premium' ? PAGE_CAP_BY_TIER.ai_premium : PAGE_CAP_BY_TIER.standard
}

/** Max additional (non-Home) pages a prospect may choose for a tier. */
export function maxAdditionalPagesForTier(tier: string | null | undefined): number {
  return Math.max(0, maxPagesForTier(tier) - 1)
}

/** The recommended starter set (in addition to the always-built Home page). */
export const RECOMMENDED_PAGE_SLUGS = SITE_PAGE_OPTIONS.filter(
  (p) => p.recommended
).map((p) => p.slug)

const SLUG_TO_LABEL = new Map(SITE_PAGE_OPTIONS.map((p) => [p.slug, p.label]))
const SLUG_TO_OPTION = new Map(SITE_PAGE_OPTIONS.map((p) => [p.slug, p]))

/** Keep only valid page slugs (defensive against arbitrary client input). */
export function sanitizePageSlugs(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of input) {
    if (typeof v === 'string' && SLUG_TO_LABEL.has(v) && !seen.has(v)) {
      seen.add(v)
      out.push(v)
    }
  }
  return out
}

/**
 * Sanitize AND enforce the tier's additional-page cap. This is the
 * authoritative gate: whatever survives here is what gets built — admins
 * never re-decide the sitemap.
 */
export function clampPagesForTier(input: unknown, tier: string | null | undefined): string[] {
  return sanitizePageSlugs(input).slice(0, maxAdditionalPagesForTier(tier))
}


/**
 * Build the AI sitemap (page titles) from selected slugs. Always leads with
 * "Home". Returns just ["Home"] when nothing extra is selected.
 */
export function pageSlugsToSitemap(slugs: string[]): string[] {
  const titles = sanitizePageSlugs(slugs).map((s) => SLUG_TO_LABEL.get(s) as string)
  return ['Home', ...titles]
}

export type PageContentBlock = {
  type: string
  heading: string
  body: string
  image?: string
  /** Prospect-uploaded portfolio photos (type === "gallery"). */
  images?: string[]
  items?: Array<{ title: string; description: string; image?: string }>
}

export type BasicPageConfig = {
  slug: string
  title: string
  hero: { headline: string; subheadline: string; backgroundImage?: string }
  content_blocks: PageContentBlock[]
}

function portfolioSlug(slug: string): boolean {
  return slug.replace(/^\/+/, '').toLowerCase() === 'portfolio'
}

/**
 * Attach intake gallery uploads to the Portfolio page so /portfolio shows real
 * customer photos instead of text-only AI placeholders.
 */
export function injectGalleryImagesIntoPages(
  pages: BasicPageConfig[],
  galleryUrls: string[]
): BasicPageConfig[] {
  const urls = galleryUrls.filter((u) => typeof u === 'string' && u.trim().length > 0)
  if (urls.length === 0) return pages

  return pages.map((page) => {
    if (!portfolioSlug(page.slug)) return page

    const galleryBlock: PageContentBlock = {
      type: 'gallery',
      heading: 'Our Work',
      body: 'Photos from recent projects — the craftsmanship and finishes our clients chose.',
      images: urls,
    }

    const blocks = (page.content_blocks || []).filter((b) => b.type !== 'gallery')
    return {
      ...page,
      hero: {
        ...page.hero,
        // Use the first customer photo as the portfolio hero when available.
        ...(urls[0] ? { backgroundImage: urls[0] } : {}),
      },
      content_blocks: [galleryBlock, ...blocks],
    }
  })
}

/**
 * Scaffold real page records for non-AI (Standard) builds straight from the
 * prospect's chosen pages, so the Standard build ships the exact pages the
 * customer picked instead of the admin guessing. AI Premium builds replace
 * these with art-directed pagesConfig from the model.
 */
export function buildBasicPagesConfig(slugs: string[]): BasicPageConfig[] {
  return sanitizePageSlugs(slugs).map((slug) => {
    const opt = SLUG_TO_OPTION.get(slug)
    const title = opt?.label ?? slug
    return {
      slug: `/${slug}`,
      title,
      hero: { headline: title, subheadline: opt?.description ?? '' },
      content_blocks: [
        { type: 'text', heading: title, body: opt?.description ?? '' },
      ],
    }
  })
}

/** Map a free-form AI page title/slug back to a known catalog slug, or null. */
function matchKnownSlug(rawSlug: unknown, rawTitle: unknown): string | null {
  const norm = (s: unknown) =>
    typeof s === 'string' ? s.toLowerCase().replace(/^\/+/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : ''
  const slugGuess = norm(rawSlug)
  if (slugGuess && SLUG_TO_OPTION.has(slugGuess)) return slugGuess
  const titleGuess = norm(rawTitle)
  if (titleGuess && SLUG_TO_OPTION.has(titleGuess)) return titleGuess
  // Match by label text (e.g. "About Us" -> about).
  for (const opt of SITE_PAGE_OPTIONS) {
    if (norm(opt.label) === titleGuess || norm(opt.label) === slugGuess) return opt.slug
  }
  return null
}

type AiPageLike = {
  slug?: unknown
  title?: unknown
  hero?: { headline?: unknown } | unknown
  content_blocks?: unknown
}

/**
 * Reconcile the model's free-form pagesConfig against the prospect's chosen
 * pages. Guarantees: exactly the requested pages (tier-capped), each with a
 * correct catalog slug + label, AI content where the model produced it, and a
 * basic scaffold only as a last-resort gap filler so no page ships empty.
 */
export function normalizeAiPagesConfig(
  rawPages: unknown,
  requestedSlugs: string[],
  tier: string | null | undefined
): BasicPageConfig[] {
  const slugs = clampPagesForTier(requestedSlugs, tier)
  const aiPages = Array.isArray(rawPages) ? (rawPages as AiPageLike[]) : []
  const bySlug = new Map<string, AiPageLike>()
  for (const p of aiPages) {
    const known = matchKnownSlug(p.slug, p.title)
    if (known && !bySlug.has(known)) bySlug.set(known, p)
  }
  return slugs.map((slug) => {
    const opt = SLUG_TO_OPTION.get(slug)
    const title = opt?.label ?? slug
    const ai = bySlug.get(slug)
    const heroHeadline =
      ai && typeof (ai.hero as { headline?: unknown })?.headline === 'string'
        ? ((ai.hero as { headline: string }).headline)
        : title
    const blocks = Array.isArray(ai?.content_blocks) ? (ai!.content_blocks as BasicPageConfig['content_blocks']) : null
    if (blocks && blocks.length > 0) {
      return {
        slug: `/${slug}`,
        title,
        hero: { headline: heroHeadline, subheadline: opt?.description ?? '' },
        content_blocks: blocks,
      }
    }
    // Gap filler: model omitted this page — ship a basic scaffold so it exists.
    return buildBasicPagesConfig([slug])[0]
  })
}

