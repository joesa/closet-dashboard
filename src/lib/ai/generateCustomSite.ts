import { parseAdminImageDataUrl } from '@/lib/adminImageAttach'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  CLAUDE_SONNET_MODEL,
  generateTextWithFallback,
} from '@/lib/ai/aiTextProvider'
import {
  buildIntakeHintsForBrief,
  enhanceFullRedesignBrief,
} from '@/lib/ai/enhanceFullRedesignBrief'
import {
  extractJson,
  repairTruncatedJson,
  sanitizeJsonString,
} from '@/lib/ai/generateSiteConfig'
import {
  htmlHasInjectableWidget,
  isCustomSiteConfig,
  normalizeCustomPath,
  normalizeWidgetPlaceholders,
  sanitizeCustomConfig,
  validateCustomConfig,
  WIDGET_PLACEHOLDER,
  type CustomPageArtifact,
  type CustomSiteConfig,
} from '@/lib/customSite'
import {
  ensureHomeVideoAfterHero,
  listTenantMediaAssets,
} from '@/lib/customSiteAssets'
import {
  applyWidgetThemeToContractor,
  inferSiteAppearanceMode,
  pickWidgetThemeForSite,
} from '@/lib/widgetThemes'
import {
  mergeIntakeServicesWithBriefUpdates,
  parseServiceUpdates,
  type ProductRow,
  type ServiceUpdates,
} from '@/lib/ai/mergeBriefServices'
import { appendEngagementServices } from '@/lib/ai/appendEngagementServices'

export type CustomBuildIntent = 'full' | 'surgical'

export type GenerateCustomSiteResult = {
  draft: CustomSiteConfig
  warnings: string[]
  errors: string[]
  reply: string
  intent: CustomBuildIntent
  /** Pages that were actually overwritten in a surgical edit (empty for full). */
  changedPages: string[]
}

type SurgicalPatch = {
  globalCss?: string | null
  pages?: Record<
    string,
    Partial<Pick<CustomPageArtifact, 'html' | 'css' | 'title' | 'description'>> | null
  >
  unchangedPages?: string[]
  reply?: string
}

/** Deep-clone a custom site config (JSON-safe). */
export function cloneCustomConfig(config: CustomSiteConfig): CustomSiteConfig {
  return JSON.parse(JSON.stringify(config)) as CustomSiteConfig
}

/**
 * Merge a surgical patch onto a base config. Only non-null fields in the patch
 * overwrite the base. Omitted pages are left untouched.
 */
export function mergeCustomPatch(
  base: CustomSiteConfig,
  patch: SurgicalPatch
): { merged: CustomSiteConfig; changedPages: string[] } {
  const merged = cloneCustomConfig(base)
  const changedPages: string[] = []

  if (typeof patch.globalCss === 'string') {
    merged.globalCss = patch.globalCss
  }

  for (const [rawPath, pagePatch] of Object.entries(patch.pages || {})) {
    if (!pagePatch || typeof pagePatch !== 'object') continue
    const path = normalizeCustomPath(rawPath)
    const existing: CustomPageArtifact = merged.pages[path] || {
      html: '',
      title: path === '/' ? 'Home' : path.slice(1),
    }
    let touched = false
    const next: CustomPageArtifact = { ...existing }

    if (typeof pagePatch.html === 'string') {
      next.html = pagePatch.html
      touched = true
    }
    if (typeof pagePatch.css === 'string') {
      next.css = pagePatch.css
      touched = true
    }
    if (typeof pagePatch.title === 'string') {
      next.title = pagePatch.title
      touched = true
    }
    if (typeof pagePatch.description === 'string') {
      next.description = pagePatch.description
      touched = true
    }

    if (touched) {
      merged.pages[path] = next
      changedPages.push(path)
    }
  }

  return { merged, changedPages }
}

function ensureWidgetPlaceholder(config: CustomSiteConfig): void {
  const home = config.pages['/'] || config.pages['']
  if (!home) return
  // Canonicalize AI mutations (e.g. <!-- CLOSET_WIDGET theme="dark" -->) in place
  // so the CTA shell mounts the widget instead of leaving an empty box.
  home.html = normalizeWidgetPlaceholders(home.html || '')
  if (htmlHasInjectableWidget(home.html)) {
    config.pages['/'] = home
    return
  }
  home.html = `${home.html}\n<section class="closet-widget-slot">${WIDGET_PLACEHOLDER}</section>`
  config.pages['/'] = home
}

function looksLikeDesignRequest(prompt: string): boolean {
  return /\b(redesign|rebrand|new\s+look|from\s+scratch|entire\s+site|whole\s+site|completely\s+different|overhaul|restyle)\b/i.test(
    prompt
  )
}

function looksLikeTextOnlyRequest(prompt: string): boolean {
  return /\b(text|copy|headline|wording|typo|cta|button\s+label|paragraph|simplify\s+(the\s+)?(text|copy)|rename)\b/i.test(
    prompt
  )
}

function extractHttpUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s"'<>]+/i)
  if (!m) return null
  return m[0].replace(/[.,);]+$/, '')
}

function looksLikeVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)
}

function looksLikeVideoSurgicalRequest(prompt: string): boolean {
  return (
    /\b(video|mp4|webm|testimonial)\b/i.test(prompt) ||
    /\b(don't|do not|cant|can't|cannot)\s+see\b/i.test(prompt) ||
    /\bmissing\s+video\b/i.test(prompt) ||
    /\badd\s+(the\s+)?(uploaded\s+)?(video|mp4)\b/i.test(prompt) ||
    /\bembed\b/i.test(prompt)
  )
}

/**
 * Deterministic surgical path for video: use URL from the prompt, else the
 * newest video in the tenant Media library. Avoids the LLM asking for a URL
 * that is already uploaded on the same admin page.
 */
