import type { SpecBuildLeadInput, SpecFactSourceKind } from '@/lib/spec/types'

/**
 * Which public pages we are willing to read for a given lead, in priority
 * order. Deliberately a short, closed list: every extra page is a Firecrawl
 * call, and the two that matter carry almost all the signal.
 *
 * Only pages the business publishes about itself, or reviews customers left
 * about it. No third-party directories, no data brokers, nothing behind a login.
 */
export type ResearchSource = {
  url: string
  sourceKind: SpecFactSourceKind
  /** Why this page is worth a fetch — shown in the admin ledger. */
  rationale: string
}

export function resolveResearchSources(lead: SpecBuildLeadInput): ResearchSource[] {
  const sources: ResearchSource[] = []

  // Reviews are the strongest material available: real customer language, full
  // of the measurements and proper nouns the specificity gate looks for, and
  // quotable verbatim so a testimonials page is legitimately earned.
  //
  // MEASURED LIMITATION — a plain Firecrawl scrape of a Maps place URL returns
  // several thousand characters of map-tile image URLs and no review text at
  // all; the reviews live behind a JS tab that Firecrawl `actions` could not
  // click (Google's selectors are obfuscated and locale-dependent). Firecrawl
  // search finds only unclaimed aggregator listings. Until reviews arrive from
  // the Google Places API or from closet-scraper — which is already in a
  // Playwright session on this exact page — this source usually yields nothing
  // and the prose guard in fetchPage will report it as such.
  if (isHttpUrl(lead.mapsPlaceUrl)) {
    sources.push({
      url: lead.mapsPlaceUrl!.trim(),
      sourceKind: 'maps_review',
      rationale: 'Google reviews — real customer language, quotable verbatim',
    })
  }

  // The owner's own page: About text and recent posts, written by them about
  // themselves. The best source of operational specifics.
  if (isHttpUrl(lead.socialProfileUrl)) {
    sources.push({
      url: normalizeFacebookUrl(lead.socialProfileUrl!.trim()),
      sourceKind: 'facebook_about',
      rationale: 'Owner-written About and posts',
    })
  }

  return sources
}

function isHttpUrl(value?: string | null): boolean {
  if (!value?.trim()) return false
  try {
    const parsed = new URL(value.trim())
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * The scraper stores either the page root or an `/about_contact_and_basic_info`
 * deep link. The About tab holds the useful prose, so prefer it.
 */
export function normalizeFacebookUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (!/(^|\.)facebook\.com$/i.test(parsed.hostname)) return url
    if (parsed.pathname.toLowerCase() === '/profile.php') {
      const id = parsed.searchParams.get('id')?.trim()
      if (!id) return url
      const canonical = new URL('/profile.php', parsed.origin)
      canonical.searchParams.set('id', id)
      canonical.searchParams.set('sk', 'about')
      return canonical.toString()
    }
    if (/about/i.test(parsed.pathname) || /^about/i.test(parsed.searchParams.get('sk') || '')) {
      return url
    }
    const path = parsed.pathname.replace(/\/+$/, '')
    if (!path || path === '') return url

    // The scraper sometimes stores a deep link into a post, video or photo
    // rather than the page root. Appending /about to that yields nonsense like
    // /61590230650878/videos/1036687612587090/about, which is then shown to the
    // admin as the source link. Keep only the page handle — the first segment.
    const [handle] = path.replace(/^\//, '').split('/')
    if (!handle) return url
    return `${parsed.origin}/${handle}/about`
  } catch {
    return url
  }
}
