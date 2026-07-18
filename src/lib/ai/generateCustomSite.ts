import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { generateTextWithFallback } from '@/lib/ai/aiTextProvider'
import { extractJson, sanitizeJsonString } from '@/lib/ai/generateSiteConfig'
import {
  isCustomSiteConfig,
  normalizeCustomPath,
  sanitizeCustomConfig,
  validateCustomConfig,
  WIDGET_PLACEHOLDER,
  type CustomPageArtifact,
  type CustomSiteConfig,
} from '@/lib/customSite'

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
  if (
    home.html.includes(WIDGET_PLACEHOLDER) ||
    /<closet-quote-widget\b/i.test(home.html)
  ) {
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
      'No custom site to edit yet — use “Generate from scratch” first, then surgical edits.'
    )
  }

  const mode = opts.mode || base?.mode || 'inline'
  const products = Array.isArray(cfg.products_config) ? cfg.products_config : []
  const pagesConfig = Array.isArray(cfg.pages_config) ? cfg.pages_config : []
  const seo = (cfg.seo_config || {}) as Record<string, unknown>
  const brandName = (cfg.brand_name || tenant.business_name || 'Business') as string

  const requestedSlugs = pagesConfig
    .map((p: { slug?: string }) => (typeof p.slug === 'string' ? p.slug : ''))
    .filter(Boolean)
    .slice(0, 3)
  const pageHints =
    requestedSlugs.length > 0
      ? ['/', ...requestedSlugs.map((s: string) => (s.startsWith('/') ? s : `/${s}`))]
          .filter((v, i, a) => a.indexOf(v) === i)
          .slice(0, 4)
          .join(', ')
      : '/, /about, /services, /contact'

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
  }

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
          context,
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

  return {
    draft: sanitized,
    warnings,
    errors: check.errors,
    reply: result.reply,
    intent,
    changedPages: result.changedPages,
  }
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
  const systemPrompt = `You are an expert web designer building a COMPLETE custom marketing website from scratch as raw HTML + CSS.

Output ONLY valid JSON matching this schema (no markdown fences):
{
  "mode": "${opts.mode}",
  "globalCss": "string — shared CSS for the whole site (keep under ~4KB)",
  "pages": {
    "/": { "html": "string — body HTML for home", "css": "optional page CSS", "title": "page title", "description": "meta description" },
    "/about": { "html": "...", "title": "..." }
  },
  "reply": "2-4 sentence summary of what you built for the admin"
}

Hard rules:
1. Generate a DISTINCT, bespoke design — NOT a clone of a generic template. Unique layout, typography, color palette for THIS business.
2. Include EXACTLY these pages (no more): ${opts.pageHints}. Always include "/".
3. HTML is BODY CONTENT ONLY (no <html>/<head>/<body> wrappers). Use semantic tags (header, nav, main, section, footer).
4. Embed exactly this widget placeholder somewhere on the home page so the live quote calculator mounts:
   ${WIDGET_PLACEHOLDER}
5. Use absolute https:// image URLs when referencing images (prefer ones already on the site if provided in context). Do not invent broken localhost URLs.
6. CSS must be self-contained. No @import. Prefer CSS variables for the palette.
7. mode="${opts.mode}" — ${
    opts.mode === 'inline'
      ? 'INLINE mode: NO <script> tags, NO onclick/on* handlers, NO javascript: URLs.'
      : 'IFRAME mode: scripts allowed but prefer progressive enhancement; keep the widget placeholder.'
  }
8. Internal links must be root-relative paths that match your pages keys.
9. Make it mobile-responsive.
10. CRITICAL SIZE LIMIT: keep each page html under ~2500 characters and globalCss under ~4000 characters. The JSON MUST be complete and valid.`

  const userPrompt = `Build a brand-new custom website from scratch for "${opts.brandName}".

Admin request / creative direction:
${opts.prompt || 'Create a distinctive, conversion-focused marketing site that feels unique to this business.'}

Business context:
${JSON.stringify(opts.context, null, 2)}`

  const parsed = await callModelJson({
    systemPrompt,
    userPrompt,
    temperature: 0.7,
    maxOutputTokens: 8192,
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
10. If the request is ambiguous ("make it nicer") and does not specify what to change, set pages to {} and explain in reply that you need a more specific instruction — do NOT invent a redesign.`

  const userPrompt = `Surgical edit for "${opts.brandName}".

Admin request (apply ONLY this):
${opts.prompt || 'No specific change requested — return an empty pages object and ask for clarification.'}

Existing custom site JSON (source of truth — preserve everything not explicitly changed):
${JSON.stringify(opts.base).slice(0, 70000)}

Existing page keys: ${pageKeys.join(', ') || '(none)'}

Business context (for accurate copy only — do not restyle from this):
${JSON.stringify(opts.context, null, 2)}`

  const parsed = await callModelJson({
    systemPrompt,
    userPrompt,
    temperature: 0.3,
    maxOutputTokens: 6144,
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

async function callModelJson(opts: {
  systemPrompt: string
  userPrompt: string
  temperature: number
  maxOutputTokens: number
}): Promise<Record<string, unknown>> {
  let text: string
  try {
    const result = await generateTextWithFallback({
      prompt: opts.userPrompt,
      systemPrompt: opts.systemPrompt,
      jsonMode: true,
      temperature: opts.temperature,
      maxOutputTokens: opts.maxOutputTokens,
    })
    text = result.text
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/GEMINI_API_KEY/i.test(msg)) {
      throw new Error('AI is not configured (missing GEMINI_API_KEY on the server).')
    }
    throw new Error(`AI generation failed: ${msg}`)
  }

  try {
    return JSON.parse(sanitizeJsonString(extractJson(text))) as Record<string, unknown>
  } catch (err) {
    throw new Error(
      `Model returned unparseable/truncated JSON (${text.length} chars). Try a shorter, more specific prompt. ${
        err instanceof Error ? err.message : 'parse error'
      }`
    )
  }
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
