import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  getTenantPreviewSiteUrl,
  buildTenantPreviewUrlFromDomains,
  pickPreviewHostname,
  isDevHostname,
} from '@/lib/admin-preview'
import {
  THEME_LAYOUT_AFFINITY,
  MINIMAL_LAYOUTS_WITHOUT_ANCHOR_SECTIONS,
  type ThemeSlug,
  type LayoutSlug,
} from '@/lib/catalog/sitePresentationCatalog'
import { designFingerprint, siteSeed } from '@/lib/catalog/designFingerprint'
import { isForcedPreset } from '@/lib/catalog/designVariantCatalog'
import { GENERIC_HERO as GENERIC_HERO_URL } from '@/lib/provision/buildTemplateSiteConfig'
import {
  findEmptyWidgetShells,
  findUnmountedWidgetShells,
  htmlHasInjectableWidget,
  isCustomSiteConfig,
  validateCustomConfig,
} from '@/lib/customSite'
import { analyzeSpecificity, analyzeToneBalance } from '@/lib/validation/specificityGate'
import {
  findFormulaicTitles,
  findPlaceholderTells,
  hasEmDashInShortCopy,
} from '@/lib/ai/humanCopyVoice'

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

/**
 * Copy-quality enforcement cutoff. Tenants created on/after this instant get
 * copy findings (AI tells, no proprietary detail, decorative stats, uniform
 * positivity) at severity 'error' — which fails validation and blocks the
 * approve gate. Tenants created before it keep 'warning' so legacy sites,
 * provisioned before the Craft & proof intake step existed, are not broken
 * retroactively; those are handled by the Phase-5 fleet audit instead.
 * Deliberately a deploy-date constant (overridable via env) rather than a
 * schema flag — see plan-eliminateAiTells "open items".
 */
const COPY_ENFORCEMENT_CUTOFF_ISO =
  process.env.COPY_GATE_CUTOFF_ISO || '2026-08-08T00:00:00Z'

export function copyGateEnforcedFor(createdAt?: string | null): boolean {
  if (!createdAt) return false
  const created = Date.parse(createdAt)
  const cutoff = Date.parse(COPY_ENFORCEMENT_CUTOFF_ISO)
  return Number.isFinite(created) && Number.isFinite(cutoff) && created >= cutoff
}

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

export type RenderedDesignFinding = {
  code: string
  message: string
  meta?: Record<string, unknown>
}

export type DirectCopyFinding = {
  code: 'copy_placeholder' | 'copy_em_dash_short' | 'copy_formulaic_title'
  message: string
  samples: string[]
}

