import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  CLAUDE_SONNET_MODEL,
  generateTextWithFallback,
} from '@/lib/ai/aiTextProvider'
import {
  extractJson,
  repairTruncatedJson,
  sanitizeJsonString,
} from '@/lib/ai/generateSiteConfig'
import {
  THEME_SLUGS,
  LAYOUT_SLUGS,
  isThemeSlug,
  isLayoutSlug,
} from '@/lib/catalog/sitePresentationCatalog'
import { isForcedPreset } from '@/lib/catalog/designVariantCatalog'
import { validateTenantSite, saveValidationReport } from '@/lib/validation/siteValidator'
import { revalidateTenantSiteCache } from '@/lib/tenants/revalidateTenantSite'
import {
  applyVideoUrlToHomeDraft,
  appendAssetToDraftPage,
  ensureHomeVideoAfterHero,
} from '@/lib/customSiteAssets'
import { buildSiteContextPack } from '@/lib/ai/adminSiteChatContext'
import { mergeSiteChatColumn } from '@/lib/ai/mergeSiteChatChanges'
import {
  adminWantsAttachmentsOnSite,
  persistAssistantAttachments,
} from '@/lib/ai/persistAssistantAttachments'

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
  /** Columns written on this assistant turn (fed back into later turns). */
  applied?: string[]
  rejected?: Array<{ column: string; reason: string }>
  at?: string
  /** Set when loading durable history that had attachments (images not stored). */
  hadImages?: boolean
}

/** Max images forwarded to the model per request (newest messages win). */
const MAX_IMAGES = 4

/** Durable + in-request history window (enough for multi-step site edits). */
const MAX_HISTORY = 40
const MAX_STORED_HISTORY = 80

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
  /** CDN URLs for attachments persisted this turn (when uploaded for site use). */
  uploadedAssets?: Array<{ index: number; url: string }>
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
    shape: '{ headline: string (MAX 6 words), subheadline?: string, backgroundImage?: string(image url — JPG/PNG/WEBP only, never MP4/video) }',
    validate: (v) => {
      if (!v || typeof v !== 'object' || Array.isArray(v) || typeof (v as any).headline !== 'string') {
        return 'must be an object with a string headline'
      }
      const bg = (v as any).backgroundImage
      if (typeof bg === 'string' && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(bg)) {
        return 'backgroundImage cannot be a video file — use Custom Build / chat to place an MP4 after the hero'
      }
      return null
    },
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
      "[{ slug: string starting with '/', title: string, is_active: boolean, hero: { headline: string (MAX 6 words) }, content_blocks: [{ type: 'text'|'image_left'|'image_right'|'grid'|'gallery', heading, body, items?, images? }] }]",
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

