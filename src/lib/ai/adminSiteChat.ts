import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { generateTextWithFallback } from '@/lib/ai/aiTextProvider'
import {
  THEME_SLUGS,
  LAYOUT_SLUGS,
  isThemeSlug,
  isLayoutSlug,
} from '@/lib/catalog/sitePresentationCatalog'
import { isForcedPreset } from '@/lib/catalog/designVariantCatalog'
import { validateTenantSite, saveValidationReport } from '@/lib/validation/siteValidator'
import { revalidateTenantSiteCache } from '@/lib/tenants/revalidateTenantSite'

/**
 * Admin AI site chat: the admin describes a change to a provisioned tenant
 * site in natural language ("shorten the hero headline", "add an FAQ page",
 * "rename the Deck Cleaning service to Deck & Fence Restoration") and the
 * model answers conversationally AND returns full replacement values for the
 * site_configs columns it wants to change. We validate each change against a
 * strict column allowlist + per-column shape checks, apply it, and kick off a
 * background re-validation so the admin's validation panel stays honest.
 */

export type ChatMessage = {
  role: 'admin' | 'assistant'
  content: string
  /** Optional attached images as `data:image/...;base64,...` URLs (screenshots
   *  of the site, reference designs, etc.) — forwarded to the model. */
  images?: string[]
}

/** Max images forwarded to the model per request (newest messages win). */
const MAX_IMAGES = 4

/** Parse a data URL into Gemini inline-data parts; returns null if invalid. */
function parseImageDataUrl(url: string): { mimeType: string; data: string } | null {
  const m = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(url)
  if (!m) return null
  return { mimeType: m[1], data: m[2] }
}

export type SiteChatResult = {
  reply: string
  /** Columns actually written to site_configs (empty = conversation only). */
  applied: string[]
  /** Changes the model proposed but we rejected, with reasons (for the UI). */
  rejected: Array<{ column: string; reason: string }>
  /** True when the tenant site's config cache was successfully busted, i.e.
   *  the change is visible on the live site right now (not within ≤60s). */
  liveNow: boolean
}

/** Columns the chat is allowed to modify, with a human shape description the
 *  model sees and a validator we trust. Everything else is rejected. */
const EDITABLE_COLUMNS: Record<
  string,
  { shape: string; validate: (v: unknown) => string | null }
> = {
  brand_name: {
    shape: 'string — the display name of the business',
    validate: (v) => (typeof v === 'string' && v.trim() ? null : 'must be a non-empty string'),
  },
  theme: {
    shape: `string — one of: ${THEME_SLUGS.join(', ')}`,
    validate: (v) => (typeof v === 'string' && isThemeSlug(v) ? null : 'not a valid theme slug'),
  },
  layout_style: {
    shape: `string — one of: ${LAYOUT_SLUGS.join(', ')}`,
    validate: (v) => (typeof v === 'string' && isLayoutSlug(v) ? null : 'not a valid layout slug'),
  },
  design_variant: {
    shape: 'string — a named studio preset id, or empty string for auto-seeded',
    validate: (v) =>
      typeof v === 'string' && (v === '' || isForcedPreset(v))
        ? null
        : 'not a known design variant preset id',
  },
  default_room: {
    shape: 'string — default room/service used by the quote calculator',
    validate: (v) => (typeof v === 'string' && v.trim() ? null : 'must be a non-empty string'),
  },
  engagement_model: {
    shape: "string — one of: 'quote', 'order', 'booking', 'ticket'",
    validate: (v) =>
      typeof v === 'string' && ['quote', 'order', 'booking', 'ticket'].includes(v)
        ? null
        : 'must be quote | order | booking | ticket',
  },
  hero_config: {
    shape: '{ headline: string (MAX 6 words), subheadline?: string, backgroundImage?: string(url) }',
    validate: (v) =>
      v && typeof v === 'object' && !Array.isArray(v) && typeof (v as any).headline === 'string'
        ? null
        : 'must be an object with a string headline',
  },
  about_config: {
    shape: '{ description: string }',
    validate: (v) =>
      v && typeof v === 'object' && !Array.isArray(v) ? null : 'must be an object',
  },
  process_config: {
    shape:
      "{ title: string, subtitle: string, steps: [{ number: '01'|'02'|'03', title: string, description: string }] } — steps MUST be exactly 3, numbered '01','02','03' in order",
    validate: (v) => {
      if (!v || typeof v !== 'object' || Array.isArray(v)) return 'must be an object'
      const steps = (v as any).steps
      if (!Array.isArray(steps) || steps.length !== 3) return 'steps must be exactly 3 entries'
      const ok = ['01', '02', '03'].every((n, i) => steps[i]?.number === n)
      return ok ? null : "steps must be numbered '01','02','03' in order"
    },
  },
  products_config: {
    shape:
      '[{ title: string, description: string, image: string(url), details?: { subtitle, longDescription, specifications } }] — one entry per service; keep existing image URLs unless asked to change them',
    validate: (v) =>
      Array.isArray(v) && v.every((p) => p && typeof p === 'object' && typeof p.title === 'string')
        ? null
        : 'must be an array of objects with string titles',
  },
  seo_config: {
    shape:
      '{ legalName, email, phone, streetAddress, addressLocality, addressRegion, postalCode, geo }',
    validate: (v) =>
      v && typeof v === 'object' && !Array.isArray(v) ? null : 'must be an object',
  },
  before_after_config: {
    shape:
      '{ beforeImage: string(url), afterImage: string(url), title: string, subtitle: string } or null to remove the section',
    validate: (v) =>
      v === null || (v && typeof v === 'object' && !Array.isArray(v)) ? null : 'must be an object or null',
  },
  quiz_config: {
    shape: '{ eyebrow, headline, questions: [{ id, title, options: [{ id, label }] }] } or null',
    validate: (v) =>
      v === null || (v && typeof v === 'object' && !Array.isArray(v)) ? null : 'must be an object or null',
  },
  nav_links: {
    shape:
      "[{ label: string, slug: string starting with '/' }] — must only link to slugs that exist in pages_config (plus '/')",
    validate: (v) =>
      Array.isArray(v) &&
      v.every(
        (l) =>
          l &&
          typeof l === 'object' &&
          typeof l.label === 'string' &&
          typeof l.slug === 'string' &&
          l.slug.startsWith('/')
      )
        ? null
        : "must be an array of { label, slug } with slugs starting with '/'",
  },
  pages_config: {
    shape:
      "[{ slug: string starting with '/', title: string, is_active: boolean, hero: { headline: string (MAX 6 words) }, content_blocks: [{ type: 'text'|'image_left'|'image_right'|'grid', heading, body, items? }] }]",
    validate: (v) =>
      Array.isArray(v) &&
      v.every(
        (p) =>
          p &&
          typeof p === 'object' &&
          typeof p.slug === 'string' &&
          p.slug.startsWith('/') &&
          typeof p.title === 'string'
      )
        ? null
        : 'must be an array of page objects with slug + title',
  },
}