async function trySurgicalVideoShortcut(opts: {
  tenantId: string
  prompt: string
  base: CustomSiteConfig
}): Promise<GenerateCustomSiteResult | null> {
  if (!looksLikeVideoSurgicalRequest(opts.prompt)) return null

  const fromPrompt = extractHttpUrl(opts.prompt)
  let videoUrl =
    fromPrompt && looksLikeVideoUrl(fromPrompt) ? fromPrompt : null

  if (!videoUrl) {
    const videos = await listTenantMediaAssets(opts.tenantId, {
      kind: 'video',
      includeEngine: false,
    })
    videoUrl = videos[0]?.url || null
  }

  if (!videoUrl) {
    return {
      draft: opts.base,
      warnings: [],
      errors: [],
      reply:
        'No video found in Media & files for this tenant. Upload an MP4 there (or paste a CDN URL in the prompt), then run Edit surgically again.',
      intent: 'surgical',
      changedPages: [],
    }
  }

  const { draft } = await ensureHomeVideoAfterHero({
    tenantId: opts.tenantId,
    videoUrl,
  })
  const homeBefore = opts.base.pages['/']?.html || ''
  const homeAfter = draft.pages['/']?.html || ''
  const changed = homeBefore !== homeAfter

  return {
    draft,
    warnings: changed
      ? []
      : ['Video was already present on the home page — source URL refreshed if needed.'],
    errors: [],
    reply: changed
      ? 'Embedded your Media library video in a player after the hero on the home page. Preview draft to confirm, then Publish when ready.'
      : 'Home page already had a video player — updated it to your Media library file. Preview draft to confirm.',
    intent: 'surgical',
    changedPages: changed ? ['/'] : [],
  }
}

/**
 * AI-builds (full) or surgically edits a custom HTML/CSS site into
 * custom_config_draft. Never touches render_mode or published custom_config
 * unless the admin publishes separately.
 */