const SYSTEM_PROMPT_INTRO = `You are the world's top notch designer and web engineer. You consult with all kinds of industries including healthcare, big tech companies, trading companies, top social media site, publish companies, to name a few, and you know the ins and outs of AWESOME bespoke designs and terrible ones. Ensure that any edits are completely free from any AI-ish tells and look like the client paid a $1 billionaire for it - designed by a top notch designer/software engineer and architect on the planet. You are the site-editing assistant inside the admin dashboard of a website platform for local service businesses. The admin chats with you about ONE specific tenant's live website. You can BOTH answer questions about the site AND directly change it.

You will receive:
1) identity + inventory for this site (hostnames, render mode, product titles, page slugs, nav)
2) the full editable site_configs columns as JSON
3) the conversation history for THIS site (including what you applied/rejected on prior turns)
4) optional attached images (screenshots / photos) — also listed under usableAttachments with permanent CDN URLs when they can be placed on the site

Messages with attachments are tagged like "[attached image #1]" and the images follow the text in the same order. Analyze attached images carefully before deciding what to change.

ATTACHED IMAGES — WHEN TO PLACE ON THE SITE:
- If usableAttachments[].placeOnSite is true (or the admin clearly asks to use/set/put/replace an image on the hero, a service, before/after, gallery, page block, etc.), you MUST use that attachment's CDN "url" in the appropriate config field (hero_config.backgroundImage, products_config[].image, before_after_config.beforeImage/afterImage, pages_config content_blocks[].image / items[].image / images[], etc.).
- Match "[attached image #N]" to usableAttachments[].index === N.
- If placeOnSite is false / the attachment is clearly a diagnostic screenshot ("see the problem", "look at this bug"), analyze it but do NOT place it on the site unless the admin also asks to use it as an asset.
- NEVER invent image URLs. Only use URLs already in the config OR urls listed in usableAttachments.

Respond with ONLY a JSON object of this exact shape:
{
  "reply": "your conversational answer to the admin — plain text, concise, describe what you changed or ask a clarifying question",
  "changes": { "<column_name>": <new value for that column>, ... }
}

RULES for "changes":
- Include a column ONLY when the admin's request requires changing it. Questions, opinions, and ambiguous requests get an empty "changes" object and a clarifying/informative "reply".
- Prefer MINIMAL patches. For large arrays (products_config, pages_config, nav_links), return ONLY the entries you are creating or editing — the server deep-merges by title/slug onto the live config. Do NOT dump the entire pages_config/products_config unless you are intentionally rewriting most of it.
- Keep the whole JSON response small enough to finish (aim under ~8k tokens of output). Never paste long HTML you did not change.
- When placing an attached image, set the image field to the exact usableAttachments CDN url for that index.
- Keep hero headlines (site hero and every page hero) to 6 words or fewer — longer headlines overflow the large-type designs.
- When adding a page to pages_config, also add a matching entry to nav_links if it should be reachable from the nav.
- Keep copy quality high: specific to this business and trade, no lorem ipsum, no placeholders.
- NEVER output spec-sheet metadata, artificial reference codes (e.g. "DOC: INQ-LOG", "REV: 2024", "REF: 01 / 02"), or code comment syntax ("//") on public site copy.
- Honor conversation history: if a prior turn already applied a change, build on the CURRENT config (which already includes it). Do not revert prior admin-approved edits unless asked.
- If the request is unsafe, out of scope (billing, deleting the site, custom code), or you cannot do it with the columns below, say so in "reply" and make no changes.
- IMPORTANT — /services cards are driven by products_config (short description on the card; details.longDescription + specifications in the drawer). Do NOT put full long service copy into pages_config grid items.
- IMPORTANT — some visible site text is NOT stored in the config; it is rendered from code and derived from "engagement_model". This includes: the nav CTA button ("Get Quote"/"Order Now"/"Book Now"/"Get Tickets"), the hero CTA label, the quote-section heading ("Get an Instant Quote"/"Order Online"/"Book Now"/"Get Tickets") and its intro sentence, and the quiz finish-screen CTA ("Get Your Instant Quote"/"Book Your Appointment"/"Order Now"/"Get Tickets"). To change these, set engagement_model to the right value for the business (medical/appointments -> 'booking', food/direct purchase -> 'order', events/admission -> 'ticket', estimates/leads -> 'quote'). If the admin asks to change text that does not appear anywhere in the config JSON and is not engagement-model-derived, say plainly that it is template copy requiring a code change — NEVER edit unrelated fields or claim success you cannot deliver.

Columns you may change (with required shapes):`

function buildSystemPrompt(context: ReturnType<typeof buildSiteContextPack>): string {
  const columnDocs = Object.entries(EDITABLE_COLUMNS)
    .map(([name, def]) => `- ${name}: ${def.shape}`)
    .join('\n')
  return `${SYSTEM_PROMPT_INTRO}\n${columnDocs}\n\n=== THIS SITE (identity + inventory) ===\n${JSON.stringify(
    {
      identity: context.identity,
      inventory: context.inventory,
      recentEdits: context.recentEdits,
      usableAttachments: context.usableAttachments || [],
    },
    null,
    1
  )}\n\n=== EDITABLE CONFIG (current live values) ===\n${JSON.stringify(context.editableConfig, null, 1)}`
}

export function extractReplyFromBrokenJson(text: string): string | null {
  const m = /"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(text || '')
  if (!m) return null
  try {
    return JSON.parse(`"${m[1]}"`)
  } catch {
    return m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"')
  }
}