const SYSTEM_PROMPT_INTRO = `You are the site-editing assistant inside the admin dashboard of a website platform for local service businesses. The admin chats with you about a specific tenant's live website. You can BOTH answer questions about the site AND directly change it.

You will receive the tenant's current site configuration as JSON (the "site_configs" database row) and the conversation so far. The admin may also attach images — screenshots of the live site showing a problem, reference designs to imitate, or photos to describe what they want. Messages with attachments are tagged like "[attached image #1]" and the images follow the text in the same order. Analyze attached images carefully to understand the visual context of the request (e.g. which section a screenshot shows, what copy is wrong, what an overlap or layout issue implies) before deciding what to change. You cannot save or reuse attached images as site assets — if the admin wants an attached photo ON the site, explain that images are uploaded/generated through the image tools, not chat.

Respond with ONLY a JSON object of this exact shape:
{
  "reply": "your conversational answer to the admin — plain text, concise, describe what you changed or ask a clarifying question",
  "changes": { "<column_name>": <complete new value for that column>, ... }
}

RULES for "changes":
- Include a column ONLY when the admin's request requires changing it. Questions, opinions, and ambiguous requests get an empty "changes" object and a clarifying/informative "reply".
- Every included column must contain the COMPLETE new value for that column — copy all parts of the current value you are not changing. Never send partial objects or diffs.
- NEVER invent image URLs. Reuse image URLs already present in the config. If the admin asks for a new image, explain in "reply" that images are generated through the image tools, not chat.
- Keep hero headlines (site hero and every page hero) to 6 words or fewer — longer headlines overflow the large-type designs.
- When adding a page to pages_config, also add a matching entry to nav_links if it should be reachable from the nav.
- Keep copy quality high: specific to this business and trade, no lorem ipsum, no placeholders.
- If the request is unsafe, out of scope (billing, deleting the site, custom code), or you cannot do it with the columns below, say so in "reply" and make no changes.
- IMPORTANT — some visible site text is NOT stored in the config; it is rendered from code and derived from "engagement_model". This includes: the nav CTA button ("Get Quote"/"Order Now"/"Book Now"/"Get Tickets"), the hero CTA label, the quote-section heading ("Get an Instant Quote"/"Order Online"/"Book Now"/"Get Tickets") and its intro sentence, and the quiz finish-screen CTA ("Get Your Instant Quote"/"Book Your Appointment"/"Order Now"/"Get Tickets"). To change these, set engagement_model to the right value for the business (medical/appointments -> 'booking', food/direct purchase -> 'order', events/admission -> 'ticket', estimates/leads -> 'quote'). If the admin asks to change text that does not appear anywhere in the config JSON and is not engagement-model-derived, say plainly that it is template copy requiring a code change — NEVER edit unrelated fields or claim success you cannot deliver.

Columns you may change (with required shapes):`

