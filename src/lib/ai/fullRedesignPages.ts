import type { CustomSiteConfig } from '@/lib/customSite'
import { normalizeCustomPath } from '@/lib/customSite'

/** Common model mistakes → canonical intake/catalog slugs. */
export const PAGE_PATH_ALIASES: Record<string, string> = {
  '/reviews': '/testimonials',
  '/review': '/testimonials',
  '/testimonial': '/testimonials',
  '/areas': '/service-areas',
  '/servicearea': '/service-areas',
  '/service-area': '/service-areas',
  '/gallery': '/portfolio',
  '/work': '/portfolio',
  '/projects': '/portfolio',
  '/about-us': '/about',
  '/our-process': '/process',
  '/how-it-works': '/process',
  '/get-in-touch': '/contact',
  '/financing-options': '/financing',
}

const MIN_PAGE_TEXT = 80

export function pageHtmlTextLength(html: string): number {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim().length
}

export function isUsableCustomPageHtml(html: string | undefined | null): boolean {
  return pageHtmlTextLength(html || '') >= MIN_PAGE_TEXT
}

/**
 * Intake pages for Full redesign (Home always included).
 * Includes inactive rows — Full redesign often paints nav to Reviews/etc. and
 * we reactivate drafted paths on save so Preview does not 404.
 * Caps at AI Premium total (Home + 9).
 */
export function buildFullRedesignRequiredPaths(
  pagesConfig: Array<{ slug?: string; is_active?: boolean | null }>
): string[] {
  const slugs = pagesConfig
    .map((p) => (typeof p?.slug === 'string' ? p.slug : ''))
    .filter(Boolean)
    .map((s) => normalizeCustomPath(s))
    .filter((s) => s !== '/')
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 9)

  const paths = ['/', ...slugs]
  if (paths.length <= 1) {
    return ['/', '/about', '/services', '/contact']
  }
  return paths
}

/** Rewrite href="/reviews" etc. to catalog slugs inside page HTML. */
export function rewriteCustomPagePathAliases(html: string): string {
  let out = html
  for (const [from, to] of Object.entries(PAGE_PATH_ALIASES)) {
    const esc = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    out = out.replace(
      new RegExp(`(href\\s*=\\s*["'])${esc}(["'#?])`, 'gi'),
      `$1${to}$2`
    )
  }
  return out
}

export function applyPathAliasesToCustomConfig(
  config: CustomSiteConfig
): CustomSiteConfig {
  const pages: CustomSiteConfig['pages'] = {}
  for (const [rawPath, page] of Object.entries(config.pages || {})) {
    const path = normalizeCustomPath(rawPath)
    pages[path] = {
      ...page,
      html: rewriteCustomPagePathAliases(page?.html || ''),
    }
  }
  return { ...config, pages }
}

/** Drop pages with no usable body so Preview does not paint a blank document. */
export function dropEmptyCustomPages(config: CustomSiteConfig): CustomSiteConfig {
  const pages: CustomSiteConfig['pages'] = {}
  for (const [rawPath, page] of Object.entries(config.pages || {})) {
    if (!isUsableCustomPageHtml(page?.html)) continue
    pages[normalizeCustomPath(rawPath)] = page
  }
  return { ...config, mode: config.mode, globalCss: config.globalCss, pages }
}

/**
 * Full redesign must ship every required path with real HTML — otherwise nav
 * links 404 / fall through to the old engine and look "half redesigned".
 */
export function assertFullRedesignPagesComplete(
  config: CustomSiteConfig,
  requiredPaths: string[]
): void {
  const missing: string[] = []
  const empty: string[] = []
  for (const raw of requiredPaths) {
    const path = normalizeCustomPath(raw)
    const page =
      config.pages[path] || (path === '/' ? config.pages[''] : undefined)
    if (!page) missing.push(path)
    else if (!isUsableCustomPageHtml(page.html)) empty.push(path)
  }
  if (missing.length === 0 && empty.length === 0) return
  throw new Error(
    `Full redesign incomplete — missing pages [${missing.join(', ') || '—'}], empty HTML [${empty.join(', ') || '—'}]. Required: ${requiredPaths.join(', ')}. Retry (truncated JSON / worker OOM often drops pages).`
  )
}

/** Ensure pages_config rows for drafted paths are active so engine fallback / SEO work. */
export function activatePagesConfigForDraftPaths(
  pagesConfig: unknown,
  draftPaths: string[]
): unknown {
  if (!Array.isArray(pagesConfig)) return pagesConfig
  const want = new Set(
    draftPaths.map((p) => normalizeCustomPath(p)).filter((p) => p !== '/')
  )
  return pagesConfig.map((row) => {
    if (!row || typeof row !== 'object') return row
    const slug = normalizeCustomPath(
      typeof (row as { slug?: string }).slug === 'string'
        ? (row as { slug: string }).slug
        : ''
    )
    if (!want.has(slug)) return row
    return { ...(row as Record<string, unknown>), is_active: true }
  })
}