type ParsedSiteChatJson =
  | { ok: true; reply?: unknown; changes?: unknown }
  | { ok: false }

/** Best-effort parse of model output into { reply, changes }. Never throws. */
export function parseSiteChatModelText(text: string): ParsedSiteChatJson {
  if (!text?.trim()) return { ok: false }
  const attempts = [
    () => JSON.parse(sanitizeJsonString(extractJson(text))),
    () => JSON.parse(sanitizeJsonString(repairTruncatedJson(text))),
    () => JSON.parse(sanitizeJsonString(repairTruncatedJson(extractJson(text)))),
  ]
  for (const attempt of attempts) {
    try {
      const parsed = attempt()
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { ok: true, ...(parsed as Record<string, unknown>) }
      }
    } catch {
      // try next strategy
    }
  }
  // Recover a reply even when changes JSON was truncated beyond repair.
  const replyOnly = extractReplyFromBrokenJson(text)
  if (replyOnly) return { ok: true, reply: replyOnly, changes: {} }
  return { ok: false }
}

/** Persistable history row (no large data-URL images). */
export type StoredChatMessage = {
  role: 'admin' | 'assistant'
  content: string
  applied?: string[]
  rejected?: Array<{ column: string; reason: string }>
  at: string
  hadImages?: boolean
}

function stripImagesForStorage(messages: ChatMessage[]): StoredChatMessage[] {
  return messages.map((m) => ({
    role: m.role,
    content: (m.content || '').slice(0, 8000),
    ...(m.applied?.length ? { applied: m.applied } : {}),
    ...(m.rejected?.length ? { rejected: m.rejected } : {}),
    at: m.at || new Date().toISOString(),
    ...(m.images?.length ? { hadImages: true } : {}),
  }))
}

export async function loadAssistantHistory(tenantId: string): Promise<StoredChatMessage[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('site_configs')
    .select('ai_assistant_history')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (error || !data) return []
  const raw = data.ai_assistant_history
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (m): m is StoredChatMessage =>
        !!m &&
        typeof m === 'object' &&
        ((m as any).role === 'admin' || (m as any).role === 'assistant') &&
        typeof (m as any).content === 'string'
    )
    .slice(-MAX_STORED_HISTORY)
}

async function saveAssistantHistory(tenantId: string, messages: StoredChatMessage[]): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('site_configs')
    .update({
      ai_assistant_history: messages.slice(-MAX_STORED_HISTORY),
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
  if (error) {
    console.warn('[adminSiteChat] failed to persist history:', error.message)
  }
}

/** Pull a public http(s) URL out of admin message text (video/image/file). */
function extractHttpUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s"'<>]+/i)
  if (!m) return null
  return m[0].replace(/[.,);]+$/, '')
}

function looksLikeVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url) || /\/video\//i.test(url)
}

function looksLikeImageUrl(url: string): boolean {
  return /\.(jpe?g|png|webp|gif|svg)(\?|$)/i.test(url)
}

/**
 * Intercept media/video requests before the template-column LLM.
 * Template engine cannot embed MP4s (hero backgrounds are images only).
 * Videos go into a Custom Build draft — bootstrapping one from brand/hero
 * fields when the tenant is still on the engine.
 */
