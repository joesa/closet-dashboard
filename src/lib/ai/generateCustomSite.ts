import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { generateTextWithFallback } from '@/lib/ai/aiTextProvider'
import { extractJson, sanitizeJsonString } from '@/lib/ai/generateSiteConfig'
import {
  isCustomSiteConfig,
  sanitizeCustomConfig,
  validateCustomConfig,
  WIDGET_PLACEHOLDER,
  type CustomSiteConfig,
} from '@/lib/customSite'

export type GenerateCustomSiteResult = {
  draft: CustomSiteConfig
  warnings: string[]
  errors: string[]
  reply: string
}

/**
 * AI-builds (or iterates) a full custom HTML/CSS site into custom_config_draft.
 * Never touches render_mode or custom_config (published) — publish is a
 * separate admin action.
 */
export async function generateCustomSiteDraft(opts: {
  tenantId: string
  prompt: string
  mode?: 'inline' | 'iframe'
  /** When true, iterate on the existing draft instead of starting from scratch. */
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
        custom_config_draft
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

  const mode = opts.mode || existingDraft?.mode || 'inline'
  const products = Array.isArray(cfg.products_config) ? cfg.products_config : []
  const pagesConfig = Array.isArray(cfg.pages_config) ? cfg.pages_config : []
  const seo = (cfg.seo_config || {}) as Record<string, unknown>
  const brandName = (cfg.brand_name || tenant.business_name || 'Business') as string

  const pageHints =
    pagesConfig.length > 0
      ? pagesConfig.map((p: { slug?: string; title?: string }) => p.slug || p.title).join(', ')
      : '/, /about, /services, /contact'

  const systemPrompt = `You are an expert web designer building a COMPLETE custom marketing website from scratch as raw HTML + CSS.

Output ONLY valid JSON matching this schema (no markdown fences):
{
  "mode": "${mode}",
  "globalCss": "string — shared CSS for the whole site",
  "pages": {
    "/": { "html": "string — body HTML for home", "css": "optional page CSS", "title": "page title", "description": "meta description" },
    "/about": { "html": "...", "title": "..." }
  },
  "reply": "2-4 sentence summary of what you built for the admin"
}

Hard rules:
1. Generate a DISTINCT, bespoke design — NOT a clone of a generic template. Unique layout, typography, color palette for THIS business.
2. Include pages for at least: ${pageHints}. Always include "/".
3. HTML is BODY CONTENT ONLY (no <html>/<head>/<body> wrappers). Use semantic tags (header, nav, main, section, footer).
4. Embed exactly this widget placeholder somewhere on the home page (and optionally contact) so the live quote calculator mounts:
   ${WIDGET_PLACEHOLDER}
5. Use absolute https:// image URLs when referencing images (prefer ones already on the site if provided in context). Do not invent broken localhost URLs.
6. CSS must be self-contained. No @import. Prefer CSS variables for the palette.
7. mode="${mode}" — ${
    mode === 'inline'
      ? 'INLINE mode: NO <script> tags, NO onclick/on* handlers, NO javascript: URLs. Interactive bits are limited to CSS :hover and the widget placeholder.'
      : 'IFRAME mode: scripts are allowed but prefer progressive enhancement; keep the widget placeholder.'
  }
8. Internal links must be root-relative paths that match your pages keys (e.g. href="/services").
9. Make it mobile-responsive.
10. Keep total JSON under a practical size — aim for polished but not novel-length copy.`

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
    existingDraftSummary: existingDraft
      ? {
          mode: existingDraft.mode,
          pageKeys: Object.keys(existingDraft.pages || {}),
        }
      : null,
  }

  const userPrompt = opts.iterate && existingDraft
    ? `Iterate on the existing custom draft for "${brandName}".

Admin request:
${opts.prompt}

Current draft JSON (edit/improve; keep pages the admin didn't ask to remove unless asked):
${JSON.stringify(existingDraft).slice(0, 60000)}

Business context:
${JSON.stringify(context, null, 2)}`
    : `Build a brand-new custom website from scratch for "${brandName}".

Admin request / creative direction:
${opts.prompt || 'Create a distinctive, conversion-focused marketing site that feels unique to this business.'}

Business context:
${JSON.stringify(context, null, 2)}`

  const { text } = await generateTextWithFallback({
    prompt: userPrompt,
    systemPrompt,
    jsonMode: true,
    temperature: 0.85,
    maxOutputTokens: 16384,
  })

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(sanitizeJsonString(extractJson(text))) as Record<string, unknown>
  } catch (err) {
    throw new Error(
      `Model returned unparseable JSON: ${err instanceof Error ? err.message : 'parse error'}`
    )
  }

  const reply =
    typeof parsed.reply === 'string' && parsed.reply.trim()
      ? parsed.reply.trim()
      : 'Custom draft generated. Preview it, then publish when ready.'

  const candidate: CustomSiteConfig = {
    mode: parsed.mode === 'iframe' ? 'iframe' : 'inline',
    globalCss: typeof parsed.globalCss === 'string' ? parsed.globalCss : '',
    pages:
      parsed.pages && typeof parsed.pages === 'object' && !Array.isArray(parsed.pages)
        ? (parsed.pages as CustomSiteConfig['pages'])
        : {},
  }

  // If the model omitted the widget placeholder, inject it at the end of "/".
  const home = candidate.pages['/'] || candidate.pages['']
  if (home && !home.html.includes(WIDGET_PLACEHOLDER) && !/<closet-quote-widget\b/i.test(home.html)) {
    home.html = `${home.html}\n<section class="closet-widget-slot">${WIDGET_PLACEHOLDER}</section>`
    candidate.pages['/'] = home
  }

  const sanitized = sanitizeCustomConfig(candidate)
  const check = validateCustomConfig(sanitized)
  if (!check.ok) {
    // Still save the draft so the admin can iterate — surface errors.
    console.warn('[generateCustomSite] validation errors:', check.errors)
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
    warnings: check.warnings,
    errors: check.errors,
    reply,
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
