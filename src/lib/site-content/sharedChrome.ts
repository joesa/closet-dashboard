import * as cheerio from 'cheerio'
import type { CustomSiteConfig } from '@/lib/customSite'

/**
 * Keep the header and footer in step across a custom site's pages.
 *
 * Custom sites store one complete HTML document per page, so the header and
 * footer are physically duplicated in every one. Editing the logo on the home
 * page changed only the home page's copy — every other page kept the old
 * brand, which is not what "change the logo" means to anyone.
 *
 * So when a save changes a page's header or footer, the new markup is copied
 * into the other pages. Two things are deliberately re-derived per page rather
 * than copied verbatim, because they are legitimately page-specific:
 *
 *  - `aria-current="page"` on the nav link for the page you are on.
 *  - Fragment links. "Quote calculator" is `#quote` on the page that actually
 *    contains that section and `/#quote` everywhere else; copying one form
 *    everywhere would leave dead links on most of the site.
 *
 * `data-content-id` is stripped from the copied markup: it is an editor
 * artifact, unique per document, and carrying one page's ids into another can
 * collide with ids already in that page's body.
 */

const CHROME_TAGS = ['header', 'footer'] as const
export type ChromeTag = (typeof CHROME_TAGS)[number]

export type ChromePropagation = { tag: ChromeTag; from: string; pages: string[] }

function extractChrome(html: string, tag: ChromeTag): string | null {
  const $ = cheerio.load(html, { xml: false }, false)
  const node = $(tag).first()
  if (!node.length) return null
  return $.html(node) || null
}

/**
 * Compare ignoring the parts we intentionally re-derive per page, so that a
 * page merely *being* a different page never looks like an edit.
 */
function comparable(html: string): string {
  return html
    .replace(/\sdata-content-id="[^"]*"/gi, '')
    .replace(/\sdata-content-selected="[^"]*"/gi, '')
    .replace(/\saria-current="[^"]*"/gi, '')
    .replace(/href="\/#/gi, 'href="#')
    .replace(/\s+/g, ' ')
    .trim()
}

function pathsMatch(href: string, pagePath: string): boolean {
  const clean = href.split(/[?#]/)[0].replace(/\/+$/, '')
  const page = pagePath.replace(/\/+$/, '')
  return (clean || '/') === (page || '/')
}

/** Re-apply the page-specific bits after copying shared markup into a page. */
function localizeChrome(chromeHtml: string, pagePath: string, pageHtml: string): string {
  const $ = cheerio.load(chromeHtml, { xml: false }, false)

  $('[data-content-id]').removeAttr('data-content-id')
  $('[data-content-selected]').removeAttr('data-content-selected')

  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') || '').trim()
    if (!href) return
    const hash = href.match(/^\/?#(.+)$/)
    if (!hash) return
    // Keep the link local only when this page really has that anchor;
    // otherwise send it to the page that does.
    const hasTarget = new RegExp(`id="${hash[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'i').test(pageHtml)
    $(el).attr('href', hasTarget ? `#${hash[1]}` : `/#${hash[1]}`)
  })

  // Scoped to <nav> on purpose. A footer that links to /services four times
  // must not mark all four as the current page — aria-current is a navigation
  // cue, and announcing it on every matching link is worse than omitting it.
  $('a[aria-current]').removeAttr('aria-current')
  $('nav a[href]').each((_, el) => {
    const href = ($(el).attr('href') || '').trim()
    if (href && !href.startsWith('#') && pathsMatch(href, pagePath)) {
      $(el).attr('aria-current', 'page')
    }
  })

  return $.root().html() || chromeHtml
}

function replaceChrome(pageHtml: string, tag: ChromeTag, chromeHtml: string): string | null {
  const $ = cheerio.load(pageHtml, { xml: false }, false)
  const node = $(tag).first()
  if (!node.length) return null
  node.replaceWith(chromeHtml)
  return $.root().html() || null
}

/**
 * Copy header/footer changes from the edited page to every other page.
 *
 * No-ops unless exactly one page's HTML changed — a bulk change (a revision
 * restore, say) is not an edit to shared chrome and must not be amplified.
 */
export function propagateSharedChrome(
  previous: CustomSiteConfig | null | undefined,
  next: CustomSiteConfig
): { config: CustomSiteConfig; propagations: ChromePropagation[] } {
  const previousPages = previous?.pages
  const nextPages = next?.pages
  if (!previousPages || !nextPages) return { config: next, propagations: [] }

  const editedPaths = Object.keys(nextPages).filter(
    (path) => previousPages[path] && (previousPages[path]?.html || '') !== (nextPages[path]?.html || '')
  )
  if (editedPaths.length !== 1) return { config: next, propagations: [] }

  const source = editedPaths[0]
  const pages = { ...nextPages }
  const propagations: ChromePropagation[] = []

  for (const tag of CHROME_TAGS) {
    const before = extractChrome(previousPages[source]?.html || '', tag)
    const after = extractChrome(pages[source]?.html || '', tag)
    if (!before || !after) continue
    if (comparable(before) === comparable(after)) continue

    const updated: string[] = []
    for (const [path, page] of Object.entries(pages)) {
      if (path === source) continue
      const html = page?.html || ''
      if (!html) continue
      const localized = localizeChrome(after, path, html)
      const replaced = replaceChrome(html, tag, localized)
      if (!replaced) continue
      pages[path] = { ...page, html: replaced }
      updated.push(path)
    }
    if (updated.length > 0) propagations.push({ tag, from: source, pages: updated })
  }

  if (propagations.length === 0) return { config: next, propagations: [] }
  return { config: { ...next, pages }, propagations }
}