export async function generateCustomSiteDraft(opts: {
  tenantId: string
  prompt: string
  mode?: 'inline' | 'iframe'
  /**
   * `full` — rebuild the whole custom site.
   * `surgical` — patch only what the admin asked for onto draft/published base.
   * Legacy: `iterate: true` maps to surgical.
   */
  intent?: CustomBuildIntent
  /** @deprecated use intent: 'surgical' */
  iterate?: boolean
  /**
   * Optional reference images as data URLs (`data:image/...;base64,...`) —
   * screenshots, moodboards, or layouts to imitate.
   */
  images?: string[]
}): Promise<GenerateCustomSiteResult> {
  const supabase = getSupabaseAdmin()
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select(
      `
      id,
      business_name,
      widget_id,
      site_configs (
        brand_name,
        theme,
        engagement_model,
        hero_config,
        about_config,
        products_config,
        seo_config,
        pages_config,
        nav_links,
        custom_config_draft,
        custom_config
      )
    `
    )
    .eq('id', opts.tenantId)
    .single()

  if (error || !tenant) throw new Error('Tenant not found')

  const cfg = Array.isArray(tenant.site_configs)
    ? tenant.site_configs[0]
    : tenant.site_configs
  if (!cfg) throw new Error('Site config not found')

  const existingDraft = isCustomSiteConfig(cfg.custom_config_draft)
    ? cfg.custom_config_draft
    : null
  const published = isCustomSiteConfig(cfg.custom_config) ? cfg.custom_config : null
  const base = existingDraft || published

  let intent: CustomBuildIntent =
    opts.intent === 'full' || opts.intent === 'surgical'
      ? opts.intent
      : opts.iterate
        ? 'surgical'
        : 'full'

  if (intent === 'surgical' && !base) {
    throw new Error(
      'No custom site to edit yet — use “Generate from scratch” (clones the live site) first, then surgical edits.'
    )
  }

  if (intent === 'surgical' && base && !(opts.images && opts.images.length > 0)) {
    const mediaShortcut = await trySurgicalVideoShortcut({
      tenantId: opts.tenantId,
      prompt: opts.prompt || '',
      base,
    })
    if (mediaShortcut) return mediaShortcut
  }

  const attachmentImages = (opts.images || [])
    .map(parseAdminImageDataUrl)
    .filter((v): v is { mimeType: string; data: string } => !!v)
    .slice(0, 4)

  const mode = opts.mode || base?.mode || 'inline'
  const products = Array.isArray(cfg.products_config) ? cfg.products_config : []
  const pagesConfig = Array.isArray(cfg.pages_config) ? cfg.pages_config : []
  const seo = (cfg.seo_config || {}) as Record<string, unknown>
  const brandName = (cfg.brand_name || tenant.business_name || 'Business') as string

  // Full redesigns must ship EVERY page the prospect chose on intake — the
  // old slice(0,3) cap silently dropped pages and made rebuilds look thin.
  const requestedSlugs = pagesConfig
    .map((p: { slug?: string }) => (typeof p.slug === 'string' ? p.slug : ''))
    .filter(Boolean)
    .slice(0, 8)
  const pageHints =
    requestedSlugs.length > 0
      ? ['/', ...requestedSlugs.map((s: string) => (s.startsWith('/') ? s : `/${s}`))]
          .filter((v, i, a) => a.indexOf(v) === i)
          .slice(0, 9)
          .join(', ')
      : '/, /about, /services, /contact'

  const mediaLibrary = await listTenantMediaAssets(opts.tenantId, {
    kind: 'all',
    includeEngine: false,
  }).catch(() => [])

  const context = {
    brandName,
    themeHint: cfg.theme,
    engagementModel: cfg.engagement_model,
    hero: cfg.hero_config,
    about: cfg.about_config,
    services: products.map((p: { title?: string; description?: string; image?: string }) => ({
      title: p.title,
      description: p.description,
      image: p.image,
    })),
    seo: {
      phone: seo.phone,
      email: seo.email,
      city: seo.addressLocality,
      region: seo.addressRegion,
    },
    /** Uploaded CDN assets the admin can reference without pasting URLs. */
    // Cap media list so Full redesign prompts stay within the serverless time budget.
    mediaLibrary: mediaLibrary.slice(0, 24).map((a) => ({
      kind: a.kind,
      name: a.name,
      url: a.url,
    })),
  }

  // Full redesigns get the complete intake content — every page the prospect
  // requested with its section copy and images — so nothing they submitted is
  // dropped from the rebuilt site. (Surgical edits already carry the live
  // site JSON, so they keep the lean context.)
  const intakePages = pagesConfig.slice(0, 8).map((p: Record<string, unknown>) => {
    const hero = (p.hero || {}) as Record<string, unknown>
    const blocks = Array.isArray(p.content_blocks) ? p.content_blocks : []
    return {
      slug: typeof p.slug === 'string' ? p.slug : '',
      title: typeof p.title === 'string' ? p.title : '',
      hero: {
        headline: typeof hero.headline === 'string' ? hero.headline : undefined,
        subheadline: typeof hero.subheadline === 'string' ? hero.subheadline : undefined,
        backgroundImage:
          typeof hero.backgroundImage === 'string' ? hero.backgroundImage : undefined,
      },
      sections: blocks.slice(0, 8).map((b: Record<string, unknown>) => ({
        type: typeof b.type === 'string' ? b.type : 'text',
        heading: typeof b.heading === 'string' ? b.heading : '',
        body: typeof b.body === 'string' ? b.body.slice(0, 1400) : '',
        image: typeof b.image === 'string' ? b.image : undefined,
        images: Array.isArray(b.images)
          ? (b.images as unknown[])
              .filter((u): u is string => typeof u === 'string')
              .slice(0, 12)
          : undefined,
        items: Array.isArray(b.items)
          ? (b.items as Array<Record<string, unknown>>).slice(0, 12).map((it) => ({
              title: typeof it.title === 'string' ? it.title : '',
              description:
                typeof it.description === 'string' ? it.description.slice(0, 400) : '',
              image: typeof it.image === 'string' ? it.image : undefined,
            }))
          : undefined,
      })),
    }
  })

  const result =
    intent === 'surgical' && base
      ? await runSurgicalGenerate({
          brandName,
          prompt: opts.prompt,
          mode,
          base,
          context,
          images: attachmentImages,
        })
      : await runFullGenerate({
          brandName,
          prompt: opts.prompt,
          mode,
          pageHints,
          context: {
            ...context,
            /** Every intake page with its full section content — build them all. */
            intakePages,
            navLinks: Array.isArray(cfg.nav_links) ? cfg.nav_links : undefined,
          },
          images: attachmentImages,
        })

  const sanitized = sanitizeCustomConfig(result.config)
  ensureWidgetPlaceholder(sanitized)
  const check = validateCustomConfig(sanitized)
  if (!check.ok) {
    console.warn('[generateCustomSite] validation errors:', check.errors)
  }

  // Safety net: text-only surgical request that rewrote most pages → warn.
  const warnings = [...check.warnings, ...result.extraWarnings]
  if (
    intent === 'surgical' &&
    base &&
    looksLikeTextOnlyRequest(opts.prompt) &&
    !looksLikeDesignRequest(opts.prompt) &&
    result.changedPages.length > Math.max(1, Object.keys(base.pages).length / 2)
  ) {
    warnings.push(
      `Surgical edit touched ${result.changedPages.length} pages (${result.changedPages.join(', ')}). Review the draft carefully — if you only wanted copy changes, discard and try a more specific prompt.`
    )
  }

  // Full redesign: merge brief-introduced services into products_config + engine.
  let mergedProducts: ProductRow[] | null = null
  if (intent === 'full') {
    const serviceUpdates =
      'serviceUpdates' in result && result.serviceUpdates
        ? result.serviceUpdates
        : { added: [], removed: [] }
    const mergeResult = mergeIntakeServicesWithBriefUpdates(
      products as ProductRow[],
      serviceUpdates
    )
    mergedProducts = mergeResult.products
    if (mergeResult.added.length) {
      warnings.push(
        `Added services from brief: ${mergeResult.added.map((a) => a.title).join(', ')}.`
      )
    }
    if (mergeResult.removed.length) {
      warnings.push(
        `Removed intake services (explicit brief): ${mergeResult.removed.map((r) => r.title).join(', ')}.`
      )
    }
    const htmlBlob = Object.values(sanitized.pages || {})
      .map((p) => `${p.html || ''} ${p.title || ''}`)
      .join('\n')
      .toLowerCase()
    for (const p of mergeResult.products) {
      const title = typeof p.title === 'string' ? p.title.trim() : ''
      if (!title) continue
      if (!htmlBlob.includes(title.toLowerCase())) {
        warnings.push(
          `Service “${title}” is in the catalog but may be missing from redesign HTML — check home/services pages.`
        )
      }
    }
    warnings.push(
      ...assessFullRedesignCraft({
        config: sanitized,
        serviceCount: mergeResult.products.filter(
          (p) => typeof p.title === 'string' && p.title.trim()
        ).length,
        brief: opts.prompt,
      })
    )
  }

  const siteUpdate: Record<string, unknown> = {
    custom_config_draft: sanitized,
    custom_updated_at: new Date().toISOString(),
  }
  if (mergedProducts) {
    siteUpdate.products_config = mergedProducts
  }

  const { error: updateErr } = await supabase
    .from('site_configs')
    .update(siteUpdate)
    .eq('tenant_id', opts.tenantId)

  if (updateErr) throw new Error(`Failed to save draft: ${updateErr.message}`)

  // Bust the websites app cache so Preview draft shows the new HTML immediately
  // instead of waiting up to 60s for unstable_cache to expire.
  try {
    const { revalidateTenantSiteCache } = await import('@/lib/tenants/revalidateTenantSite')
    await revalidateTenantSiteCache(opts.tenantId)
  } catch (revalErr) {
    console.warn('[generateCustomSite] draft revalidate failed:', revalErr)
  }

  // Full redesign / from-scratch: auto-pick a matched calculator theme so the
  // engagement widget blends with the new site (dark CTA → dark pack, etc.).
  let reply = result.reply
  if (intent === 'full' && tenant.widget_id) {
    try {
      const homeHtml = sanitized.pages['/']?.html || sanitized.pages['']?.html || ''
      const globalCss = sanitized.globalCss || ''
      const appearance = inferSiteAppearanceMode(homeHtml, globalCss)
      const { data: settingsRow } = await supabase
        .from('contractor_settings')
        .select('primary_color_hex, industry')
        .eq('id', tenant.widget_id)
        .maybeSingle()
      // Prefer the redesign's own accent token over the (often stale) contractor
      // primary — e.g. burnt-copper --acc beats a leftover slate #94a3b8.
      const cssAccent = extractCssAccent(globalCss)
      const picked = pickWidgetThemeForSite({
        mode: appearance,
        brandColor:
          cssAccent || (settingsRow?.primary_color_hex as string | null) || null,
        industryHint: [
          settingsRow?.industry,
          brandName,
          context.themeHint,
          context.engagementModel,
          opts.prompt,
        ]
          .filter(Boolean)
          .join(' '),
      })
      await applyWidgetThemeToContractor(supabase, tenant.widget_id as string, picked.id)
      reply = `${reply}\n\nAuto-selected calculator theme “${picked.name}” (${picked.mode}) to match this design.`
      warnings.push(
        `Calculator theme set to “${picked.name}” so the quote widget matches the new site.`
      )
    } catch (themeErr) {
      console.warn('[generateCustomSite] widget theme auto-pick failed:', themeErr)
    }

    // Append brief-added (and any newly merged) services into the engagement engine.
    if (mergedProducts) {
      try {
        const engineSync = await appendEngagementServices({
          supabase,
          tenantId: opts.tenantId,
          contractorId: tenant.widget_id as string,
          engagementModel:
            typeof cfg.engagement_model === 'string' ? cfg.engagement_model : 'quote',
          services: mergedProducts.map((p) => ({
            title: typeof p.title === 'string' ? p.title : '',
            description:
              typeof p.description === 'string' ? p.description : undefined,
          })),
        })
        warnings.push(...engineSync.warnings)
        if (engineSync.appended.length) {
          reply = `${reply}\n\nEngagement engine updated with: ${engineSync.appended.join(', ')}.`
          warnings.push(
            `Engagement engine gained: ${engineSync.appended.join(', ')}.`
          )
        }
      } catch (engineErr) {
        console.warn('[generateCustomSite] engagement service sync failed:', engineErr)
        warnings.push('Could not sync new services into the engagement engine.')
      }
    }
  }

  return {
    draft: sanitized,
    warnings,
    errors: check.errors,
    reply,
    intent,
    changedPages: result.changedPages,
  }
}