function buildSystemPrompt(config: Record<string, unknown>, businessName: string): string {
  const columnDocs = Object.entries(EDITABLE_COLUMNS)
    .map(([name, def]) => `- ${name}: ${def.shape}`)
    .join('\n')
  return `${SYSTEM_PROMPT_INTRO}\n${columnDocs}\n\nBusiness: ${businessName}\n\nCurrent site configuration JSON:\n${JSON.stringify(config, null, 1)}`
}

const MAX_HISTORY = 16

export async function runAdminSiteChat(
  tenantId: string,
  messages: ChatMessage[]
): Promise<SiteChatResult> {
  const supabase = getSupabaseAdmin()

  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('id, business_name, site_configs (*)')
    .eq('id', tenantId)
    .maybeSingle()
  if (error || !tenant) {
    throw new Error(`Could not load tenant ${tenantId}: ${error?.message || 'not found'}`)
  }
  const config = (Array.isArray(tenant.site_configs)
    ? tenant.site_configs[0]
    : tenant.site_configs) as Record<string, unknown> | null
  if (!config) {
    throw new Error('This tenant has no site configuration to edit.')
  }

  // Only show the model columns it may edit (plus nothing internal like ids).
  const visibleConfig: Record<string, unknown> = {}
  for (const col of Object.keys(EDITABLE_COLUMNS)) {
    if (col in config) visibleConfig[col] = config[col]
  }

  // Collect attached images newest-first (the latest screenshot is almost
  // always the one the admin is talking about), capped to keep the request
  // within the model's inline-data budget. Each image is referenced in the
  // transcript so the model knows which message it belongs to.
  const recent = messages.slice(-MAX_HISTORY)
  const images: Array<{ mimeType: string; data: string }> = []
  const imageIndexByMessage = new Map<ChatMessage, number[]>()
  for (let i = recent.length - 1; i >= 0 && images.length < MAX_IMAGES; i--) {
    const msg = recent[i]
    if (!msg.images?.length) continue
    const indices: number[] = []
    for (const url of msg.images) {
      if (images.length >= MAX_IMAGES) break
      const parsed = parseImageDataUrl(url)
      if (!parsed) continue
      images.push(parsed)
      indices.push(images.length) // 1-based, in the order attached to the request
    }
    if (indices.length) imageIndexByMessage.set(msg, indices)
  }

  const transcript = recent
    .map((m) => {
      const indices = imageIndexByMessage.get(m)
      const tag = indices?.length
        ? ` [attached image${indices.length > 1 ? 's' : ''} ${indices.map((n) => `#${n}`).join(', ')}]`
        : ''
      return `${m.role === 'admin' ? 'Admin' : 'Assistant'}${tag}: ${m.content}`
    })
    .join('\n\n')

  const { text } = await generateTextWithFallback({
    systemPrompt: buildSystemPrompt(visibleConfig, tenant.business_name || 'this business'),
    prompt: transcript || 'Admin: (no message)',
    jsonMode: true,
    temperature: 0.4,
    maxOutputTokens: 32768,
    images,
  })

  let parsed: { reply?: unknown; changes?: unknown }
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('The AI returned an unparseable response — please try again.')
  }
  const reply =
    typeof parsed.reply === 'string' && parsed.reply.trim()
      ? parsed.reply.trim()
      : 'Done.'
  const changes =
    parsed.changes && typeof parsed.changes === 'object' && !Array.isArray(parsed.changes)
      ? (parsed.changes as Record<string, unknown>)
      : {}

  const update: Record<string, unknown> = {}
  const applied: string[] = []
  const rejected: Array<{ column: string; reason: string }> = []

  for (const [column, value] of Object.entries(changes)) {
    const def = EDITABLE_COLUMNS[column]
    if (!def) {
      rejected.push({ column, reason: 'not an editable column' })
      continue
    }
    const problem = def.validate(value)
    if (problem) {
      rejected.push({ column, reason: problem })
      continue
    }
    update[column] = value
    applied.push(column)
  }

  let liveNow = false
  if (applied.length > 0) {
    update.updated_at = new Date().toISOString()
    const { error: updateErr } = await supabase
      .from('site_configs')
      .update(update)
      .eq('tenant_id', tenantId)
    if (updateErr) {
      throw new Error(`Failed to save changes: ${updateErr.message}`)
    }

    // Bust the tenant site's per-hostname config cache so the change is
    // visible on the very next page load, not after the ≤60s revalidation
    // window. Best-effort — the site self-heals within 60s either way.
    liveNow = await revalidateTenantSiteCache(tenantId)

    // Re-validate in the background so the admin's validation panel reflects
    // the new config without making the chat wait on a live crawl.
    void validateTenantSite(tenantId)
      .then((report) => saveValidationReport(tenantId, report))
      .catch((err) => console.warn('[adminSiteChat] post-change validation failed:', err))
  }

  return { reply, applied, rejected, liveNow }
}
