import type { SpecFactSourceKind } from '@/lib/spec/types'

/**
 * Fetch the public pages a spec build is allowed to learn from.
 *
 * Firecrawl rather than a plain fetch, because both sources that matter are
 * hostile to one: a Google Maps place page is a JS shell and a Facebook page
 * returns a login wall. `generateSiteConfig`'s inline fetch already exists for
 * the "paste your old website" case and is right for that; it is wrong here.
 *
 * Everything is best-effort. A source that fails is recorded and skipped —
 * research yielding less is a thinner site, not a failed build.
 */

const FETCH_TIMEOUT_MS = 45_000

/** Firecrawl truncation guard: enough for an About page plus visible reviews. */
const MAX_PAGE_CHARS = 60_000

/** Below this much real text there is nothing worth paying a model to read. */
const MIN_PROSE_CHARS = 400

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
 * Scrape one URL to markdown.
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
    const text = (json.data?.markdown || '').slice(0, MAX_PAGE_CHARS)
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
