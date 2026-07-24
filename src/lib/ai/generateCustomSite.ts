import { parseAdminImageDataUrl } from '@/lib/adminImageAttach'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { generateTextWithFallback } from '@/lib/ai/aiTextProvider'
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
    mediaLibrary: mediaLibrary.slice(0, 40).map((a) => ({
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
      sections: blocks.slice(0, 10).map((b: Record<string, unknown>) => ({
        type: typeof b.type === 'string' ? b.type : 'text',
        heading: typeof b.heading === 'string' ? b.heading : '',
        body: typeof b.body === 'string' ? b.body.slice(0, 2000) : '',
        image: typeof b.image === 'string' ? b.image : undefined,
        images: Array.isArray(b.images)
          ? (b.images as unknown[])
              .filter((u): u is string => typeof u === 'string')
              .slice(0, 16)
          : undefined,
        items: Array.isArray(b.items)
          ? (b.items as Array<Record<string, unknown>>).slice(0, 12).map((it) => ({
              title: typeof it.title === 'string' ? it.title : '',
              description:
                typeof it.description === 'string' ? it.description.slice(0, 500) : '',
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

  const { error: updateErr } = await supabase
    .from('site_configs')
    .update({
      custom_config_draft: sanitized,
      custom_updated_at: new Date().toISOString(),
    })
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
}> {
  // Full redesigns route to Claude Fable 5 (design quality); Gemini is the
  // fallback when no Anthropic key is configured.
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

  const systemPrompt = `You are a world-class UI/UX Design Architect and Product Strategist. You generate production-ready, bespoke marketing websites as raw HTML + CSS for real local businesses. The result must read like a top independent design studio built it on a $1M budget — and must NEVER look AI-generated.

Whenever you receive a Full redesign request, follow this layered pipeline INTERNALLY before writing any code. Do NOT output the analysis — only the final site JSON.

1. PRODUCT UNDERSTANDING
   - Identify product type, target audience, goals, and key features from the business context.
   - The conversion goal is ALWAYS the embedded engagement engine (${engagementLabel}).
   - The service catalog from intake is FIXED — every listed service must appear on the site.

2. DESIGN FRAMEWORK SELECTION (creative direction)
   - If the admin provided a creative brief and/or reference images, that brief is the PRIMARY design direction. It may completely redirect the aesthetic (e.g. brutalist, Swiss editorial, cinematic luxury, heritage, industrial, coastal, etc.).
   - Absorb the brief into this pipeline: translate it into a concrete design language, tokens, grid, and components — do not ignore it, and do not treat it as optional flavor text.
   - If there is no brief, choose the strongest framework for THIS business (premium local trade → warm editorial; luxury → cinematic minimal; studio → Swiss/grid; heritage → classic serif editorial).
   - Craft bar: Stripe, Linear, Vercel, Notion, Apple, high-end independent studios — but never dress a local service business as a SaaS product unless the brief explicitly asks for that.

3. DESIGN SYSTEM / TOKENS
   - Colors (primary, secondary, accent, dark/light), typography scale, spacing, radius, shadows.
   - Emit as CSS variables on :root in globalCss and use them everywhere.

4. LAYOUT & GRID ARCHITECTURE
   - 12-column responsive grid, hero / features / services / conversion / footer.
   - Visual hierarchy, whitespace, mobile adjustments, varied section rhythm.

5. COMPONENT LIBRARY
   - Header/nav, hero, service rows/cards, process, gallery, CTA/conversion band (engagement engine mount), footer — designed once, reused coherently.

6. PAGE ARCHITECTURE
   - Build EVERY page in the required paths list.
   - Use ALL intake content (context.intakePages + context.services): sharpen copy, never drop services, facts, or client-submitted sections.
   - Home must include a designed conversion section that mounts the engagement engine.

7. FINAL OUTPUT — only the JSON schema below. Nothing else.

NON-NEGOTIABLE (override aesthetic freedom — the brief cannot remove these):
- SERVICES: include every intake service from context.services${
    services.length
      ? ` — specifically: ${services.join('; ')}`
      : ' (use whatever titles appear in context.services)'
  }. Feature them on home and dedicate real coverage on the services page (or equivalent). Do not invent extra services; do not drop any.
- ENGAGEMENT ENGINE: this site uses a "${engagementLabel}" (${engagementModel}). Embed EXACTLY this HTML comment on the home page (literal characters, NO attributes):
  ${WIDGET_PLACEHOLDER}
  Place it inside the designed conversion / estimate / book / order section. Optionally repeat on contact. The mount must be transparent and flush — NEVER paint background, border, box-shadow, or heavy padding on the element containing the comment (the widget paints its own card).
- INTAKE PAGES & COPY: ship EXACTLY these paths: ${opts.pageHints}. Preserve client facts from intakePages / about / seo; rewrite for sharpness, never invent testimonials/stats/awards.

${
  hasImages
    ? `ATTACHED REFERENCE IMAGES:
- Treat attached image(s) as part of the creative brief (moodboard, competitor, screenshot, or layout to imitate).
- Study palette, typography, spacing, hierarchy, and composition.
- Match the *feel* and craft — do NOT copy trademarks, logos, or proprietary artwork.
- When brief text and images conflict, prefer the combination that best serves THIS business while still honoring the non-negotiables above.`
    : ''
}

Output ONLY valid JSON matching this schema (no markdown fences):
{
  "mode": "${opts.mode}",
  "globalCss": "string — shared CSS (design tokens on :root + shared components)",
  "pages": {
    "/": { "html": "body HTML", "css": "optional page-specific CSS", "title": "SEO title", "description": "meta description" },
    "/about": { "html": "...", "title": "...", "description": "..." }
  },
  "reply": "3-5 sentences for the admin: how you interpreted their brief, the design direction, palette/type pairing, and confirmation that intake services + ${engagementLabel} are present"
}

PLATFORM CONSTRAINTS (the renderer enforces these — violations get stripped and break the site):
- HTML is BODY CONTENT ONLY — no <html>/<head>/<body> wrappers. Semantic tags (header, nav, main, section, footer).
- STRIPPED BY SANITIZER: <script>, <iframe>, <object>, <embed>, <form>, all on* attributes, javascript: URLs. There is NO JavaScript. All interactivity must be pure CSS (:hover, :focus-within, details/summary, CSS transitions, scroll-behavior).
- Contact uses tel:/mailto: + address/hours + engagement widget — NEVER an HTML form.
- CSS is scoped at render (:root/html/body → wrapper). No @import. @media, @keyframes, @font-face are fine.
- FONTS: <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=...&display=swap"> as the FIRST element of EVERY page's html.
- IMAGES: use ONLY https URLs from the business context (services, intakePages, mediaLibrary). Never invent URLs.
- Internal links are root-relative and must match page keys. Same header nav + designed footer with real contact details on every page.
- Mobile-first; collapses cleanly at ~768px and ~420px.

ANTI-AI-LOOK RULES — instant failures:
- Purple/indigo/teal SaaS gradients, glassmorphism, neon glows (unless the brief explicitly demands a related look — still avoid cliché AI defaults).
- Emoji as icons; three identical soft-shadow cards on every section; center-aligning everything.
- Default display faces (Inter, Poppins, Roboto, system-ui).
- Clichés: "Elevate your…", "Unlock", "Seamless", "Look no further", "We've got you covered", "Your one-stop shop".
- Invented testimonials, ratings, stats, awards, or years-in-business — only facts from context.
- Lorem ipsum or TODO placeholders.

INSTEAD, ALWAYS:
- Characterful Google Fonts pairing chosen for THIS brief/brand; oversized editorial headlines; ~65ch body measure.
- One signature accent; neutrals from the brand world; at least one full-bleed photo moment from provided URLs.
- Varied section rhythm, asymmetric splits, generous whitespace, designed footer.

SIZE BUDGET (hard): globalCss ≤ 9000 chars. Home html ≤ 11000 chars. Other pages ≤ 7000 chars each. Total ≤ 48000 chars. JSON must be complete and valid.`

  const userPrompt = `Full redesign for "${opts.brandName}".

=== CREATIVE BRIEF (absorb into the design pipeline — this may completely redirect the aesthetic) ===
${
  adminBrief
    ? adminBrief
    : hasImages
      ? 'No text brief — use the attached reference image(s) as the primary creative direction.'
      : 'No admin brief — choose the strongest design framework for this business and execute at the highest craft level.'
}
${hasImages ? `\nReference images attached: ${opts.images!.length}. Study them as part of the brief.\n` : ''}
=== NON-NEGOTIABLE PRODUCT FACTS (always keep, regardless of brief) ===
- Engagement engine: ${engagementLabel} (engagementModel="${engagementModel}") — mount ${WIDGET_PLACEHOLDER} on home conversion section.
- Intake services (must all appear): ${services.length ? services.join(' | ') : '(see context.services)'}
- Required pages: ${opts.pageHints}

=== BUSINESS CONTEXT (intake content, services, SEO, media — use all of it) ===
${JSON.stringify(opts.context, null, 2)}

Execute the layered pipeline. Enhance the creative brief into tokens, grid, components, and pages — then output only the final JSON.`

  const parsed = await callModelJson({
    systemPrompt,
    userPrompt,
    temperature: 0.7,
    // Claude streams up to this cap; Gemini counts hidden thinking tokens
    // against it, so both need generous headroom.
    maxOutputTokens: useClaude ? 60000 : 32768,
    preferredProvider: useClaude ? 'anthropic' : undefined,
    images: opts.images,
  })

  const config: CustomSiteConfig = {
    mode: parsed.mode === 'iframe' ? 'iframe' : 'inline',
    globalCss: typeof parsed.globalCss === 'string' ? parsed.globalCss : '',
    pages:
      parsed.pages && typeof parsed.pages === 'object' && !Array.isArray(parsed.pages)
        ? (parsed.pages as CustomSiteConfig['pages'])
        : {},
  }

  const reply =
    typeof parsed.reply === 'string' && parsed.reply.trim()
      ? parsed.reply.trim()
      : 'Custom draft generated. Preview it, then publish when ready.'

  return {
    config,
    reply,
    changedPages: Object.keys(config.pages),
    extraWarnings: hasBrief
      ? []
      : [
          'No creative brief or reference image was provided — design direction was chosen automatically from the business context.',
        ],
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
