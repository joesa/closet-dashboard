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

  if (intent === 'surgical' && base) {
    const mediaShortcut = await trySurgicalVideoShortcut({
      tenantId: opts.tenantId,
      prompt: opts.prompt || '',
      base,
    })
    if (mediaShortcut) return mediaShortcut
  }

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
}): Promise<{
  config: CustomSiteConfig
  reply: string
  changedPages: string[]
  extraWarnings: string[]
}> {
  // Full redesigns route to Claude Fable 5 (design quality); Gemini is the
  // fallback when no Anthropic key is configured.
  const useClaude = !!process.env.ANTHROPIC_API_KEY

  const systemPrompt = `You are a world-class UI/UX Design Architect and Brand Designer. You build bespoke, production-ready marketing websites for real local businesses as raw HTML + CSS. The result must read like a top independent design studio built it on a $1M budget — and must NEVER look AI-generated.

Run this layered pipeline INTERNALLY before writing any code. Do NOT output the analysis — only the final JSON.

1. PRODUCT UNDERSTANDING — Identify the business type, its real customers, what earns their trust, and the single conversion goal: the embedded engagement widget (quote / booking / order).
2. DESIGN FRAMEWORK SELECTION — Choose a specific design language that fits THIS business. Examples: premium local trade → warm editorial with strong photography; luxury service → cinematic minimalism, dark and quiet; modern studio → Swiss typography, grid-driven; heritage brand → classic serif editorial. Aim for the craft level of Stripe, Linear, Apple and high-end independent studios — but never dress a local service business as a SaaS product.
3. DESIGN TOKENS — Define the palette (background, ink, ONE signature accent drawn from the business's world), a full type scale (display / h1 / h2 / body / caption), a spacing scale (e.g. 8 / 16 / 24 / 40 / 64 / 96 / 128px), radii, borders, shadows. Emit them as CSS variables on :root in globalCss and use them everywhere.
4. LAYOUT & GRID — 12-column responsive grid, max-width container, generous whitespace, deliberate asymmetry. Clear hierarchy and varied section rhythm: full-bleed photo, split editorial, oversized type moment, quiet detail rows.
5. COMPONENT LIBRARY — Design once, reuse everywhere: header/nav, hero, service rows, process, gallery, CTA band, footer. Coherent across all pages.
6. PAGE ARCHITECTURE — Build EVERY page listed below using ALL the intake content in the business context (context.intakePages carries every section the client submitted: copy, images, service items). Rework the copy to be sharper, but do not drop the client's content or facts.
7. FINAL OUTPUT — the JSON below. Nothing else.

Output ONLY valid JSON matching this schema (no markdown fences):
{
  "mode": "${opts.mode}",
  "globalCss": "string — shared CSS (design tokens on :root + shared components)",
  "pages": {
    "/": { "html": "body HTML", "css": "optional page-specific CSS", "title": "SEO title", "description": "meta description" },
    "/about": { "html": "...", "title": "...", "description": "..." }
  },
  "reply": "3-5 sentences for the admin: the design direction you chose, palette, type pairing, and anything to review"
}

PLATFORM CONSTRAINTS (the renderer enforces these — violations get stripped and break the site):
- Pages: include EXACTLY these paths (no more, no fewer): ${opts.pageHints}. Always include "/".
- HTML is BODY CONTENT ONLY — no <html>/<head>/<body> wrappers. Semantic tags (header, nav, main, section, footer).
- STRIPPED BY SANITIZER: <script>, <iframe>, <object>, <embed>, <form>, all on* attributes, javascript: URLs. There is NO JavaScript. All interactivity must be pure CSS (:hover, :focus-within, details/summary accordions, CSS transitions, scroll-behavior).
- Because <form> is stripped: the contact page uses tel:/mailto: links, the address, hours, and the engagement widget — NEVER an HTML form.
- CSS is scoped to the site wrapper at render: selectors :root, html, body are rewritten to the wrapper, so define variables on :root and page background on body as usual. @import is stripped — do not use it. @media, @keyframes, @font-face are fine.
- FONTS: load Google Fonts by placing <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=...&display=swap"> as the FIRST element of EVERY page's html (each page is a separate document; @import will not work).
- ENGAGEMENT WIDGET: embed EXACTLY this HTML comment on the home page (literal characters, NO attributes):
  ${WIDGET_PLACEHOLDER}
  Place it inside the conversion section (e.g. "Get an estimate"), styled as a designed section of the page. You may also place one on the contact page. The mount must be transparent and flush: NEVER paint background, border, box-shadow, or heavy padding on the element containing the comment — the widget renders its own card.
- IMAGES: use ONLY https URLs that appear in the business context (services, intakePages sections, mediaLibrary). NEVER invent URLs, hotlink stock sites, or use placeholder services. When no image fits a section, design it typographically instead.
- Internal links are root-relative and must match the pages keys exactly. Every page gets the same header nav (with a current-page state) and the same designed footer with real contact details from context.
- Mobile-first responsive. Test your grid collapses cleanly at ~768px and ~420px.

ANTI-AI-LOOK RULES — the following are instant failures:
- Purple/indigo/teal SaaS gradients, glassmorphism, neon glows.
- Emoji as icons, icon-font glyphs, or ✓/★ characters as decoration.
- Three identical rounded cards with soft drop shadows repeated for every section.
- Center-aligning every block; identical padding on every section.
- Default typography (Inter, Poppins, Roboto, system-ui as the display face).
- Filler clichés: "Elevate your…", "Unlock", "Seamless", "Look no further", "We've got you covered", "Your one-stop shop".
- Invented testimonials, star ratings, review counts, statistics, awards, or "X years in business" — use ONLY facts present in the business context.
- Lorem ipsum or TODO placeholders anywhere.

INSTEAD, ALWAYS:
- Pair a characterful display face with a refined text face from Google Fonts (e.g. Fraunces, Instrument Serif, Libre Caslon Text, Newsreader, Bricolage Grotesque, Space Grotesk, Sora, Manrope — choose to fit THIS brand, vary between projects).
- Oversized editorial headlines with tight leading; body copy at a measured line length (~65ch).
- One signature accent used sparingly; neutrals sampled from the business's world (not pure #fff/#000 unless the direction calls for it).
- Large photography from the provided URLs; at least one full-bleed image moment.
- Varied section design, asymmetric splits, generous whitespace, and a properly designed footer (not an afterthought).

SIZE BUDGET (hard): globalCss ≤ 9000 chars. Home page html ≤ 11000 chars. Each other page html ≤ 7000 chars. Total response ≤ 48000 chars. The JSON MUST be complete and valid — finish every string you start.`

  const userPrompt = `Build a brand-new bespoke website for "${opts.brandName}".

Admin creative direction (optional):
${opts.prompt || 'No specific direction — choose the strongest design framework for this business and execute it at the highest level.'}

Business context (the client's real content — use all of it):
${JSON.stringify(opts.context, null, 2)}`

  const parsed = await callModelJson({
    systemPrompt,
    userPrompt,
    temperature: 0.7,
    // Claude streams up to this cap; Gemini counts hidden thinking tokens
    // against it, so both need generous headroom.
    maxOutputTokens: useClaude ? 60000 : 32768,
    preferredProvider: useClaude ? 'anthropic' : undefined,
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
    extraWarnings: [],
  }
}

async function runSurgicalGenerate(opts: {
  brandName: string
  prompt: string
  mode: 'inline' | 'iframe'
  base: CustomSiteConfig
  context: Record<string, unknown>
}): Promise<{
  config: CustomSiteConfig
  reply: string
  changedPages: string[]
  extraWarnings: string[]
}> {
  const pageKeys = Object.keys(opts.base.pages || {})
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
11. When the admin asks to add/embed a video (or says they don't see the video), use a URL from mediaLibrary in the business context — do NOT ask them to paste a URL that is already listed there. Insert a <video controls><source src="URL" type="video/mp4"></video> block after the hero on "/".`

  const userPrompt = `Surgical edit for "${opts.brandName}".

Admin request (apply ONLY this):
${opts.prompt || 'No specific change requested — return an empty pages object and ask for clarification.'}

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