/** Pull --acc / --accent from generated globalCss for widget theme matching. */
export function extractCssAccent(css: string): string | null {
  if (!css) return null
  const m = css.match(/--acc(?:ent)?\s*:\s*(#[0-9a-fA-F]{3,8})\b/)
  return m?.[1] || null
}

/**
 * Soft craft checks after Full redesign — tips for the admin, never blocking.
 * Avoid heuristics that push every multi-service site into a dual-lane / dark-neon look.
 */
export function assessFullRedesignCraft(opts: {
  config: CustomSiteConfig
  serviceCount?: number
  brief?: string
}): string[] {
  const warnings: string[] = []
  const home =
    opts.config.pages['/']?.html || opts.config.pages['']?.html || ''
  const globalCss = opts.config.globalCss || ''
  const brief = (opts.brief || '').toLowerCase()
  const blob = `${globalCss}\n${home}`.toLowerCase()

  const sectionCount = (home.match(/<section\b/gi) || []).length
  const landmarkCount =
    sectionCount +
    (home.match(/<(header|main|footer)\b/gi) || []).length
  if (sectionCount < 4 && landmarkCount < 5) {
    warnings.push(
      'Home looks thin (few sections) — consider Preview and a surgical pass to deepen the hero → services → proof → conversion rhythm.'
    )
  }

  if (!/--[a-zA-Z][\w-]*\s*:/.test(globalCss)) {
    warnings.push(
      'globalCss has few/no CSS variables — Full redesign should emit a small token set (surfaces, text, accent) as a design system.'
    )
  }

  const hasFontsLink =
    /fonts\.googleapis\.com/i.test(home) ||
    Object.values(opts.config.pages || {}).some((p) =>
      /fonts\.googleapis\.com/i.test(p?.html || '')
    )
  if (!hasFontsLink) {
    warnings.push(
      'No Google Fonts <link> detected on pages — display/body pairing may fall back to system fonts.'
    )
  }

  // Only treat as dual-lane when the brief clearly describes two distinct businesses/lanes —
  // NOT merely "2+ services" (that would cookie-cutter every plumber/detailer).
  const explicitDualLane =
    /\b(dual[- ]?(lane|offer|audience)|two (disciplines|lanes|sides|businesses)|under one roof\b.{0,40}\b(and|plus)\b)/i.test(
      brief
    ) ||
    /\b(wrap|ppf|tint|aesthetic).{0,50}(mech|mechanical|brake|repair|maintenance)\b/i.test(
      brief
    ) ||
    /\b(mech|mechanical|brake|repair|maintenance).{0,50}(wrap|ppf|tint|aesthetic)\b/i.test(
      brief
    )
  if (explicitDualLane) {
    const accentVars = globalCss.match(/--acc(?:ent|2)?\b/gi) || []
    const btnClasses = (home.match(/btn-[a-z0-9-]+/gi) || []).length
    if (accentVars.length < 2 && btnClasses < 2) {
      warnings.push(
        'Brief describes two distinct lanes but home may lack a second accent/CTA — worth a surgical pass if that was intentional.'
      )
    }
  }

  // Flag common AI default skins (does not fail the job).
  const darkBase =
    /#(0[0-2][0-9a-f]{4}|0b0d0f|0b0d10|111827|0a0a0a)\b/i.test(globalCss) ||
    /--(?:ink|bg|background)\s*:\s*#(0|1)[0-9a-f]{5}/i.test(globalCss)
  const neonAccent =
    /#(c8f23c|a3e635|84cc16|3fe3ff|22d3ee|e5b34a|fbbf24)\b/i.test(blob) ||
    /lime|neon cyan|glacier cyan|battle gold/i.test(blob)
  if (darkBase && neonAccent && !/dark\s*mode|neon|charcoal|lime|cyan/i.test(brief)) {
    warnings.push(
      'Home leans on a dark + neon-accent palette (common AI default). If that was not the brief, try a redesign brief with an explicit light/warm/editorial direction.'
    )
  }

  const creamPaper =
    /#(f4f1ea|f7f4ef|faf6f1|f5f0e8|efe8dc)\b/i.test(globalCss) ||
    /--(?:paper|bg|background)\s*:\s*#(f[4-9a-f]{5})\b/i.test(globalCss)
  const terracotta =
    /#(c05a1e|b45309|c2410c|d97706|a16207|b4532a)\b/i.test(blob) ||
    /terracotta|warm[- ]?clay/i.test(blob)
  if (
    creamPaper &&
    terracotta &&
    !/cream|terracotta|warm clay|paper|serif/i.test(brief)
  ) {
    warnings.push(
      'Home leans on cream paper + terracotta accent (common AI default). If unintended, brief a different material world for this trade.'
    )
  }

  return warnings
}


async function runFullGenerate(opts: {
  brandName: string
  prompt: string
  mode: 'inline' | 'iframe'
  pageHints: string
  context: Record<string, unknown>
  images?: Array<{ mimeType: string; data: string }>
}): Promise<{
  config: CustomSiteConfig
  reply: string
  changedPages: string[]
  extraWarnings: string[]
  serviceUpdates: ServiceUpdates
}> {
  // Full redesigns use Claude Sonnet 5 by default — Fable 5's adaptive
  // thinking routinely exceeds the ~5 minute serverless budget. Override with
  // CUSTOM_SITE_CLAUDE_MODEL=claude-fable-5 if you want the frontier model.
  const useClaude = !!process.env.ANTHROPIC_API_KEY
  const hasImages = !!(opts.images && opts.images.length > 0)
  const adminBrief = (opts.prompt || '').trim()
  const hasBrief = adminBrief.length > 0 || hasImages

  const services = Array.isArray(opts.context.services)
    ? (opts.context.services as Array<{ title?: string }>)
        .map((s) => (typeof s.title === 'string' ? s.title.trim() : ''))
        .filter(Boolean)
    : []
  const engagementModel =
    typeof opts.context.engagementModel === 'string'
      ? opts.context.engagementModel
      : 'quote'
  const engagementLabel =
    engagementModel === 'order'
      ? 'online ordering'
      : engagementModel === 'booking'
        ? 'booking'
        : engagementModel === 'ticket'
          ? 'ticketing'
          : 'quote calculator'

  const seoCtx =
    opts.context.seo && typeof opts.context.seo === 'object'
      ? (opts.context.seo as Record<string, unknown>)
      : {}
  const enhanced = await enhanceFullRedesignBrief({
    brandName: opts.brandName,
    adminBrief,
    hasImages,
    engagementLabel,
    services,
    city: typeof seoCtx.city === 'string' ? seoCtx.city : undefined,
    region: typeof seoCtx.region === 'string' ? seoCtx.region : undefined,
    themeHint:
      typeof opts.context.themeHint === 'string' ? opts.context.themeHint : undefined,
    intakeHints: buildIntakeHintsForBrief(opts.context),
  })

  const systemPrompt = `You are a senior design lead at a small studio known for giving every client a visual identity that could not be mistaken for anyone else's. Clients come to you because they rejected work that felt templated or machine-generated. You produce production-ready marketing sites as raw HTML + CSS for real local businesses on this platform.

# Core rule: nothing you produce may look AI-generated

AI design clusters around recognizable defaults. Know the tells and design away from them unless the brief explicitly asks for one. The substitute for defaults is subject-derived design — the product's materials, tools, artifacts, vernacular, locality, and audience. Name the subject, audience, and the page's single job first; derive every choice from those.

The user message includes an OPTIMIZED CREATIVE BRIEF (expanded from the admin seed + intake) plus the raw ADMIN SEED. Execute the optimized brief for palette, type, signature element, and layout. When the ADMIN SEED is specific (named colors, dual-lane, services to add, layout asks), those specifics win over the optimizer's fillers.

Banned defaults (unless the brief explicitly requests them):
- Purple-to-blue / indigo / teal SaaS gradients, or gradients used instead of a real palette decision
- Cream/off-white + high-contrast serif display + terracotta/warm-clay accent as a habit skin
- Near-black + single acid-green / neon lime / cyan / gold accent applied regardless of fit; carbon texture; skewed italic CTAs
- Hero template: vague headline ("Build faster. Ship smarter."), gray subhead, two buttons, gradient blob / abstract 3D on the right
- Numbered markers (01 / 02 / 03) when content is not a real sequence
- Emoji in headings, UI copy, or feature lists
- Glassmorphism cards, floating blurred orbs, dot-grid as default texture
- Three identical icon-title-sentence cards with generic line icons that could describe any product
- Copy tells: "Elevate your…", "Seamless", "Unleash", "Empower", "Supercharge", "Next-generation", "Revolutionize", "Unlock", "Look no further", "We've got you covered", "Your one-stop shop", em-dash-heavy marketing, rule-of-three filler
- Inter / Poppins / Roboto / system-ui (or the same overused pairings on every site: Big Shoulders, Space Grotesk, Syne by habit)
- Dual-lane / "pick your lane" gateways unless the business truly has two distinct disciplines (wraps + mechanical). Several related services (oil + brakes + tires) is ONE catalog, one accent
- NEVER default to dark charcoal + neon "auto shop AI" skin or "premium dark local trade" unless the brief asks
- Invented testimonials, ratings, stats, awards, years-in-business, lorem, TODOs — only facts from context
- Stripe/Linear SaaS chrome pasted onto a local service business

Final check: if any part could be find-and-replaced onto a different product, redo that part.

# Workflow (internal only — never print the analysis)

Pass 1 — Direction (before tokens or HTML):
1. Understand the product: type, audience, business goal, the one action this site drives (always the engagement engine below — never invent HTML forms / multi-step estimators / booking wizards).
2. Lock the OPTIMIZED CREATIVE BRIEF: signature concept, material world, palette hexes, type pairing, signature element. Reference images (if any) refine that direction — absorb mood/composition, do not copy trademarks.
3. Self-check: would ten AI tools given this brief plausibly produce the same direction? If yes, revise before coding. State the winning signature concept in the JSON "reply".

Pass 2 — System + site (then emit JSON only):
4. Tokens in globalCss :root — implement the optimized palette (adjust only for AA contrast / brief overrides); --df/--bf from the brief's Google Fonts; optional mono only if it fits; one --acc (second accent ONLY for true dual-lane); spacing/radius/shadow consistent with direction (precision brands ≠ soft 24px radii).
5. Shared chrome: sticky header with real shop name + nav + phone + primary CTA; designed footer with real contact; .wrap .eyebrow .btn(+variants). One atmospheric device that fits (paper grain, wash, photo bleed, hairline grid, air — not mandatory neon seams).
6. Home (adapt, don't pad): branded header → hero (one sharp promise + primary CTA; second CTA only if dual-lane is real) → services covering ALL intake + brief-added services → proof/gallery from REAL urls only → process/why-us from facts only → conversion band with engagement engine → footer.
7. Build EVERY required path with the same header/footer. Services page: deep coverage of every service. Contact: tel:/mailto: + hours/address + optional second widget mount — never an HTML form. Use ALL intakePages + services copy; sharpen, don't invent.
8. Motion: one deliberate CSS moment (load or signature reveal). Respect prefers-reduced-motion. Excess animation is an AI tell.
9. Quality floor (do not announce): responsive ~768/~420, visible :focus, WCAG AA contrast, performance-conscious (no decorative assets that cost load without purpose).

# Non-negotiables (brief cannot remove these)

SERVICES — include every intake service from context.services${
    services.length
      ? `: ${services.join('; ')}`
      : ' (use titles in context.services)'
  }. Feature on home + real coverage on services (or equivalent). You MAY add services the creative brief explicitly introduces — list those only in serviceUpdates.added. Do NOT drop intake services unless the brief explicitly removes/replaces them — then serviceUpdates.removed with a short reason citing the brief. Never invent unrelated services the brief did not mention.

ENGAGEMENT ENGINE — this site uses "${engagementLabel}" (${engagementModel}). Embed EXACTLY this HTML comment on home (literal, no attributes):
  ${WIDGET_PLACEHOLDER}
Place it in the conversion / estimate / book / order section; optional repeat on contact. Mount must be transparent/flush — never background, border, box-shadow, or heavy padding on the element holding the comment (widget paints its own card). Map any brief "quote estimator" / "book a bay" / multi-step form onto this band + tel CTA — do NOT emit HTML forms.

INTAKE — ship EXACTLY these paths: ${opts.pageHints}. Preserve client facts from intakePages / about / seo.

# Platform (violations are stripped and break the site)

- Body HTML only (no html/head/body wrappers). Semantic header/nav/main/section/footer.
- STRIPPED: script, iframe, object, embed, form, on* attributes, javascript: URLs. There is NO JavaScript.
- CSS scoped at render. No @import. @media, @keyframes, @font-face OK.
- FIRST node of every page html: <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=...&display=swap">
- Images: ONLY https URLs from context (services, intakePages, mediaLibrary). Never invent URLs.
- Root-relative internal links matching page keys.

ALLOWED CSS-only interactivity: :hover/:focus-within, sticky nav, scroll-behavior, transitions/keyframes, details/summary, :target or checkbox+sibling tabs/filters, static before/after image pairs when two real photo URLs exist. FORBIDDEN: script, on*, form, range sliders, JS painters, multi-step quote/booking wizards.

${
  hasImages
    ? `REFERENCE IMAGES — part of the creative brief. Match feel/craft (palette, type, spacing, hierarchy). Do not copy trademarks/logos/proprietary art.`
    : ''
}

# Output

Output ONLY valid JSON (no markdown fences, no preamble):
{
  "mode": "${opts.mode}",
  "globalCss": "shared CSS (:root tokens + shared components)",
  "pages": {
    "/": { "html": "body HTML", "css": "optional", "title": "SEO title", "description": "meta" }
  },
  "serviceUpdates": {
    "added": [{ "title": "Brief-added service", "description": "optional" }],
    "removed": [{ "title": "Only if brief explicitly removes", "reason": "cite brief" }]
  },
  "reply": "3-5 sentences: signature concept, where it comes from in the subject's world, palette/type pairing, confirm intake + brief-added services + ${engagementLabel}"
}

SIZE BUDGET (hard — keep compact so generation finishes): globalCss ≤ 9000 chars. Home html ≤ 12000 chars. Other pages ≤ 6000 chars each. Total ≤ 48000 chars. Complete valid JSON only — no truncated strings.`

  const paletteLine = enhanced.palette
    .map((p) => `${p.role} ${p.hex}`)
    .join(', ')
  const userPrompt = `Full redesign for "${opts.brandName}".

ADMIN SEED (honor every specific instruction — colors, layout, services to add):
${
  adminBrief
    ? adminBrief
    : hasImages
      ? '(no text — reference images + optimized brief drive direction)'
      : '(empty — optimized brief was invented from intake only)'
}

OPTIMIZED CREATIVE BRIEF (expanded from admin seed + intake; execute this for bespoke, non-AI look):
${enhanced.optimizedBrief}

DIRECTION LOCK:
- Signature: ${enhanced.signatureConcept}
- Material world: ${enhanced.materialWorld}
- Palette: ${paletteLine || '(see optimized brief)'}
- Type: ${enhanced.typography.display} + ${enhanced.typography.body} — ${enhanced.typography.why}
- Signature element: ${enhanced.signatureElement}
- Copy register: ${enhanced.copyRegister}
- Avoid: ${enhanced.avoidDefaults.join('; ') || 'AI default clusters'}
- Services to add from seed: ${
    enhanced.servicesToAdd.length
      ? enhanced.servicesToAdd.join(' | ')
      : '(none unless ADMIN SEED names them)'
  }
${hasImages ? `\nReference images attached: ${opts.images!.length}. Absorb mood into the optimized direction.\n` : ''}
KEEP ALWAYS:
- Engagement: ${engagementLabel} (${engagementModel}) — mount ${WIDGET_PLACEHOLDER} on home conversion section.
- Intake services: ${services.length ? services.join(' | ') : '(see context.services)'}
- Brief-named extra services → feature + serviceUpdates.added
- Pages: ${opts.pageHints}

BUSINESS CONTEXT (intake, services, SEO, media — use all of it):
${JSON.stringify(opts.context)}

Execute OPTIMIZED CREATIVE BRIEF + ADMIN SEED specifics. Output only the final JSON.`

  const extraWarnings: string[] = [
    `Creative brief enhanced from ${
      adminBrief ? 'your prompt + intake' : 'intake'
    } (${enhanced.source}) before generation — palette/type/signature locked for bespoke, non-AI look.`,
  ]
  if (!hasBrief) {
    extraWarnings.push(
      'No admin text or reference image — direction was invented from intake; add a short seed next time to steer it.'
    )
  }

  let parsed: Record<string, unknown>
  try {
    parsed = await callModelJson({
      systemPrompt,
      userPrompt,
      temperature: 0.7,
      // Compact JSON — Sonnet finishes faster with a tighter cap.
      maxOutputTokens: useClaude ? 24000 : 32768,
      preferredProvider: useClaude ? 'anthropic' : undefined,
      anthropicModel: CLAUDE_SONNET_MODEL,
      images: opts.images,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // Last-resort: if Claude still times out, try Gemini so the admin isn't stuck.
    if (/timed out/i.test(msg) && process.env.GEMINI_API_KEY) {
      console.warn('[runFullGenerate] Claude timed out — falling back to Gemini')
      extraWarnings.push(
        'Primary model timed out — finished with Gemini fallback (preview carefully).'
      )
      parsed = await callModelJson({
        systemPrompt,
        userPrompt,
        temperature: 0.65,
        maxOutputTokens: 32768,
        preferredProvider: 'gemini',
        images: opts.images,
      })
    } else {
      throw err
    }
  }

  const config: CustomSiteConfig = {
    mode: parsed.mode === 'iframe' ? 'iframe' : 'inline',
    globalCss: typeof parsed.globalCss === 'string' ? parsed.globalCss : '',
    pages:
      parsed.pages && typeof parsed.pages === 'object' && !Array.isArray(parsed.pages)
        ? (parsed.pages as CustomSiteConfig['pages'])
        : {},
  }

  const modelReply =
    typeof parsed.reply === 'string' && parsed.reply.trim()
      ? parsed.reply.trim()
      : 'Custom draft generated. Preview it, then publish when ready.'
  const reply = `Optimized direction (${enhanced.source}): ${enhanced.signatureConcept}\n\n${modelReply}`

  const serviceUpdates = parseServiceUpdates(parsed.serviceUpdates)
  const added = serviceUpdates.added ?? (serviceUpdates.added = [])
  // Merge enhancer-detected adds if the model omitted them but seed named them.
  for (const title of enhanced.servicesToAdd) {
    if (!added.some((s) => s.title.toLowerCase() === title.toLowerCase())) {
      added.push({ title })
    }
  }

  return {
    config,
    reply,
    changedPages: Object.keys(config.pages),
    serviceUpdates,
    extraWarnings,
  }
}

async function runSurgicalGenerate(opts: {
  brandName: string
  prompt: string
  mode: 'inline' | 'iframe'
  base: CustomSiteConfig
  context: Record<string, unknown>
  images?: Array<{ mimeType: string; data: string }>
}): Promise<{
  config: CustomSiteConfig
  reply: string
  changedPages: string[]
  extraWarnings: string[]
}> {
  const pageKeys = Object.keys(opts.base.pages || {})
  const hasImages = !!(opts.images && opts.images.length > 0)
  const systemPrompt = `You are a precise website editor. You make SURGICAL edits to an existing custom HTML/CSS site.

The admin already has a finished design. Your job is to apply ONLY what they asked for.

Output ONLY valid JSON matching this schema (no markdown fences):
{
  "intent": "surgical",
  "reply": "1-3 sentences describing exactly what you changed",
  "globalCss": null,
  "pages": {
    "/": { "html": "ONLY if this page's HTML must change", "css": null, "title": null, "description": null }
  },
  "unchangedPages": ["/about", "/services"]
}

Hard rules:
1. Apply ONLY the admin's request. Do NOT redesign, restyle, rebrand, or restructure unless they explicitly asked for that.
2. PRESERVE layout, structure, CSS classes, colors, imagery, navigation, and the widget placeholder (${WIDGET_PLACEHOLDER}) unless asked to change them.
3. Prefer text/copy edits inside existing markup — swap wording, keep the same tags and classes.
4. Return ONLY pages you actually changed under "pages". List every untouched path in "unchangedPages".
5. Set "globalCss" to null unless they explicitly asked to change site-wide styles. Never invent a new palette unprompted.
6. If a page is unchanged, omit it from "pages" entirely (do not echo the full original HTML).
7. mode stays "${opts.mode}". Do not change render mode.
8. HTML is BODY CONTENT ONLY. No <script> in inline mode. No javascript: URLs.
9. Keep each returned html under ~2500 characters. JSON must be complete and valid.
10. If the request is ambiguous ("make it nicer") and does not specify what to change, set pages to {} and explain in reply that you need a more specific instruction — do NOT invent a redesign.
11. When the admin asks to add/embed a video (or says they don't see the video), use a URL from mediaLibrary in the business context — do NOT ask them to paste a URL that is already listed there. Insert a <video controls><source src="URL" type="video/mp4"></video> block after the hero on "/".
${
  hasImages
    ? `12. ATTACHED IMAGES: the admin attached screenshot(s) or reference(s). Use them to understand the problem or target look. You cannot host those attached files on the site — only reuse https URLs already in the site/mediaLibrary. Describe visual issues from the attachments accurately before editing.`
    : ''
}`

  const userPrompt = `Surgical edit for "${opts.brandName}".

Admin request (apply ONLY this):
${opts.prompt || (hasImages ? 'See the attached image(s) — apply the implied fix or match the reference as closely as the existing design allows.' : 'No specific change requested — return an empty pages object and ask for clarification.')}

Existing custom site JSON (source of truth — preserve everything not explicitly changed):
${JSON.stringify(opts.base).slice(0, 70000)}

Existing page keys: ${pageKeys.join(', ') || '(none)'}

Business context (for accurate copy only — do not restyle from this). mediaLibrary lists uploaded CDN files — reuse those URLs when asked to add video/images:
${JSON.stringify(opts.context, null, 2)}`

  const parsed = await callModelJson({
    systemPrompt,
    userPrompt,
    temperature: 0.3,
    // Thinking tokens count against this cap — keep generous headroom.
    maxOutputTokens: 24576,
    images: opts.images,
  })

  const patch: SurgicalPatch = {
    globalCss:
      typeof parsed.globalCss === 'string'
        ? parsed.globalCss
        : parsed.globalCss === null
          ? null
          : undefined,
    pages:
      parsed.pages && typeof parsed.pages === 'object' && !Array.isArray(parsed.pages)
        ? (parsed.pages as SurgicalPatch['pages'])
        : {},
    unchangedPages: Array.isArray(parsed.unchangedPages)
      ? (parsed.unchangedPages as string[])
      : [],
    reply: typeof parsed.reply === 'string' ? parsed.reply : undefined,
  }

  // If the model "helpfully" returned every page with brand-new HTML when the
  // admin asked for text-only changes, strip pages whose HTML is wildly longer
  // than the base without an explicit design ask — keep only pages with modest diffs.
  let workingPatch = patch
  if (
    looksLikeTextOnlyRequest(opts.prompt) &&
    !looksLikeDesignRequest(opts.prompt) &&
    patch.pages &&
    Object.keys(patch.pages).length >= Math.max(2, pageKeys.length)
  ) {
    const filtered: NonNullable<SurgicalPatch['pages']> = {}
    for (const [path, pagePatch] of Object.entries(patch.pages)) {
      if (!pagePatch || typeof pagePatch.html !== 'string') continue
      const key = normalizeCustomPath(path)
      const baseHtml = opts.base.pages[key]?.html || ''
      const ratio =
        baseHtml.length > 0 ? pagePatch.html.length / baseHtml.length : 1
      // Keep if length stayed in a reasonable band (copy tweak) or title-only change.
      if (ratio >= 0.5 && ratio <= 1.6) {
        filtered[key] = pagePatch
      }
    }
    if (Object.keys(filtered).length > 0) {
      workingPatch = { ...patch, pages: filtered, globalCss: null }
    }
  }

  const { merged, changedPages } = mergeCustomPatch(opts.base, workingPatch)
  merged.mode = opts.mode

  const reply =
    (workingPatch.reply && workingPatch.reply.trim()) ||
    (changedPages.length
      ? `Updated ${changedPages.join(', ')} only. Everything else left as-is.`
      : 'No pages changed. Please specify exactly what text or element to edit.')

  const extraWarnings: string[] = []
  if (changedPages.length === 0) {
    extraWarnings.push('Surgical edit produced no page changes — draft unchanged from base.')
  }

  return {
    config: merged,
    reply,
    changedPages,
    extraWarnings,
  }
}

function parseModelJson(text: string): Record<string, unknown> {
  try {
    return JSON.parse(sanitizeJsonString(extractJson(text))) as Record<string, unknown>
  } catch {
    // Output was likely cut off mid-stream — repair (close open strings /
    // brackets) works on the raw text, not the extractJson slice, because
    // truncated output often has no final `}` for extractJson to find.
    return JSON.parse(sanitizeJsonString(repairTruncatedJson(text))) as Record<
      string,
      unknown
    >
  }
}

async function callModelJson(opts: {
  systemPrompt: string
  userPrompt: string
  temperature: number
  maxOutputTokens: number
  preferredProvider?: 'anthropic' | 'gemini'
  anthropicModel?: string
  images?: Array<{ mimeType: string; data: string }>
}): Promise<Record<string, unknown>> {
  let lastText = ''
  let lastParseErr: unknown = null

  // Attempt 1 as requested; attempt 2 retries colder with an explicit
  // validity nudge — recovers most transient bad-JSON generations.
  for (let attempt = 0; attempt < 2; attempt++) {
    let text: string
    try {
      const result = await generateTextWithFallback({
        prompt: opts.userPrompt,
        systemPrompt:
          attempt === 0
            ? opts.systemPrompt
            : `${opts.systemPrompt}\n\nIMPORTANT: Your previous attempt returned invalid/incomplete JSON. Respond with COMPLETE, strictly valid JSON only. Keep HTML/CSS compact so the response fits.`,
        jsonMode: true,
        temperature: attempt === 0 ? opts.temperature : 0.2,
        maxOutputTokens: opts.maxOutputTokens,
        preferredProvider: opts.preferredProvider,
        anthropicModel: opts.anthropicModel,
        images: opts.images,
      })
      text = result.text
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/GEMINI_API_KEY/i.test(msg)) {
        throw new Error('AI is not configured (missing GEMINI_API_KEY on the server).')
      }
      throw new Error(`AI generation failed: ${msg}`)
    }

    lastText = text
    try {
      return parseModelJson(text)
    } catch (err) {
      lastParseErr = err
      console.warn(
        `[generateCustomSite] attempt ${attempt + 1} returned unparseable JSON (${text.length} chars) — ${
          attempt === 0 ? 'retrying once' : 'giving up'
        }`
      )
    }
  }

  throw new Error(
    `Model returned unparseable/truncated JSON (${lastText.length} chars). Try a shorter, more specific prompt. ${
      lastParseErr instanceof Error ? lastParseErr.message : 'parse error'
    }`
  )
}

export async function publishCustomSiteDraft(tenantId: string): Promise<{
  warnings: string[]
  errors: string[]
  liveNow: boolean
}> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('site_configs')
    .select('custom_config_draft')
    .eq('tenant_id', tenantId)
    .single()

  if (error || !data) throw new Error('Site config not found')
  if (!isCustomSiteConfig(data.custom_config_draft)) {
    throw new Error('No custom draft to publish — generate one first.')
  }

  const sanitized = sanitizeCustomConfig(data.custom_config_draft)
  const check = validateCustomConfig(sanitized)
  if (!check.ok) {
    throw new Error(`Cannot publish: ${check.errors.join('; ')}`)
  }

  const { error: updateErr } = await supabase
    .from('site_configs')
    .update({
      custom_config: sanitized,
      render_mode: 'custom',
      custom_updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)

  if (updateErr) throw new Error(`Failed to publish: ${updateErr.message}`)

  const { revalidateTenantSiteCache } = await import('@/lib/tenants/revalidateTenantSite')
  const liveNow = await revalidateTenantSiteCache(tenantId)

  return { warnings: check.warnings, errors: [], liveNow }
}

export async function revertToEngine(tenantId: string): Promise<{ liveNow: boolean }> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('site_configs')
    .update({
      render_mode: 'engine',
      custom_updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)

  if (error) throw new Error(`Failed to revert: ${error.message}`)

  const { revalidateTenantSiteCache } = await import('@/lib/tenants/revalidateTenantSite')
  const liveNow = await revalidateTenantSiteCache(tenantId)
  return { liveNow }
}

export async function discardCustomDraft(tenantId: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('site_configs')
    .update({
      custom_config_draft: null,
      custom_updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
  if (error) throw new Error(`Failed to discard draft: ${error.message}`)
}
