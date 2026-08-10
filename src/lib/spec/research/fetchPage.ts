import type { SpecFactSourceKind } from '@/lib/spec/types'

/**
 * Fetch the public pages a spec build is allowed to learn from.
 *
 * Firecrawl rather than a plain fetch, because both sources that matter are
 * hostile to one: a Google Maps place page is a JS shell and Facebook blocks
 * direct scraping. Facebook therefore uses Firecrawl's public search index;
 * exact snippets remain subject to the same evidence verification as pages.
 *
 * Everything is best-effort. A source that fails is recorded and skipped —
 * research yielding less is a thinner site, not a failed build.
 */

const FETCH_TIMEOUT_MS = 45_000

/** Firecrawl truncation guard: enough for an About page plus visible reviews. */
const MAX_PAGE_CHARS = 60_000

/** Below this much real text there is nothing worth paying a model to read. */
const MIN_PROSE_CHARS = 400

/** Search snippets are shorter than pages but still carry exact indexed prose. */
const MIN_FACEBOOK_SEARCH_PROSE_CHARS = 120

/**
 * Markdown with images, links and table pipes removed — what is left is roughly
 * what a reader would see as words.
 */
export function prosePortion(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^[|\-\s]+$/gm, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Keep Yelp's business-owned listing details; never ingest customer reviews. */
export function yelpBusinessPortion(markdown: string): string {
  const stopHeading = /^#{1,4}\s+(?:(?:recommended\s+)?reviews?\b|review highlights\b|ask the community\b|you might also consider\b|people also (?:searched|viewed)\b|reach out to other businesses\b|browse nearby\b|related searches?\b)/im
  const match = stopHeading.exec(markdown)
  return (match ? markdown.slice(0, match.index) : markdown).trim()
}

export type FetchedPage = {
  url: string
  sourceKind: SpecFactSourceKind
  text: string
  error?: string
}

export function firecrawlConfigured(): boolean {
  return !!process.env.FIRECRAWL_API_KEY
}

/**
 * Resolve one source to text suitable for evidence verification.
 *
 * `onlyMainContent: false` on purpose — Google puts reviews in surrounding
 * chrome that "main content" extraction throws away, and reviews are the single
 * best source of verifiable, specific language we have.
 */
export async function fetchPageText(
  url: string,
  sourceKind: SpecFactSourceKind
): Promise<FetchedPage> {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) {
    return { url, sourceKind, text: '', error: 'FIRECRAWL_API_KEY not set' }
  }

  const base = (process.env.FIRECRAWL_API_URL || 'https://api.firecrawl.dev').replace(/\/$/, '')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    if (isFacebookUrl(url)) {
      return await fetchFacebookIndexedText(url, sourceKind, {
        apiKey,
        base,
        signal: controller.signal,
      })
    }

    const res = await fetch(`${base}/v1/scrape`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: false,
        waitFor: 2500,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return {
        url,
        sourceKind,
        text: '',
        error: `Firecrawl ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
      }
    }

    const json = (await res.json()) as {
      data?: { markdown?: string; html?: string; metadata?: { title?: string } }
    }
    const rawText = json.data?.markdown || ''
    const text = (sourceKind === 'yelp_business' ? yelpBusinessPortion(rawText) : rawText)
      .slice(0, MAX_PAGE_CHARS)
    if (!text.trim()) {
      return { url, sourceKind, text: '', error: 'Firecrawl returned no readable content' }
    }

    // A Google Maps place URL returns thousands of characters of map-tile image
    // URLs and no prose; a login-walled Facebook page returns nav chrome. Both
    // look like a successful scrape by length alone. Sending either to the
    // extractor costs a model call to be told there is nothing there, so
    // measure actual prose before deciding the fetch succeeded.
    const prose = prosePortion(text)
    if (prose.length < MIN_PROSE_CHARS) {
      return {
        url,
        sourceKind,
        text: '',
        error: `No readable prose (${prose.length} of ${text.length} chars were text, mostly links or images)`,
      }
    }

    return { url, sourceKind, text }
  } catch (err) {
    const message =
      err instanceof Error && err.name === 'AbortError'
        ? `Timed out after ${FETCH_TIMEOUT_MS}ms`
        : err instanceof Error
          ? err.message
          : String(err)
    return { url, sourceKind, text: '', error: message }
  } finally {
    clearTimeout(timer)
  }
}

type FirecrawlSearchItem = {
  url?: string
  title?: string
  description?: string
}

function isFacebookUrl(url: string): boolean {
  try {
    return /(^|\.)facebook\.com$/i.test(new URL(url).hostname)
  } catch {
    return false
  }
}

function facebookIdentifier(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.pathname.toLowerCase() === '/profile.php') {
      return parsed.searchParams.get('id')?.trim() || null
    }
    return parsed.pathname.split('/').filter(Boolean)[0]?.trim() || null
  } catch {
    return null
  }
}

async function fetchFacebookIndexedText(
  url: string,
  sourceKind: SpecFactSourceKind,
  options: { apiKey: string; base: string; signal: AbortSignal }
): Promise<FetchedPage> {
  const identifier = facebookIdentifier(url)
  if (!identifier) {
    return { url, sourceKind, text: '', error: 'Facebook URL has no page identifier' }
  }

  const res = await fetch(`${options.base}/v1/search`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: `site:facebook.com "${identifier}"`, limit: 5 }),
    signal: options.signal,
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    return {
      url,
      sourceKind,
      text: '',
      error: `Firecrawl Facebook search ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
    }
  }

  const json = (await res.json()) as {
    data?: { web?: FirecrawlSearchItem[] } | FirecrawlSearchItem[]
  }
  const data = Array.isArray(json.data) ? json.data : json.data?.web || []
  const identifierLower = identifier.toLowerCase()
  const matching = data.filter((item) => {
    if (!item.url || !isFacebookUrl(item.url)) return false
    try {
      const parsed = new URL(item.url)
      return `${parsed.pathname}${parsed.search}`.toLowerCase().includes(identifierLower)
    } catch {
      return false
    }
  })
  const text = matching
    .map((item) => [item.title?.trim(), item.description?.trim()].filter(Boolean).join('\n'))
    .filter(Boolean)
    .join('\n\n')
    .slice(0, MAX_PAGE_CHARS)
  const prose = prosePortion(text)
  if (prose.length < MIN_FACEBOOK_SEARCH_PROSE_CHARS) {
    return {
      url,
      sourceKind,
      text: '',
      error: `Facebook cannot be scraped directly and search returned no usable indexed prose (${prose.length} chars)`,
    }
  }

  return { url, sourceKind, text }
}