async function tryMediaShortcut(
  tenantId: string,
  config: Record<string, unknown>,
  lastAdminMessage: string
): Promise<SiteChatResult | null> {
  const url = extractHttpUrl(lastAdminMessage)
  const hasCustom =
    config.render_mode === 'custom' ||
    !!(config.custom_config && typeof config.custom_config === 'object') ||
    !!(config.custom_config_draft && typeof config.custom_config_draft === 'object')

  const mentionsVideo = /\b(video|mp4|webm|testimonial)\b/i.test(lastAdminMessage)
  const wantsAddOrPlace =
    /\b(add|append|insert|put|embed|place|set|use|past|after)\b/i.test(lastAdminMessage) ||
    /\bhero\b/i.test(lastAdminMessage)

  // Never put an MP4 into hero_config.backgroundImage — that caused the black
  // broken-image screen. Intercept even without an explicit "video" word.
  if (url && looksLikeVideoUrl(url) && /\b(hero|background)\b/i.test(lastAdminMessage)) {
    const { bootstrapped } = await ensureHomeVideoAfterHero({ tenantId, videoUrl: url })
    const liveNow = await revalidateTenantSiteCache(tenantId)
    return {
      reply: bootstrapped
        ? 'Hero backgrounds only accept images (JPG/PNG/WEBP), not MP4 — that’s why you saw a black broken image. I created a Custom Build draft from this site’s brand/hero and placed your video in a real player right after the hero. Use Custom Build → Preview draft, then Publish draft when ready (publishing switches this site to custom render mode).'
        : 'Hero backgrounds only accept images, not MP4. I placed your video in a player after the hero in the Custom Build draft instead. Preview draft → Publish when ready.',
      applied: ['custom_config_draft'],
      rejected: [],
      liveNow,
    }
  }

  if (url && looksLikeVideoUrl(url) && (mentionsVideo || wantsAddOrPlace)) {
    const afterHero =
      /\b(past|after)\b/i.test(lastAdminMessage) ||
      /\bhero\b/i.test(lastAdminMessage) ||
      /\b(add|insert|embed|place|append)\b/i.test(lastAdminMessage)

    if (afterHero || !hasCustom) {
      const { bootstrapped } = await ensureHomeVideoAfterHero({ tenantId, videoUrl: url })
      const liveNow = await revalidateTenantSiteCache(tenantId)
      return {
        reply: bootstrapped
          ? 'Template sites can’t embed video players. I created a Custom Build draft (from this business’s brand/hero/services) and inserted your video after the hero. Open Custom Build → Preview draft, then Publish draft to go live.'
          : 'Inserted your video after the hero in the Custom Build draft. Preview draft → Publish when ready.',
        applied: ['custom_config_draft'],
        rejected: [],
        liveNow,
      }
    }

    await applyVideoUrlToHomeDraft(tenantId, url)
    const liveNow = await revalidateTenantSiteCache(tenantId)
    return {
      reply:
        'Updated the home page video source in the Custom Build draft. Preview draft → Publish when ready.',
      applied: ['custom_config_draft'],
      rejected: [],
      liveNow,
    }
  }

  const wantsAppendMedia =
    !!url &&
    /\b(add|append|insert|put)\b/i.test(lastAdminMessage) &&
    /\b(image|photo|file|pdf|link)\b/i.test(lastAdminMessage)

  if (wantsAppendMedia && url && hasCustom) {
    const kind = looksLikeImageUrl(url) ? 'image' : 'file'
    await appendAssetToDraftPage({
      tenantId,
      pagePath: '/',
      url,
      kind,
      label: url.split('/').pop() || 'Asset',
    })
    const liveNow = await revalidateTenantSiteCache(tenantId)
    return {
      reply: `Appended this ${kind} to the custom home page draft. Preview/publish from Custom Build.`,
      applied: ['custom_config_draft'],
      rejected: [],
      liveNow,
    }
  }

  // Custom site + generic HTML request → steer away from template-column chat.
  if (
    hasCustom &&
    (/\b(html|css|<video|custom (site|build|html)|source src)\b/i.test(lastAdminMessage) ||
      (url && /\b(set|change|update|put|use)\b/i.test(lastAdminMessage)))
  ) {
    return {
      reply:
        'This site uses Custom Build. For video/media: paste the CDN URL here (I’ll place it after the hero) or use Custom Build → Media & files. For copy/layout tweaks: Custom Build → Edit surgically.',
      applied: [],
      rejected: [],
      liveNow: false,
    }
  }

  return null
}

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

  const { data: domainRows } = await supabase
    .from('domains')
    .select('hostname, is_primary, source')
    .eq('tenant_id', tenantId)
  const hostnames = (domainRows || [])
    .map((d) => (typeof d.hostname === 'string' ? d.hostname.trim() : ''))
    .filter((h) => h && !h.endsWith('.localhost'))
  hostnames.sort((a, b) => {
    const aPrimary = domainRows?.find((d) => d.hostname === a)?.is_primary ? 0 : 1
    const bPrimary = domainRows?.find((d) => d.hostname === b)?.is_primary ? 0 : 1
    return aPrimary - bPrimary || a.localeCompare(b)
  })

  const lastAdminMsg = [...messages].reverse().find((m) => m.role === 'admin')
  const lastAdmin = lastAdminMsg?.content || ''

  // Persist this turn's attachments to CDN so they can be placed into config
  // when the admin wants them on the site (not only as visual references).
  const latestAttachmentRefs = (lastAdminMsg?.images || []).slice(0, MAX_IMAGES)
  const persistedAssets = latestAttachmentRefs.length
    ? await persistAssistantAttachments(tenantId, latestAttachmentRefs)
    : []
  const placeOnSite = adminWantsAttachmentsOnSite(lastAdmin)
  const usableAttachments = persistedAssets.map((a) => ({
    index: a.index,
    url: a.url,
    placeOnSite,
  }))
  const uploadedAssets = persistedAssets
    .filter((a) => a.uploaded)
    .map((a) => ({ index: a.index, url: a.url }))

  const shortcut = await tryMediaShortcut(tenantId, config, lastAdmin)
  if (shortcut) {
    // Still persist the turn so the next request has history.
    const stored = await loadAssistantHistory(tenantId)
    const now = new Date().toISOString()
    const nextHistory = [
      ...stored,
      ...stripImagesForStorage(
        messages.slice(-2).map((m) => ({ ...m, at: m.at || now }))
      ),
      {
        role: 'assistant' as const,
        content: shortcut.reply,
        applied: shortcut.applied,
        rejected: shortcut.rejected,
        at: now,
      },
    ].slice(-MAX_STORED_HISTORY)
    await saveAssistantHistory(tenantId, nextHistory)
    return shortcut
  }

  // Merge durable DB history with the request thread so refreshes / new tabs
  // still see prior site-specific decisions.
  const storedHistory = await loadAssistantHistory(tenantId)
  const requestTail = messages.slice(-MAX_HISTORY)
  const mergedForModel: ChatMessage[] = (() => {
    if (storedHistory.length === 0) return requestTail
    // Prefer the longer/richer thread ending with the same latest admin text.
    const latestAdmin = lastAdmin.trim()
    const storedTail = storedHistory.slice(-MAX_HISTORY)
    const storedEndsSame =
      storedTail.length > 0 &&
      storedTail[storedTail.length - 1]?.role === 'admin' &&
      storedTail[storedTail.length - 1]?.content?.trim() === latestAdmin
    if (storedEndsSame && storedTail.length >= requestTail.length) {
      // Request may include fresh images on the last admin message.
      const lastReq = requestTail[requestTail.length - 1]
      return [
        ...storedTail.slice(0, -1),
        {
          ...storedTail[storedTail.length - 1],
          images: lastReq?.images,
        },
      ]
    }
    // Concatenate stored history + new turns not already present.
    const seen = new Set(
      storedTail.map((m) => `${m.role}:${m.content.slice(0, 200)}:${m.at || ''}`)
    )
    const extras = requestTail.filter(
      (m) => !seen.has(`${m.role}:${m.content.slice(0, 200)}:${m.at || ''}`)
    )
    return [...storedTail, ...extras].slice(-MAX_HISTORY)
  })()

  const recentEdits = mergedForModel
    .filter((m) => m.role === 'assistant' && (m.applied?.length || m.rejected?.length))
    .slice(-8)
    .map((m) => ({
      at: m.at,
      applied: m.applied,
      rejected: m.rejected,
    }))

  const context = buildSiteContextPack({
    businessName: tenant.business_name || 'this business',
    hostnames,
    config,
    editableColumns: Object.keys(EDITABLE_COLUMNS),
    recentEdits,
    usableAttachments,
  })

  // Collect attached images newest-first (the latest screenshot is almost
  // always the one the admin is talking about), capped to keep the request
  // within the model's inline-data budget. Each image is referenced in the
  // transcript so the model knows which message it belongs to.
  const recent = mergedForModel.slice(-MAX_HISTORY)
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

  const assetLegend =
    usableAttachments.length > 0
      ? `\n\n[usableAttachments for this turn — ${
          placeOnSite
            ? 'PLACE ON SITE when the admin request says so'
            : 'reference/diagnostic unless admin asks to use on site'
        }]\n${usableAttachments
          .map((a) => `- image #${a.index}: ${a.url} (placeOnSite=${a.placeOnSite})`)
          .join('\n')}`
      : ''

  const transcript =
    recent
      .map((m) => {
        const indices = imageIndexByMessage.get(m)
        const tag = indices?.length
          ? ` [attached image${indices.length > 1 ? 's' : ''} ${indices.map((n) => `#${n}`).join(', ')}]`
          : ''
        const meta =
          m.role === 'assistant' && (m.applied?.length || m.rejected?.length)
            ? ` [applied: ${(m.applied || []).join(', ') || 'none'}${
                m.rejected?.length
                  ? `; rejected: ${m.rejected.map((r) => `${r.column} (${r.reason})`).join(', ')}`
                  : ''
              }]`
            : m.hadImages || m.images?.length
              ? ' [had attachments]'
              : ''
        return `${m.role === 'admin' ? 'Admin' : 'Assistant'}${tag}${meta}: ${m.content}`
      })
      .join('\n\n') + assetLegend

  const systemPrompt = buildSystemPrompt(context)
  const userPrompt = transcript || 'Admin: (no message)'

  let text = ''
  try {
    const first = await generateTextWithFallback({
      systemPrompt,
      prompt: userPrompt,
      jsonMode: true,
      temperature: 0.3,
      maxOutputTokens: 16384,
      images,
      preferredProvider: 'anthropic',
      anthropicModel: CLAUDE_SONNET_MODEL,
    })
    text = first.text
  } catch (err) {
    console.warn('[adminSiteChat] primary model failed, retrying Gemini:', err)
    const fallback = await generateTextWithFallback({
      systemPrompt,
      prompt: userPrompt,
      jsonMode: true,
      temperature: 0.3,
      maxOutputTokens: 16384,
      images,
      preferredProvider: 'gemini',
    })
    text = fallback.text
  }

  let parsed = parseSiteChatModelText(text)
  if (!parsed.ok && process.env.GEMINI_API_KEY) {
    console.warn(
      '[adminSiteChat] unparseable AI JSON — retrying Gemini. preview:',
      text.slice(0, 400).replace(/\s+/g, ' ')
    )
    try {
      const retry = await generateTextWithFallback({
        systemPrompt:
          systemPrompt +
          '\n\nCRITICAL: Respond with a single minified JSON object only. No markdown fences, no prose outside JSON.',
        prompt: userPrompt,
        jsonMode: true,
        temperature: 0.2,
        maxOutputTokens: 16384,
        images,
        preferredProvider: 'gemini',
      })
      parsed = parseSiteChatModelText(retry.text)
      if (!parsed.ok) {
        console.warn(
          '[adminSiteChat] Gemini retry also unparseable. preview:',
          retry.text.slice(0, 400).replace(/\s+/g, ' ')
        )
      }
    } catch (err) {
      console.warn('[adminSiteChat] Gemini retry failed:', err)
    }
  }

  // Never 500 the admin chat on model formatting issues — answer conversationally
  // with no config writes so the UI stays usable.
  if (!parsed.ok) {
    const softReply =
      extractReplyFromBrokenJson(text) ||
      text
        .replace(/```(?:json)?/gi, '')
        .replace(/```/g, '')
        .trim()
        .slice(0, 2000) ||
      'I understood the request but could not format a safe site update. Please try again with a shorter instruction (e.g. one page or one service at a time).'
    const nowSoft = new Date().toISOString()
    const newAdminTurns = stripImagesForStorage(
      messages.filter((m) => m.role === 'admin').slice(-1).map((m) => ({ ...m, at: nowSoft }))
    )
    const lastStored = storedHistory[storedHistory.length - 1]
    const adminToStore =
      lastStored?.role === 'admin' &&
      lastStored.content.trim() === newAdminTurns[0]?.content.trim()
        ? []
        : newAdminTurns
    await saveAssistantHistory(tenantId, [
      ...storedHistory,
      ...adminToStore,
      { role: 'assistant', content: softReply, at: nowSoft },
    ])
    return {
      reply: softReply,
      applied: [],
      rejected: [],
      liveNow: false,
      ...(uploadedAssets.length ? { uploadedAssets } : {}),
    }
  }
  const reply =
    typeof parsed.reply === 'string' && parsed.reply.trim()
      ? parsed.reply.trim()
      : extractReplyFromBrokenJson(text) || 'Done.'
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
    const merged = mergeSiteChatColumn(column, config[column], value, lastAdmin)
    const problem = def.validate(merged)
    if (problem) {
      rejected.push({ column, reason: problem })
      continue
    }
    update[column] = merged
    applied.push(column)
  }

  // Deterministic placement when the admin clearly asked to use an attachment
  // and the model forgot to reference the CDN URL in changes.
  let finalReply = reply
  if (placeOnSite && usableAttachments.length > 0) {
    const blob = JSON.stringify(update)
    const anyUsed = usableAttachments.some((a) => blob.includes(a.url))
    if (!anyUsed) {
      const first = usableAttachments[0]
      const wantsHero = /\bhero\b/i.test(lastAdmin) || /\bbackground\b/i.test(lastAdmin)
      const serviceMatch = lastAdmin.match(
        /\b(?:on|for|to)\s+([A-Z][\w &/-]{2,60})/i
      )
      if (wantsHero && EDITABLE_COLUMNS.hero_config) {
        const current =
          (update.hero_config as Record<string, unknown> | undefined) ||
          (isPlainHero(config.hero_config) ? { ...config.hero_config } : {})
        const next = { ...current, backgroundImage: first.url }
        const problem = EDITABLE_COLUMNS.hero_config.validate(next)
        if (!problem) {
          update.hero_config = next
          if (!applied.includes('hero_config')) applied.push('hero_config')
          finalReply = `${reply}\n\nPlaced attachment #${first.index} as the hero background.`.trim()
        }
      } else if (serviceMatch && Array.isArray(config.products_config)) {
        const needle = serviceMatch[1].trim().toLowerCase()
        const products = (
          (update.products_config as unknown[]) ||
          (config.products_config as unknown[])
        ).map((p) =>
          p && typeof p === 'object' ? { ...(p as Record<string, unknown>) } : p
        )
        let hit = false
        for (const p of products) {
          if (!p || typeof p !== 'object') continue
          const title = typeof (p as any).title === 'string' ? (p as any).title : ''
          if (title.toLowerCase().includes(needle) || needle.includes(title.toLowerCase())) {
            ;(p as any).image = first.url
            hit = true
            break
          }
        }
        if (hit) {
          const problem = EDITABLE_COLUMNS.products_config.validate(products)
          if (!problem) {
            update.products_config = products
            if (!applied.includes('products_config')) applied.push('products_config')
            finalReply =
              `${reply}\n\nPlaced attachment #${first.index} on the matching service image.`.trim()
          }
        }
      }
    }
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

  const now = new Date().toISOString()
  const assistantTurn: StoredChatMessage = {
    role: 'assistant',
    content: finalReply,
    ...(applied.length ? { applied } : {}),
    ...(rejected.length ? { rejected } : {}),
    at: now,
  }
  // Persist: previous stored + this request's new admin message(s) + assistant.
  const prior = storedHistory
  const newAdminTurns = stripImagesForStorage(
    messages.filter((m) => m.role === 'admin').slice(-1).map((m) => ({ ...m, at: now }))
  )
  // Avoid duplicating the same trailing admin message already stored.
  const lastStored = prior[prior.length - 1]
  const adminToStore =
    lastStored?.role === 'admin' &&
    lastStored.content.trim() === newAdminTurns[0]?.content.trim()
      ? []
      : newAdminTurns
  await saveAssistantHistory(tenantId, [...prior, ...adminToStore, assistantTurn])

  return {
    reply: finalReply,
    applied,
    rejected,
    liveNow,
    ...(uploadedAssets.length ? { uploadedAssets } : {}),
  }
}

function isPlainHero(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}