function visibleTextSegments(input: string): string[] {
  const withoutHiddenContent = input
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  const segments = withoutHiddenContent.includes('<')
    ? withoutHiddenContent.split(/<[^>]+>/g)
    : [withoutHiddenContent]
  return segments
    .map((text) => text.replace(/&(?:nbsp|amp|quot|#39);/gi, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

/** Direct copy tells that complement the broader specificity/tone analysis. */
export function analyzeDirectCopyTells(input: string): DirectCopyFinding[] {
  const placeholders = new Set<string>()
  const emDashSegments = new Set<string>()
  const formulaicTitles = new Set<string>()

  for (const segment of visibleTextSegments(input)) {
    for (const tell of findPlaceholderTells(segment)) placeholders.add(tell)
    if (hasEmDashInShortCopy(segment)) emDashSegments.add(segment)
    for (const title of findFormulaicTitles(segment)) formulaicTitles.add(title)
  }

  const findings: DirectCopyFinding[] = []
  if (placeholders.size > 0) {
    findings.push({
      code: 'copy_placeholder',
      message: `Customer-visible copy contains unfilled placeholder text: ${[...placeholders].join(', ')}.`,
      samples: [...placeholders],
    })
  }
  if (emDashSegments.size > 0) {
    findings.push({
      code: 'copy_em_dash_short',
      message: 'Short customer-visible copy uses an em dash, a repeated template fingerprint.',
      samples: [...emDashSegments],
    })
  }
  if (formulaicTitles.size > 0) {
    findings.push({
      code: 'copy_formulaic_title',
      message: `Customer-visible copy contains a formulaic title: ${[...formulaicTitles].join(', ')}.`,
      samples: [...formulaicTitles],
    })
  }
  return findings
}

/** Cheap structural checks over server-rendered HTML; browser QA covers computed styles. */
export function analyzeRenderedDesign(
  html: string,
  options: { renderMode?: string | null } = {},
): RenderedDesignFinding[] {
  const findings: RenderedDesignFinding[] = []
  const h1Count = (html.match(/<h1[\s>]/gi) || []).length
  if (h1Count === 0) {
    findings.push({ code: 'design_missing_h1', message: 'Live homepage renders no <h1>. Every page needs exactly one top-level heading for hierarchy and SEO.' })
  } else if (h1Count > 1) {
    findings.push({ code: 'design_multiple_h1', message: `Live homepage renders ${h1Count} <h1> elements. Keep exactly one.`, meta: { count: h1Count } })
  }
  if (!/<main[\s>]/i.test(html)) {
    findings.push({ code: 'design_missing_main_landmark', message: 'Live homepage has no <main> landmark. Screen readers need it to skip to content.' })
  }
  if (!/<footer[\s>]/i.test(html)) {
    findings.push({ code: 'design_missing_footer', message: 'Live homepage has no <footer>. A complete local-business site needs contact and ownership information.' })
  }

  const imgsWithoutAlt = (html.match(/<img\s(?![^>]*\balt=)[^>]*>/gi) || []).length
  if (imgsWithoutAlt > 0) {
    findings.push({ code: 'design_img_missing_alt', message: `${imgsWithoutAlt} image${imgsWithoutAlt === 1 ? '' : 's'} on the live homepage have no alt attribute.`, meta: { count: imgsWithoutAlt } })
  }

  const ids = [...html.matchAll(/\sid=["']([^"']+)["']/gi)].map((match) => match[1])
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))]
  if (duplicateIds.length > 0) {
    findings.push({ code: 'design_duplicate_ids', message: `Live homepage repeats ${duplicateIds.length} HTML id${duplicateIds.length === 1 ? '' : 's'}, which breaks label, anchor, and assistive-technology targeting.`, meta: { ids: duplicateIds.slice(0, 10) } })
  }

  const headingLevels = [...html.matchAll(/<h([1-6])[\s>]/gi)].map((match) => Number(match[1]))
  const headingJump = headingLevels.findIndex((level, index) => index > 0 && level > headingLevels[index - 1] + 1)
  if (headingJump >= 0) {
    findings.push({ code: 'design_heading_order', message: `Heading hierarchy jumps from h${headingLevels[headingJump - 1]} to h${headingLevels[headingJump]}.`, meta: { levels: headingLevels } })
  }

  let unlabeledControls = 0
  for (const match of html.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)) {
    const attrs = match[2]
    if (/\btype=["']hidden["']/i.test(attrs)) continue
    if (/\baria-label(?:ledby)?=["'][^"']+["']/i.test(attrs)) continue
    const id = attrs.match(/\bid=["']([^"']+)["']/i)?.[1]
    if (id && new RegExp(`<label\\b[^>]*\\bfor=["']${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i').test(html)) continue
    unlabeledControls += 1
  }
  if (unlabeledControls > 0) {
    findings.push({ code: 'design_unlabeled_controls', message: `${unlabeledControls} form control${unlabeledControls === 1 ? '' : 's'} have no associated label.`, meta: { count: unlabeledControls } })
  }

  const emptySections = [...html.matchAll(/<section\b[^>]*>([\s\S]*?)<\/section>/gi)].filter((match) => {
    const body = match[1]
    if (/<(?:img|video|canvas|iframe|closet-[a-z-]+)\b/i.test(body)) return false
    return body.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').trim().length === 0
  }).length
  if (emptySections > 0) {
    findings.push({ code: 'design_empty_sections', message: `${emptySections} empty section${emptySections === 1 ? '' : 's'} render on the homepage.`, meta: { count: emptySections } })
  }

  const orphanSections = [...html.matchAll(/<section\b[^>]*>([\s\S]*?)<\/section>/gi)].filter((match) => {
    const body = match[1]
    const text = body.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim()
    const hasPurpose = /<(?:h[1-6]|img|video|canvas|iframe|form|closet-[a-z-]+)\b/i.test(body)
    return text.length > 0 && text.length < 12 && !hasPurpose
  }).length
  if (orphanSections > 0) {
    findings.push({ code: 'design_orphan_sections', message: `${orphanSections} section${orphanSections === 1 ? '' : 's'} contain too little content to establish a clear purpose.`, meta: { count: orphanSections } })
  }

  if (options.renderMode === 'engine') {
    if (!/data-engine-site=["']v2["']/i.test(html)) {
      findings.push({ code: 'design_craft_system_missing', message: 'Template page is missing the current modular type, spacing, and image craft system marker.' })
    }
    if (!/data-focus-standard=["']visible-ring["']/i.test(html)) {
      findings.push({ code: 'design_focus_standard_missing', message: 'Template page does not declare the platform keyboard-focus standard.' })
    }
    if (!/data-performance-standard=["']reserved-media-next-font["']/i.test(html)) {
      findings.push({ code: 'design_performance_standard_missing', message: 'Template page does not declare reserved media geometry and self-hosted font safeguards.' })
    }
    if (!/<img\b[^>]*\bfetchpriority=["']high["']/i.test(html) && !/<link\b[^>]*\brel=["']preload["'][^>]*\bas=["']image["']/i.test(html)) {
      findings.push({ code: 'design_lcp_priority_missing', message: 'Template page has no high-priority hero image candidate for Largest Contentful Paint.' })
    }
    if (/fonts\.(?:googleapis|gstatic)\.com/i.test(html)) {
      findings.push({ code: 'design_external_font_runtime', message: 'Template page loads a runtime Google font resource instead of the self-hosted next/font output.' })
    }
  }

  return findings
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
      id, business_name, owner_email, widget_id, created_at,
      domains ( hostname, source, is_primary ),
      site_configs ( theme, layout_style, design_variant, nav_links, hero_config, before_after_config, products_config, logo_url, brand_name, process_config, default_room, render_mode, custom_config, custom_config_draft )
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

  const domainRows = Array.isArray(tenant.domains)
    ? tenant.domains
    : tenant.domains
      ? [tenant.domains as { hostname?: string; source?: string; is_primary?: boolean }]
      : []
  const hostname = pickPreviewHostname(
    domainRows.map((d) => ({
      hostname: d.hostname || '',
      source: d.source,
      is_primary: d.is_primary,
    }))
  )
  const config = (Array.isArray(tenant.site_configs) ? tenant.site_configs[0] : tenant.site_configs) as
    | {
        theme?: string
        layout_style?: string
        design_variant?: string | null
        nav_links?: NavLink[] | null
        hero_config?: { headline?: string; backgroundImage?: string } | null
        before_after_config?: { beforeImage?: string; afterImage?: string } | null
        products_config?: { image?: string; title?: string; details?: { specifications?: string[] } }[] | null
        logo_url?: string | null
        brand_name?: string | null
        default_room?: string | null
        process_config?: {
          title?: string
          subtitle?: string
          steps?: { number?: string; title?: string; description?: string }[]
        } | null
        render_mode?: string | null
        custom_config?: unknown
        custom_config_draft?: unknown
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

  // Copy the specificity gate reads. Custom sites carry every page's HTML in the
  // artifact, so they can be judged without a network round-trip; engine sites
  // fall back to the live homepage fetched during the crawl below.
  const copyPages: string[] = []

  // ── 1b. Custom-build widget mount (Full Redesign empty-box class of bug) ──
  if (config.render_mode === 'custom') {
    const published = isCustomSiteConfig(config.custom_config) ? config.custom_config : null
    const draft = isCustomSiteConfig(config.custom_config_draft)
      ? config.custom_config_draft
      : null
    const artifact = published || draft
    if (!artifact) {
      issues.push({
        code: 'custom_config_missing',
        severity: 'error',
        message:
          'Site is in custom render mode but has no custom_config artifact — visitors may see a blank page.',
        fixable: false,
      })
    } else {
      const check = validateCustomConfig(artifact)
      for (const err of check.errors) {
        issues.push({
          code: 'custom_widget_invalid',
          severity: 'error',
          message: err,
          fixable: true,
          meta: { source: published ? 'published' : 'draft' },
        })
      }
      for (const page of Object.values(artifact.pages)) {
        if (page?.html) copyPages.push(page.html)
      }
      const homeHtml = artifact.pages['/']?.html || artifact.pages['']?.html || ''
      if (!htmlHasInjectableWidget(homeHtml)) {
        issues.push({
          code: 'custom_widget_missing',
          severity: 'error',
          message:
            'Custom home page has no injectable <!-- CLOSET_WIDGET --> mount — the quote calculator will not appear.',
          fixable: true,
        })
      }
      for (const shell of findEmptyWidgetShells(homeHtml)) {
        issues.push({
          code: 'custom_widget_empty_shell',
          severity: 'error',
          message: `Empty widget container on custom home (${shell}) — visitors see a blank box under the CTA.`,
          fixable: true,
          meta: { shell },
        })
      }
    }
  }

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

  // ── 3.5. Process steps validation ──
  const processConfig = config.process_config
  if (processConfig) {
    const steps = processConfig.steps || []
    const hasThreeSteps = steps.length === 3
    const startsWithOne = steps[0]?.number === '01'
    const isOrdered = steps[0]?.number === '01' && steps[1]?.number === '02' && steps[2]?.number === '03'
    if (!hasThreeSteps || !startsWithOne || !isOrdered) {
      issues.push({
        code: 'invalid_process_steps',
        severity: 'warning',
        message: `Process section has invalid steps. It must have exactly 3 steps numbered '01', '02', '03' in order. Currently has: ${steps.map(s => s.number || '(none)').join(', ')}.`,
        fixable: true,
        meta: { stepsCount: steps.length },
      })
    }
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
  const previewDomainRows = domainRows.map((d) => ({
    hostname: d.hostname || '',
    source: d.source,
    is_primary: d.is_primary,
  }))
  const previewHost = pickPreviewHostname(previewDomainRows)
  const publicUrl = getTenantPreviewSiteUrl(previewDomainRows)
  const crawlUrl =
    publicUrl && publicUrl !== '#'
      ? buildTenantPreviewUrlFromDomains(previewDomainRows) || publicUrl
      : null

  // Cloud validator cannot DNS-resolve *.localhost / 127.0.0.1 preview hosts.
  // Check the hostname (not the full URL) — admin_bypass query strings broke
  // earlier regex matching and kept producing "Live crawl failed: fetch failed".
  if (previewHost && isDevHostname(previewHost)) {
    issues.push({
      code: 'crawl_skipped_local',
      severity: 'warning',
      message:
        'Live crawl skipped: this site only has a local preview hostname (*.localhost), which is not reachable from the cloud. Open Preview on your machine or attach a public domain to crawl links/images.',
      fixable: false,
    })
  } else if (!crawlUrl || crawlUrl === '#') {
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
        if (copyPages.length === 0) copyPages.push(html)

        if (navLinks.length > 0 && !/<nav[\s>]/.test(html)) {
          issues.push({
            code: 'nav_not_rendered',
            severity: 'error',
            message: 'nav_links is populated in the database, but no <nav> element actually rendered on the live page.',
            fixable: false,
          })
        }

        // Live engagement widget must actually mount (custom + engine sites).
        const hasLiveWidget =
          /<closet-(?:quote|order|booking|ticket)-widget\b[^>]*data-contractor-id=/i.test(
            html
          )
        if (!hasLiveWidget) {
          issues.push({
            code: 'live_widget_missing',
            severity: 'error',
            message:
              'Live homepage has no mounted engagement widget (closet-*-widget with data-contractor-id). Quote/lead capture will not work.',
            fixable: true,
          })
        }
        for (const shell of findUnmountedWidgetShells(html)) {
          issues.push({
            code: 'live_widget_empty_shell',
            severity: 'error',
            message: `Live homepage has a widget container without a mounted calculator (${shell}) — typically a Full Redesign placeholder that never received the widget.`,
            fixable: true,
            meta: { shell },
          })
        }

        // ── Design QA rubric (deterministic, Phase 6) ──
        // Same cutoff semantics as the copy gate: errors for new provisions,
        // warnings for legacy tenants. All checks are cheap string scans of
        // the already-fetched homepage HTML.
        {
          const designSeverity: ValidationSeverity = copyGateEnforcedFor(
            (tenant as { created_at?: string | null }).created_at
          )
            ? 'error'
            : 'warning'
          for (const finding of analyzeRenderedDesign(html, {
            renderMode: config.render_mode === 'custom' ? 'custom' : 'engine',
          })) {
            issues.push({ ...finding, severity: designSeverity, fixable: false })
          }
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

  // ── Specificity gate: the mechanical half of the swap test ──
  //
  // Severity depends on when the tenant was provisioned. New tenants (created
  // after COPY_ENFORCEMENT_CUTOFF_ISO) fail validation on copy findings, which
  // blocks the approve gate until the copy is fixed or auto-repaired. Legacy
  // tenants keep 'warning' so they are not broken retroactively; the fleet
  // audit script covers them. Only 'copy_ai_tell_phrase' is fixable: banned
  // phrases can be mechanically rewritten, whereas a missing proprietary
  // detail is a fact only the owner can supply.
  {
    const enforceCopyErrors = copyGateEnforcedFor(
      (tenant as { created_at?: string | null }).created_at
    )
    const copySeverity: ValidationSeverity = enforceCopyErrors ? 'error' : 'warning'
    const businessName = (config.brand_name || tenant.business_name || '').trim()
    for (const [index, pageHtml] of copyPages.entries()) {
      // Locality is not joined in here, so a city name still counts as a named
      // place. That errs toward passing, which is the right way for a new check
      // to be wrong.
      for (const finding of analyzeSpecificity({ text: pageHtml, businessName })) {
        issues.push({
          code: finding.code,
          severity: copySeverity,
          message:
            copyPages.length > 1
              ? `Page ${index + 1} of ${copyPages.length}: ${finding.message}`
              : finding.message,
          fixable: finding.code === 'copy_ai_tell_phrase',
          meta: finding.samples.length > 0 ? { samples: finding.samples } : undefined,
        })
      }
      for (const finding of analyzeDirectCopyTells(pageHtml)) {
        issues.push({
          code: finding.code,
          severity: copySeverity,
          message:
            copyPages.length > 1
              ? `Page ${index + 1} of ${copyPages.length}: ${finding.message}`
              : finding.message,
          fixable: true,
          meta: { samples: finding.samples },
        })
      }
    }
    for (const finding of analyzeToneBalance(copyPages)) {
      issues.push({
        code: finding.code,
        severity: copySeverity,
        message: finding.message,
        fixable: false,
      })
    }
  }

  // Over-long hero headlines overflow the monumental type scales some design
  // variants use, colliding with the fixed navbar (seen live: a 9-word page
  // headline under a centered transparent nav). The generator prompt caps
  // headlines at ~6 words; this is the independent safety net behind it.
  const heroHeadline = config.hero_config?.headline?.trim()
  if (heroHeadline && heroHeadline.split(/\s+/).length > 8) {
    issues.push({
      code: 'hero_headline_too_long',
      severity: 'warning',
      message: `Hero headline is ${heroHeadline.split(/\s+/).length} words — headlines over 8 words can overflow large-type design variants and collide with the fixed nav. Consider shortening: "${heroHeadline.slice(0, 80)}"`,
      fixable: false,
      meta: { headline: heroHeadline },
    })
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

  if (heroHeadline && /^Welcome to\b/i.test(heroHeadline)) {
    issues.push({
      code: 'welcome_to_headline',
      severity: 'warning',
      message: 'Hero headline starts with "Welcome to" — sounds template-generated. Prefer service + locality.',
      fixable: false,
      meta: { headline: heroHeadline },
    })
  }

  if (config.default_room === 'Custom Space') {
    issues.push({
      code: 'closet_default_room',
      severity: 'warning',
      message: 'default_room is still "Custom Space" (closet leftover). Prefer engagement-aware project/order labels.',
      fixable: false,
    })
  }

  const heroImg = config.hero_config?.backgroundImage || ''
  if (/unsplash\.com/i.test(heroImg)) {
    issues.push({
      code: 'unsplash_hero',
      severity: 'warning',
      message: 'Hero still uses an Unsplash URL — prefer a generated or uploaded asset.',
      fixable: true,
    })
  }

  const SPEC_TRIPLETS = [
    ['Premium Materials', 'Precision Fit', 'Lifetime Warranty'],
    ['Premium Materials', 'Professional Execution', 'Quality Guaranteed'],
    ['Licensed & insured', 'Free estimate', 'Satisfaction guaranteed'],
  ]
  const products = Array.isArray(config.products_config) ? config.products_config : []
  for (const p of products) {
    const specs = (p as { details?: { specifications?: string[] } })?.details?.specifications
    if (!Array.isArray(specs)) continue
    for (const trip of SPEC_TRIPLETS) {
      if (trip.every((t) => specs.includes(t))) {
        issues.push({
          code: 'generic_product_specs',
          severity: 'warning',
          message: `Product specs still use the generic trilogy (${trip.join(' / ')}).`,
          fixable: false,
        })
        break
      }
    }
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
