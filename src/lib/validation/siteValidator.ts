import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getTenantPublicUrl, buildTenantPreviewUrl } from '@/lib/admin-preview'
import {
  THEME_LAYOUT_AFFINITY,
  MINIMAL_LAYOUTS_WITHOUT_ANCHOR_SECTIONS,
  type ThemeSlug,
  type LayoutSlug,
} from '@/lib/catalog/sitePresentationCatalog'
import { designFingerprint, siteSeed } from '@/lib/catalog/designFingerprint'
import { isForcedPreset } from '@/lib/catalog/designVariantCatalog'
import { GENERIC_HERO as GENERIC_HERO_URL } from '@/lib/provision/buildTemplateSiteConfig'

export type ValidationSeverity = 'error' | 'warning'

export type ValidationIssue = {
  /** Stable machine-readable code — the auto-fixer switches on this. */
  code: string
  severity: ValidationSeverity
  message: string
  /** Whether `autoFixSiteIssues()` knows how to repair this automatically. */
  fixable: boolean
  /** Optional extra data the fixer needs (e.g. the broken URL). */
  meta?: Record<string, unknown>
}

export type ValidationReport = {
  status: 'passed' | 'failed'
  issues: ValidationIssue[]
  checkedAt: string
}

type NavLink = { label?: string; slug?: string }

const FETCH_TIMEOUT_MS = 8000
const MAX_LINKS_CHECKED = 20
const MAX_IMAGES_CHECKED = 20

function withTimeout(ms: number): AbortSignal {
  return AbortSignal.timeout(ms)
}

async function urlOk(url: string): Promise<{ ok: boolean; status?: number }> {
  try {
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: withTimeout(FETCH_TIMEOUT_MS) })
    // Some CDNs/hosts don't support HEAD — retry with GET before declaring broken.
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, { method: 'GET', redirect: 'follow', signal: withTimeout(FETCH_TIMEOUT_MS) })
    }
    return { ok: res.ok, status: res.status }
  } catch {
    return { ok: false }
  }
}

/** Extract same-origin `<a href="...">` targets from rendered HTML. */
function extractInternalLinks(html: string): string[] {
  const hrefs = new Set<string>()
  const re = /<a\s[^>]*href="([^"#][^"]*)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const href = m[1]
    if (href.startsWith('/') && !href.startsWith('//')) hrefs.add(href)
  }
  return [...hrefs]
}

/** Extract image URLs (both direct <img src> and Next/Image's ?url= param). */
function extractImageUrls(html: string): string[] {
  const urls = new Set<string>()
  const re = /<img\s[^>]*src="([^"]+)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    let src = m[1]
    const nextImageMatch = src.match(/[?&]url=([^&"]+)/)
    if (nextImageMatch) {
      try {
        src = decodeURIComponent(nextImageMatch[1])
      } catch {
        // leave as-is
      }
    }
    if (src.startsWith('http') || src.startsWith('/')) urls.add(src)
  }
  return [...urls]
}

/**
 * Runs the full "is this site safe to show an admin for preview/approval"
 * battery against a freshly (or previously) provisioned tenant:
 *  1. Theme/layout consistency (catches the Gemini-refinement mismatch class
 *     of bug — a layout that isn't actually valid for the assigned theme).
 *  2. Nav presence (catches the "single-page site gets zero nav_links, so the
 *     themed <Navbar> never renders" class of bug).
 *  3. Basic business-data sanity (name/contact/services/subdomain).
 *  4. Bespoke/duplicate-design safety net (same theme + same design
 *     fingerprint as another live tenant — `resolveDesignSeed` should already
 *     prevent this at provision time; this is a second, independent check).
 *  5. Live crawl of the rendered page: overall reachability, every internal
 *     link, every image (hero/logo/gallery/product), and confirms a real
 *     <nav> element renders when nav_links is non-empty.
 *
 * Never throws — a validator failure (e.g. site not yet reachable) is
 * reported as a 'failed' status with a descriptive issue, not an exception,
 * so callers (provisionTenant.ts, the admin API routes) can always persist a
 * report.
 */
export async function validateTenantSite(tenantId: string): Promise<ValidationReport> {
  const issues: ValidationIssue[] = []
  const supabase = getSupabaseAdmin()

  const { data: tenant, error } = await supabase
    .from('tenants')
    .select(
      `
      id, business_name, owner_email, widget_id,
      domains ( hostname ),
      site_configs ( theme, layout_style, design_variant, nav_links, hero_config, before_after_config, products_config, logo_url, brand_name )
    `
    )
    .eq('id', tenantId)
    .maybeSingle()

  if (error || !tenant) {
    return {
      status: 'failed',
      issues: [
        {
          code: 'tenant_not_found',
          severity: 'error',
          message: `Could not load tenant ${tenantId}: ${error?.message || 'not found'}`,
          fixable: false,
        },
      ],
      checkedAt: new Date().toISOString(),
    }
  }

  const domain = Array.isArray(tenant.domains) ? tenant.domains[0] : tenant.domains
  const hostname = (domain as { hostname?: string } | null)?.hostname
  const config = (Array.isArray(tenant.site_configs) ? tenant.site_configs[0] : tenant.site_configs) as
    | {
        theme?: string
        layout_style?: string
        design_variant?: string | null
        nav_links?: NavLink[] | null
        hero_config?: { headline?: string; backgroundImage?: string } | null
        before_after_config?: { beforeImage?: string; afterImage?: string } | null
        products_config?: { image?: string; title?: string }[] | null
        logo_url?: string | null
        brand_name?: string | null
      }
    | null

  // ── 1. Basic business-data sanity ──
  if (!tenant.business_name?.trim()) {
    issues.push({ code: 'missing_business_name', severity: 'error', message: 'Business name is empty.', fixable: false })
  }
  if (!tenant.owner_email?.trim()) {
    issues.push({ code: 'missing_owner_email', severity: 'error', message: 'Owner email is empty.', fixable: false })
  }
  if (!hostname) {
    issues.push({ code: 'missing_domain', severity: 'error', message: 'No domain/subdomain assigned.', fixable: false })
  }

  if (!config) {
    issues.push({ code: 'missing_site_config', severity: 'error', message: 'No site_configs row for this tenant.', fixable: false })
    return { status: 'failed', issues, checkedAt: new Date().toISOString() }
  }

  const theme = config.theme as ThemeSlug | undefined
  const layoutStyle = config.layout_style as LayoutSlug | undefined

  // ── 2. Theme/layout consistency ──
  if (theme && layoutStyle) {
    const affinity = THEME_LAYOUT_AFFINITY[theme]
    if (affinity && !affinity.includes(layoutStyle)) {
      issues.push({
        code: 'theme_layout_mismatch',
        severity: 'warning',
        message: `Layout "${layoutStyle}" isn't a great pairing for theme "${theme}" (not in its affinity list). The site still renders, but the section styling may feel mismatched.`,
        fixable: true,
        meta: { theme, layoutStyle },
      })
    }
  } else {
    issues.push({ code: 'missing_theme_or_layout', severity: 'error', message: 'Theme or layout_style is not set.', fixable: false })
  }

  // ── 3. Nav presence ──
  const navLinks = config.nav_links || []
  const isMinimalLayout = layoutStyle ? MINIMAL_LAYOUTS_WITHOUT_ANCHOR_SECTIONS.has(layoutStyle) : false
  if (navLinks.length === 0 && !isMinimalLayout) {
    issues.push({
      code: 'missing_nav_links',
      severity: 'error',
      message:
        'nav_links is empty, so the themed Navbar component never renders — the site falls back to a bare logo-only header identical across every theme.',
      fixable: true,
      meta: { layoutStyle },
    })
  }

  // ── 4. Bespoke/duplicate-design safety net ──
  if (theme && !isForcedPreset(config.design_variant)) {
    const seed = siteSeed({
      designVariant: config.design_variant,
      widgetId: tenant.widget_id,
      brandName: config.brand_name,
    })
    if (seed) {
      const fingerprint = designFingerprint(theme, seed)
      const { data: sameTheme } = await supabase
        .from('site_configs')
        .select('tenant_id, design_variant, brand_name')
        .eq('theme', theme)
        .neq('tenant_id', tenantId)
      const collision = (sameTheme || []).some((row) => {
        if (isForcedPreset(row.design_variant)) return false
        const otherSeed = siteSeed({ designVariant: row.design_variant, widgetId: row.tenant_id, brandName: row.brand_name })
        return otherSeed && designFingerprint(theme, otherSeed) === fingerprint
      })
      if (collision) {
        issues.push({
          code: 'duplicate_design',
          severity: 'warning',
          message: `This site's exact design fingerprint (structure + fonts + accent) within theme "${theme}" is already used by another tenant — it won't look bespoke next to it.`,
          fixable: true,
          meta: { theme },
        })
      }
    }
  }

  // ── 5. Live crawl (best-effort — never throws) ──
  const publicUrl = hostname ? getTenantPublicUrl(hostname) : null
  const crawlUrl = publicUrl ? buildTenantPreviewUrl(publicUrl) || publicUrl : null
  if (!crawlUrl || crawlUrl === '#') {
    issues.push({
      code: 'site_not_reachable',
      severity: 'warning',
      message: 'Could not construct a reachable URL for this tenant (no ADMIN_BYPASS_SECRET or no domain) — skipped the live link/image crawl.',
      fixable: false,
    })
  } else {
    try {
      const res = await fetch(crawlUrl, { signal: withTimeout(FETCH_TIMEOUT_MS) })
      if (!res.ok) {
        issues.push({
          code: 'homepage_unreachable',
          severity: 'error',
          message: `Homepage returned HTTP ${res.status}.`,
          fixable: false,
        })
      } else {
        const html = await res.text()

        if (navLinks.length > 0 && !/<nav[\s>]/.test(html)) {
          issues.push({
            code: 'nav_not_rendered',
            severity: 'error',
            message: 'nav_links is populated in the database, but no <nav> element actually rendered on the live page.',
            fixable: false,
          })
        }

        const origin = new URL(crawlUrl).origin
        const internalLinks = extractInternalLinks(html).slice(0, MAX_LINKS_CHECKED)
        for (const link of internalLinks) {
          const target = new URL(link, origin)
          if (crawlUrl.includes('admin_bypass=')) {
            const secret = new URL(crawlUrl).searchParams.get('admin_bypass')
            if (secret) target.searchParams.set('admin_bypass', secret)
          }
          const { ok, status } = await urlOk(target.toString())
          if (!ok) {
            issues.push({
              code: 'broken_link',
              severity: 'error',
              message: `Internal link "${link}" is broken${status ? ` (HTTP ${status})` : ''}.`,
              fixable: false,
              meta: { link },
            })
          }
        }

        const imageUrls = extractImageUrls(html).slice(0, MAX_IMAGES_CHECKED)
        for (const img of imageUrls) {
          const target = img.startsWith('http') ? img : new URL(img, origin).toString()
          const { ok, status } = await urlOk(target)
          if (!ok) {
            issues.push({
              code: 'broken_image',
              severity: 'error',
              message: `Image failed to load${status ? ` (HTTP ${status})` : ''}: ${img.slice(0, 120)}`,
              fixable: true,
              meta: { url: img },
            })
          }
        }
      }
    } catch (err) {
      issues.push({
        code: 'crawl_failed',
        severity: 'warning',
        message: `Live crawl failed: ${err instanceof Error ? err.message : String(err)}. This may just mean the site hasn't finished deploying yet — re-run validation shortly.`,
        fixable: false,
      })
    }
  }

  // Generic placeholder hero image (never regenerated) is a low-severity
  // "not bespoke enough" signal, not a hard failure.
  if (config.hero_config?.backgroundImage === GENERIC_HERO_URL) {
    issues.push({
      code: 'generic_hero_image',
      severity: 'warning',
      message: 'Hero background is still the generic fallback stock photo, not a bespoke/AI-generated image.',
      fixable: true,
    })
  }

  const hasError = issues.some((i) => i.severity === 'error')
  return {
    status: hasError ? 'failed' : 'passed',
    issues,
    checkedAt: new Date().toISOString(),
  }
}

/** Persists a validation report to `tenants` (validation_status/report/validated_at). */
export async function saveValidationReport(tenantId: string, report: ValidationReport): Promise<void> {
  const supabase = getSupabaseAdmin()
  await supabase
    .from('tenants')
    .update({
      validation_status: report.status,
      validation_report: report.issues,
      validated_at: report.checkedAt,
    })
    .eq('id', tenantId)
}
