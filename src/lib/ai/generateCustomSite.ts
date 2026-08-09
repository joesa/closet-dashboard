import { hydrateAdminImagesForModel } from '@/lib/ai/hydrateAdminImages'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  CLAUDE_SONNET_MODEL,
  configuredSurgicalProviders,
  generateTextWithFallback,
} from '@/lib/ai/aiTextProvider'
import {
  applyContactReplacePlan,
  looksLikeContactSurgicalRequest,
  parseContactSurgicalRequest,
  type SeoContactFields,
} from '@/lib/ai/surgicalContactReplace'
import {
  applySurgicalIntegrityRepairs,
  assertSurgicalIntegrity,
  ensureClickableCardCss,
  looksLikeClickableCardsRequest,
  looksLikeExplicitGlobalRestyle,
  makeServiceCardsClickable,
  mergeSurgicalGlobalCss,
} from '@/lib/ai/surgicalIntegrity'
import {
  ensureServiceDrawerCss,
  looksLikeServiceDrawerRequest,
  wireServiceCardDrawers,
} from '@/lib/ai/surgicalServiceDrawer'
import {
  ensureImageLightboxCss,
  lightboxPriorityPaths,
  looksLikeImageLightboxRequest,
  wireImageLightboxes,
} from '@/lib/ai/surgicalImageLightbox'
import {
  classifySurgicalIntent,
  looksLikeHeroImageSurgicalRequest,
  looksLikeVideoSurgicalRequest,
} from '@/lib/ai/surgicalIntent'
import {
  applyOpsToConfig,
  buildPageDigest,
  parseSurgicalOps,
} from '@/lib/ai/surgicalDomOps'
import { HUMAN_COPY_VOICE_RULES_SURGICAL } from '@/lib/ai/humanCopyVoice'
import {
  buildIntakeHintsForBrief,
  enhanceFullRedesignBrief,
  fallbackEnhancedBrief,
  type EnhancedFullRedesignBrief,
} from '@/lib/ai/enhanceFullRedesignBrief'
import type { CustomBuildLockedBrief } from '@/lib/ai/customBuildJob'
import {
  activatePagesConfigForDraftPaths,
  applyPathAliasesToCustomConfig,
  assertFullRedesignPagesComplete,
  buildFullRedesignRequiredPaths,
  dropEmptyCustomPages,
  isUsableCustomPageHtml,
} from '@/lib/ai/fullRedesignPages'
import {
  emptyFullRedesignDraft,
  extractChromeSample,
  finalizeFullRedesignDraft,
  mergePageIntoDraft,
  passesDoneFromDraft,
  remainingFullRedesignPaths,
} from '@/lib/ai/fullRedesignMultiPass'
import {
  extractServicesNamedInBrief,
  htmlMentionsService,
  injectMissingServicesIntoHtml,
} from '@/lib/ai/extractBriefServices'
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
import { generateBriefServiceImages } from '@/lib/ai/generateBriefServiceImages'
import {
  applyBriefServiceImagesToCustomHtml,
  applyImagesToProducts,
  appendImagesToPagesConfigGallery,
  buildBriefServiceImageNotes,
  buildInventedRedesignBriefNote,
  mergeCustomBuildNotes,
} from '@/lib/ai/applyBriefServiceImages'
import {
  FULL_REDESIGN_DESIGN_SYSTEM,
  validateFullRedesignPreflight,
} from '@/lib/ai/fullRedesignDesignSystem'
import {
  validateCustomSiteArtifact,
  type ArtifactValidationIssue,
} from '@/lib/validation/siteArtifactValidator'
import {
  saveValidationReport,
  validateTenantSite,
} from '@/lib/validation/siteValidator'
import {
  scanArtifactTells,
  scanUnitTells,
  toUnitQualityReport,
  type DesignTellFinding,
} from '@/lib/validation/designTellScanner'
import {
  MAX_REPAIR_ATTEMPTS_PER_UNIT,
  REPAIR_CUTOFF_MS,
  TYPOGRAPHY_PROBE_ALERT_THRESHOLD,
  UNIQUENESS_ENFORCEMENT,
  tellSeverity,
} from '@/lib/validation/designGuardPolicy'
import {
  applyRepairedUnits,
  repairDesignTells,
  repairUnitIdForFinding,
  unitIdForGlobalCss,
  unitIdForPage,
  type RepairUnits,
} from '@/lib/ai/repairDesignTells'
import {
  describeTakenSkeletons,
  findDesignCollisions,
  loadDesignAvoidList,
  recordCustomDesignFingerprint,
  type DesignAvoidList,
} from '@/lib/design/designAvoidList'
import {
  extractCustomDesignFingerprint,
  fingerprintKeys,
} from '@/lib/design/customDesignFingerprint'
import {
  consumeDesignDirectionReservation,
  plannedDirectionKeys,
  reserveDesignDirection,
  type DirectionReservation,
} from '@/lib/design/directionReservation'
import { adminWantsAttachmentsOnSite } from '@/lib/ai/persistAssistantAttachments'

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
  /** Additive CSS only — never replaces the design system. */
  globalCssAppend?: string | null
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
 *
 * globalCss: full replace only when safe (or allowFullCssReplace). Truncated /
 * token-less sheets are appended or rejected via mergeSurgicalGlobalCss.
 */
export function mergeCustomPatch(
  base: CustomSiteConfig,
  patch: SurgicalPatch,
  opts?: { allowFullCssReplace?: boolean }
): { merged: CustomSiteConfig; changedPages: string[]; warnings: string[] } {
  const merged = cloneCustomConfig(base)
  const changedPages: string[] = []
  const warnings: string[] = []

  const cssMerge = mergeSurgicalGlobalCss({
    baseCss: base.globalCss || '',
    globalCss: patch.globalCss,
    globalCssAppend: patch.globalCssAppend,
    allowFullCssReplace: opts?.allowFullCssReplace,
  })
  if (cssMerge.replaced || cssMerge.appended) {
    merged.globalCss = cssMerge.globalCss
    if (!changedPages.includes('(globalCss)')) changedPages.push('(globalCss)')
  }
  warnings.push(...cssMerge.warnings)

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

  return { merged, changedPages, warnings }
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

function looksLikeImageUrl(url: string): boolean {
  if (looksLikeVideoUrl(url)) return false
  return (
    /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(url) ||
    /\/storage\/v1\/object\/public\/site-assets\//i.test(url)
  )
}

// Re-export for tests / callers that import from this module.
export { looksLikeHeroImageSurgicalRequest } from '@/lib/ai/surgicalIntent'

/** Prefer contain when the admin wants the whole subject visible (not cropped). */
export function wantsWholeHeroImageVisible(prompt: string): boolean {
  return /\b(whole|entire|full)\b[\s\S]{0,40}\b(image|photo|picture|subject)\b|\b(not|don't|do\s+not|without)\b[\s\S]{0,40}\b(crop|cropped|enlarged|zoom|zoomed|cut\s+off|out\s+of\s+view)\b|\bobject-fit\s*:\s*contain\b|\bbackground-size\s*:\s*contain\b|\b(letterbox|contain)\b/i.test(
    prompt || ''
  )
}

/** Prefer cover when the admin wants the photo to fill the hero band edge-to-edge. */
export function wantsHeroImageToFillSection(prompt: string): boolean {
  return /\b(cover|covers|fill|fills|full[- ]?bleed|edge[- ]?to[- ]?edge)\b[\s\S]{0,48}\b(hero|banner|section|area|background|width)\b|\b(hero|banner|section|background)\b[\s\S]{0,48}\b(cover|covers|fill|fills|full[- ]?bleed)\b|\bbackground-size\s*:\s*cover\b|\bobject-fit\s*:\s*cover\b/i.test(
    prompt || ''
  )
}

/**
 * Resolve background-size for a surgical hero image swap.
 * Filling the hero wins when both "cover the hero" and "show the whole image"
 * are asked — a square photo cannot do both in a wide hero band.
 */
export function resolveHeroImageFit(prompt: string): 'contain' | 'cover' {
  if (wantsHeroImageToFillSection(prompt)) return 'cover'
  if (wantsWholeHeroImageVisible(prompt)) return 'contain'
  return 'cover'
}

/**
 * Rewrite the first hero-like section's background (or leading hero <img>) to
 * the given CDN URL. Deterministic — used so Surgical Edit does not depend on
 * the model rewriting an 8k+ home page under a tiny JSON budget.
 */
export function applyHeroImageToHomeHtml(
  html: string,
  imageUrl: string,
  fit: 'contain' | 'cover' = 'cover'
): string {
  const safeUrl = imageUrl.trim().replace(/[<>"'\\\s]/g, '')
  if (!html || !safeUrl) return html

  // Cover needs a real band height so a square/portrait CDN photo fills the
  // full hero width; otherwise a short content-sized hero looks "squeezed."
  const fitStyles =
    fit === 'contain'
      ? `background-image:url(${safeUrl}); background-size: contain; background-position: center; background-repeat: no-repeat; background-color: #1a1f1e; min-height: clamp(420px, 62vh, 720px);`
      : `background-image:url(${safeUrl}); background-size: cover; background-position: center; background-repeat: no-repeat; min-height: clamp(420px, 56vh, 680px);`

  const heroOpen =
    /<section\b(?=[^>]*\b(?:class|id)\s*=\s*["'][^"']*\b(?:hero|banner|splash)\b)[^>]*>/i.exec(
      html
    ) || /<header\b(?=[^>]*\b(?:class|id)\s*=\s*["'][^"']*\b(?:hero|banner|splash)\b)[^>]*>/i.exec(
      html
    )

  if (heroOpen && heroOpen.index != null) {
    const openTag = heroOpen[0]
    const start = heroOpen.index
    const end = start + openTag.length
    let nextOpen = openTag

    if (/\bstyle\s*=\s*"/i.test(nextOpen)) {
      nextOpen = nextOpen.replace(/\bstyle\s*=\s*"([^"]*)"/i, (_m, style: string) => {
        const s = style
          .replace(/background-image\s*:\s*url\((['"]?)[^)]+\1\)\s*;?/gi, '')
          .replace(/background-size\s*:\s*[^;]+;?/gi, '')
          .replace(/background-position\s*:\s*[^;]+;?/gi, '')
          .replace(/background-repeat\s*:\s*[^;]+;?/gi, '')
          .replace(/background-color\s*:\s*[^;]+;?/gi, '')
          .replace(/min-height\s*:\s*[^;]+;?/gi, '')
          .replace(/background\s*:\s*[^;]+;?/gi, '')
          .replace(/;\s*;/g, ';')
          .replace(/^\s*;\s*|\s*;\s*$/g, '')
          .trim()
        const merged = s ? `${s}; ${fitStyles}` : fitStyles
        return `style="${merged}"`
      })
    } else if (/\bstyle\s*=\s*'/i.test(nextOpen)) {
      nextOpen = nextOpen.replace(/\bstyle\s*=\s*'([^']*)'/i, (_m, style: string) => {
        const s = style
          .replace(/background-image\s*:\s*url\((['"]?)[^)]+\1\)\s*;?/gi, '')
          .replace(/background-size\s*:\s*[^;]+;?/gi, '')
          .replace(/background-position\s*:\s*[^;]+;?/gi, '')
          .replace(/background-repeat\s*:\s*[^;]+;?/gi, '')
          .replace(/background-color\s*:\s*[^;]+;?/gi, '')
          .replace(/min-height\s*:\s*[^;]+;?/gi, '')
          .replace(/background\s*:\s*[^;]+;?/gi, '')
          .replace(/;\s*;/g, ';')
          .replace(/^\s*;\s*|\s*;\s*$/g, '')
          .trim()
        const merged = s ? `${s}; ${fitStyles}` : fitStyles
        return `style='${merged}'`
      })
    } else {
      nextOpen = nextOpen.replace(/>$/, ` style="${fitStyles}">`)
    }

    let out = html.slice(0, start) + nextOpen + html.slice(end)

    // If the hero uses an <img> as the visual (not only CSS background), update
    // the first image inside that section too.
    const sectionEnd = out.indexOf('</section>', start)
    if (sectionEnd > start) {
      const before = out.slice(0, start)
      const section = out.slice(start, sectionEnd)
      const after = out.slice(sectionEnd)
      const swapped = section.replace(
        /(<img\b[^>]*\bsrc\s*=\s*)(["'])([^"']*)(\2)/i,
        `$1$2${safeUrl}$4`
      )
      out = before + swapped + after
    }
    return out
  }

  // Fallback: first background-image:url(...) on the page (cloned sites often
  // put the hero bg on the first section even without a "hero" class).
  if (/background-image\s*:\s*url\(/i.test(html)) {
    return html.replace(
      /background-image\s*:\s*url\((['"]?)[^)]+\1\)/i,
      `background-image:url(${safeUrl})`
    )
  }

  return html
}

/** Keep global `.hero{background-size:...}` in sync with the inline fit choice. */
export function applyHeroFitToGlobalCss(
  css: string,
  fit: 'contain' | 'cover'
): string {
  if (!css) return css
  if (/\.hero\s*\{[^}]*background-size\s*:/i.test(css)) {
    return css.replace(
      /(\.hero\s*\{[^}]*?background-size\s*:\s*)(cover|contain|auto|[\d.]+%|[\d.]+px)/gi,
      `$1${fit}`
    )
  }
  // Inject into the first .hero{...} rule when present.
  if (/\.hero\s*\{/i.test(css)) {
    return css.replace(/\.hero\s*\{/i, `.hero{background-size:${fit};`)
  }
  return `${css}\n.hero{background-size:${fit};background-position:center;}`
}

async function persistSurgicalShortcutDraft(opts: {
  tenantId: string
  draft: CustomSiteConfig
  reply: string
  changedPages: string[]
  warnings?: string[]
}): Promise<GenerateCustomSiteResult> {
  const sanitized = sanitizeCustomConfig(opts.draft)
  const supabase = getSupabaseAdmin()
  const { error: updateErr } = await supabase
    .from('site_configs')
    .update({
      custom_config_draft: sanitized,
      custom_updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', opts.tenantId)
  if (updateErr) throw new Error(`Failed to save draft: ${updateErr.message}`)

  try {
    const { revalidateTenantSiteCache } = await import(
      '@/lib/tenants/revalidateTenantSite'
    )
    await revalidateTenantSiteCache(opts.tenantId)
  } catch (revalErr) {
    console.warn('[generateCustomSite] shortcut revalidate failed:', revalErr)
  }

  return {
    draft: sanitized,
    warnings: opts.warnings || [],
    errors: [],
    reply: opts.reply,
    intent: 'surgical',
    changedPages: opts.changedPages,
  }
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

  // ensureHomeVideoAfterHero already persisted — still bust websites cache.
  try {
    const { revalidateTenantSiteCache } = await import(
      '@/lib/tenants/revalidateTenantSite'
    )
    await revalidateTenantSiteCache(opts.tenantId)
  } catch (revalErr) {
    console.warn('[generateCustomSite] video shortcut revalidate failed:', revalErr)
  }

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
 * Deterministic surgical path for hero image swaps. Uses attached CDN URLs
 * (or a URL in the prompt) so "use this image as the hero" does not depend on
 * the model rewriting the whole home page under the surgical JSON budget.
 */
async function trySurgicalHeroImageShortcut(opts: {
  tenantId: string
  prompt: string
  base: CustomSiteConfig
  attachedAssetUrls: string[]
}): Promise<GenerateCustomSiteResult | null> {
  if (!looksLikeHeroImageSurgicalRequest(opts.prompt)) return null

  const fromPrompt = extractHttpUrl(opts.prompt)
  let imageUrl =
    fromPrompt && looksLikeImageUrl(fromPrompt) ? fromPrompt : null

  if (!imageUrl) {
    imageUrl = opts.attachedAssetUrls.find((u) => looksLikeImageUrl(u)) || null
  }

  // Only fall back to Media library when the admin did not attach a prompt
  // image and explicitly points at an uploaded/library file — never guess
  // the newest upload (that often picks the wrong photo).
  if (
    !imageUrl &&
    opts.attachedAssetUrls.length === 0 &&
    /\b(media\s*library|uploaded|cdn\s*url)\b/i.test(opts.prompt)
  ) {
    const images = await listTenantMediaAssets(opts.tenantId, {
      kind: 'image',
      includeEngine: false,
    }).catch(() => [])
    imageUrl = images[0]?.url || null
  }

  if (!imageUrl) {
    // No persisted URL yet (e.g. legacy data-URL-only attach) — let the LLM path try.
    return null
  }

  const fit = resolveHeroImageFit(opts.prompt)
  const askedBoth =
    wantsHeroImageToFillSection(opts.prompt) &&
    wantsWholeHeroImageVisible(opts.prompt)

  const draft = cloneCustomConfig(opts.base)
  const home = draft.pages['/'] || Object.values(draft.pages)[0]
  if (!home) {
    return {
      draft: opts.base,
      warnings: [],
      errors: [],
      reply: 'Home page missing from the custom draft — clone or full redesign first.',
      intent: 'surgical',
      changedPages: [],
    }
  }

  const before = home.html || ''
  home.html = applyHeroImageToHomeHtml(before, imageUrl, fit)
  draft.pages['/'] = home
  draft.globalCss = applyHeroFitToGlobalCss(draft.globalCss || '', fit)

  const changed =
    before !== home.html || (opts.base.globalCss || '') !== (draft.globalCss || '')

  const fitNote =
    fit === 'contain'
      ? 'contain fit — full photo visible, may letterbox on the sides'
      : 'cover fit — fills the whole hero (square/portrait photos may crop top/bottom)'
  const bothNote = askedBoth
    ? ' Your prompt asked to both fill the hero and show the whole image; used cover so the hero is edge-to-edge.'
    : ''

  return persistSurgicalShortcutDraft({
    tenantId: opts.tenantId,
    draft,
    changedPages: changed ? ['/'] : [],
    warnings: changed
      ? askedBoth
        ? [
            'Asked for both “fill the hero” and “show the whole image” — used cover (fill). Say “contain / letterbox” if you prefer side bars instead of cropping.',
          ]
        : []
      : ['Hero already used this image — refreshed fit/size settings.'],
    reply: changed
      ? `Set the home hero background to your attached image (${fitNote}).${bothNote} Preview draft to confirm, then Publish when ready.`
      : 'Hero image was already set to that file — refreshed sizing. Preview draft to confirm.',
  })
}

/**
 * Deterministic site-wide phone / email / address swaps. The LLM often claims
 * success while returning an empty surgical patch (no page HTML) — contact
 * edits must not depend on that.
 */
async function trySurgicalContactShortcut(opts: {
  tenantId: string
  prompt: string
  base: CustomSiteConfig
  seo: SeoContactFields
}): Promise<GenerateCustomSiteResult | null> {
  if (!looksLikeContactSurgicalRequest(opts.prompt)) return null

  const htmlCorpus = Object.values(opts.base.pages || {})
    .map((p) => p?.html || '')
    .join('\n')
  const plan = parseContactSurgicalRequest(opts.prompt, {
    htmlCorpus,
    seo: opts.seo,
  })
  if (!plan) return null

  const applied = applyContactReplacePlan({
    pages: opts.base.pages,
    globalCss: opts.base.globalCss,
    seo: opts.seo,
    plan,
  })

  if (applied.changedPages.length === 0 && !applied.globalCssChanged) {
    return {
      draft: opts.base,
      warnings: applied.notes.length
        ? applied.notes
        : ['Contact fields already match the requested values — nothing to change.'],
      errors: [],
      reply:
        applied.notes[0] ||
        'No contact strings changed. Check the old phone/email/address in the prompt matches the site.',
      intent: 'surgical',
      changedPages: [],
    }
  }

  const draft = cloneCustomConfig(opts.base)
  for (const [path, page] of Object.entries(applied.pages)) {
    if (!page.changed) continue
    const existing = draft.pages[path]
    if (!existing) continue
    draft.pages[path] = {
      ...existing,
      html: page.html,
      ...(page.title !== undefined ? { title: page.title } : {}),
      ...(page.description !== undefined
        ? { description: page.description }
        : {}),
    }
  }
  if (applied.globalCssChanged) {
    draft.globalCss = applied.globalCss
  }

  const supabase = getSupabaseAdmin()
  const sanitized = sanitizeCustomConfig(draft)
  const { error: updateErr } = await supabase
    .from('site_configs')
    .update({
      custom_config_draft: sanitized,
      seo_config: applied.seo,
      custom_updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', opts.tenantId)
  if (updateErr) throw new Error(`Failed to save draft: ${updateErr.message}`)

  try {
    const { revalidateTenantSiteCache } = await import(
      '@/lib/tenants/revalidateTenantSite'
    )
    await revalidateTenantSiteCache(opts.tenantId)
  } catch (revalErr) {
    console.warn('[generateCustomSite] contact shortcut revalidate failed:', revalErr)
  }

  const summary = applied.summaryParts.join('; ')
  return {
    draft: sanitized,
    warnings: applied.notes,
    errors: [],
    reply: `Updated ${summary} on ${applied.changedPages.length} page(s)${
      applied.changedPages.length
        ? ` (${applied.changedPages.join(', ')})`
        : ''
    }. Also synced seo_config. Preview draft, then Publish when ready.`,
    intent: 'surgical',
    changedPages: applied.changedPages,
  }
}

/**
 * Deterministic: CSS-only side drawers for service cards (inline-safe).
 * Prefer this over plain links when the admin asks for a drawer / details panel.
 */
async function trySurgicalServiceDrawerShortcut(opts: {
  tenantId: string
  prompt: string
  base: CustomSiteConfig
}): Promise<GenerateCustomSiteResult | null> {
  if (!looksLikeServiceDrawerRequest(opts.prompt)) return null

  const draft = cloneCustomConfig(opts.base)
  const changedPages: string[] = []
  let total = 0
  for (const path of Object.keys(draft.pages)) {
    const page = draft.pages[path]
    if (!page?.html) continue
    const { html, count } = wireServiceCardDrawers(page.html)
    if (count > 0) {
      draft.pages[path] = { ...page, html }
      changedPages.push(path)
      total += count
    }
  }

  const beforeCss = draft.globalCss || ''
  draft.globalCss = ensureServiceDrawerCss(beforeCss)
  if (draft.globalCss !== beforeCss && !changedPages.includes('(globalCss)')) {
    changedPages.push('(globalCss)')
  }

  if (total === 0) {
    return {
      draft: opts.base,
      warnings: [],
      errors: [],
      reply:
        'Could not find service cards to wire into drawers. Cards need a title (h3) and plate/card markup — try again after a Full redesign, or name the section.',
      intent: 'surgical',
      changedPages: [],
    }
  }

  return persistSurgicalShortcutDraft({
    tenantId: opts.tenantId,
    draft,
    changedPages,
    warnings: [],
    reply: `Wired ${total} service card(s) to open a CSS-only side drawer with details (works in Inline mode — no JavaScript). Preview draft and click a card to confirm.`,
  })
}

/**
 * Deterministic: wrap content images in CSS-only lightbox labels (inline-safe).
 * Prefer /portfolio (and gallery aliases); skip logos, nav, and service-drawer faces.
 */
async function trySurgicalImageLightboxShortcut(opts: {
  tenantId: string
  prompt: string
  base: CustomSiteConfig
}): Promise<GenerateCustomSiteResult | null> {
  if (!looksLikeImageLightboxRequest(opts.prompt)) return null

  const draft = cloneCustomConfig(opts.base)
  const changedPages: string[] = []
  let total = 0
  const paths = lightboxPriorityPaths(
    opts.prompt || '',
    Object.keys(draft.pages)
  )
  for (const path of paths) {
    const page = draft.pages[path]
    if (!page?.html) continue
    const { html, count } = wireImageLightboxes(page.html)
    if (count > 0) {
      draft.pages[path] = { ...page, html }
      changedPages.push(path)
      total += count
    }
  }

  const beforeCss = draft.globalCss || ''
  draft.globalCss = ensureImageLightboxCss(beforeCss)
  if (draft.globalCss !== beforeCss && !changedPages.includes('(globalCss)')) {
    changedPages.push('(globalCss)')
  }

  if (total === 0) {
    return {
      draft: opts.base,
      warnings: [],
      errors: [],
      reply:
        'Could not find content images to wire into a lightbox (logos, nav, linked images, and service-drawer faces are skipped). Check Portfolio/gallery pages, or attach the images first.',
      intent: 'surgical',
      changedPages: [],
    }
  }

  const portfolioHit = changedPages.some((p) =>
    /\/(portfolio|gallery|work|projects)/i.test(p)
  )
  return persistSurgicalShortcutDraft({
    tenantId: opts.tenantId,
    draft,
    changedPages,
    warnings: [],
    reply: `Wired ${total} image(s) to enlarge on click with a CSS-only lightbox (Inline-safe — no JavaScript)${
      portfolioHit ? ', including Portfolio/gallery' : ''
    }. Preview draft and click a photo to confirm.`,
  })
}

/**
 * Deterministic: wrap service/product cards in links + append .clickable-card CSS.
 * Never replaces globalCss wholesale. Skips when a drawer was requested.
 */
async function trySurgicalClickableCardsShortcut(opts: {
  tenantId: string
  prompt: string
  base: CustomSiteConfig
}): Promise<GenerateCustomSiteResult | null> {
  if (looksLikeServiceDrawerRequest(opts.prompt)) return null
  if (!looksLikeClickableCardsRequest(opts.prompt)) return null

  const draft = cloneCustomConfig(opts.base)
  const changedPages: string[] = []
  let totalWrapped = 0
  const targets = ['/', '/services', '/products']
  for (const path of targets) {
    const page = draft.pages[path]
    if (!page?.html) continue
    const { html, wrapped } = makeServiceCardsClickable(page.html, '/contact')
    if (wrapped > 0 || html !== page.html) {
      draft.pages[path] = { ...page, html }
      changedPages.push(path)
      totalWrapped += wrapped
    }
  }

  // Also scan other pages lightly if home/services had no cards
  if (totalWrapped === 0) {
    for (const [path, page] of Object.entries(draft.pages)) {
      if (targets.includes(path) || !page?.html) continue
      const { html, wrapped } = makeServiceCardsClickable(page.html, '/contact')
      if (wrapped > 0) {
        draft.pages[path] = { ...page, html }
        changedPages.push(path)
        totalWrapped += wrapped
      }
    }
  }

  const beforeCss = draft.globalCss || ''
  draft.globalCss = ensureClickableCardCss(beforeCss)
  if (draft.globalCss !== beforeCss && !changedPages.includes('(globalCss)')) {
    changedPages.push('(globalCss)')
  }

  if (totalWrapped === 0 && draft.globalCss === beforeCss) {
    return {
      draft: opts.base,
      warnings: [],
      errors: [],
      reply:
        'Could not find service/product card blocks to wrap. Name the section or use Full redesign if the markup is unusual.',
      intent: 'surgical',
      changedPages: [],
    }
  }

  return persistSurgicalShortcutDraft({
    tenantId: opts.tenantId,
    draft,
    changedPages,
    warnings: [],
    reply:
      totalWrapped > 0
        ? `Made ${totalWrapped} service/product card(s) clickable (wrapped in links) and ensured .clickable-card styles. Preview draft to confirm.`
        : 'Ensured .clickable-card styles on globalCss. Preview draft to confirm.',
  })
}

/**
 * Copy published globalCss into the draft (admin recovery when surgical wiped CSS).
 */
export async function restoreDraftCssFromPublished(tenantId: string): Promise<{
  restored: boolean
  draftCssLength: number
  publishedCssLength: number
  reply: string
}> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('site_configs')
    .select('custom_config, custom_config_draft')
    .eq('tenant_id', tenantId)
    .single()
  if (error || !data) throw new Error('Site config not found')
  if (!isCustomSiteConfig(data.custom_config)) {
    throw new Error('No published custom site to restore CSS from.')
  }
  if (!isCustomSiteConfig(data.custom_config_draft)) {
    throw new Error('No draft to restore CSS into — clone or generate a draft first.')
  }
  const pubCss = data.custom_config.globalCss || ''
  const draft = cloneCustomConfig(data.custom_config_draft)
  draft.globalCss = pubCss
  const sanitized = sanitizeCustomConfig(draft)
  const { error: updateErr } = await supabase
    .from('site_configs')
    .update({
      custom_config_draft: sanitized,
      custom_updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
  if (updateErr) throw new Error(`Failed to restore CSS: ${updateErr.message}`)
  try {
    const { revalidateTenantSiteCache } = await import(
      '@/lib/tenants/revalidateTenantSite'
    )
    await revalidateTenantSiteCache(tenantId)
  } catch (revalErr) {
    console.warn('[generateCustomSite] restore-css revalidate failed:', revalErr)
  }
  return {
    restored: true,
    draftCssLength: (sanitized.globalCss || '').length,
    publishedCssLength: pubCss.length,
    reply:
      'Restored draft globalCss from the published site. Preview draft — layout should be styled again.',
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
   * Optional images: preferred persisted https CDN URLs, or legacy data URLs.
   * CDN URLs are reused in site HTML; all refs are hydrated for model vision.
   */
  images?: string[]
  /** Multi-pass progress for Graphile / admin UI. */
  onProgress?: (progress: {
    pass: string
    passesDone: string[]
    requiredPaths: string[]
    reply?: string
    lockedBrief?: CustomBuildLockedBrief
    serviceUpdates?: ServiceUpdates
    foundationReply?: string
  }) => Promise<void>
  /** Persist partial draft after each pass (resume after worker crash). */
  onCheckpoint?: (draft: CustomSiteConfig) => Promise<void>
  /** Resume extras from custom_build_job (same Graphile run). */
  resumeState?: {
    lockedBrief?: CustomBuildLockedBrief | null
    serviceUpdates?: ServiceUpdates | null
    foundationReply?: string | null
  }
  /** Stable Graphile run identity; reservations are idempotent across retries. */
  jobKey?: string
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
        industry,
        custom_config_draft,
        custom_config,
        custom_build_notes
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

  const intent: CustomBuildIntent =
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
    const route = classifySurgicalIntent(opts.prompt || '', {
      hasImages: !!(opts.images && opts.images.length > 0),
      attachedAssetUrls: [],
    })

    // Deterministic routes (no model HTML). Video skips when vision images present.
    if (route.kind === 'video' && !(opts.images && opts.images.length > 0)) {
      const mediaShortcut = await trySurgicalVideoShortcut({
        tenantId: opts.tenantId,
        prompt: opts.prompt || '',
        base,
      })
      if (mediaShortcut) return mediaShortcut
    }
  }

  const hydratedImages = await hydrateAdminImagesForModel(opts.images)
  const attachmentImages = hydratedImages.vision
  const attachedAssetUrls = hydratedImages.assetUrls
  const placeAttachmentsOnSite = adminWantsAttachmentsOnSite(opts.prompt || '')
  const placeableAssetUrls = placeAttachmentsOnSite ? attachedAssetUrls : []

  if (intent === 'surgical' && base) {
    const route = classifySurgicalIntent(opts.prompt || '', {
      hasImages: !!(opts.images && opts.images.length > 0),
      attachedAssetUrls: placeableAssetUrls,
    })

    if (route.kind === 'hero_image') {
      const heroShortcut = await trySurgicalHeroImageShortcut({
        tenantId: opts.tenantId,
        prompt: opts.prompt || '',
        base,
        attachedAssetUrls: placeableAssetUrls,
      })
      if (heroShortcut) return heroShortcut
    }

    const modeEarly = opts.mode || base?.mode || 'inline'
    const seoEarly = (cfg.seo_config || {}) as Record<string, unknown>

    if (route.kind === 'contact') {
      const contactShortcut = await trySurgicalContactShortcut({
        tenantId: opts.tenantId,
        prompt: opts.prompt || '',
        base,
        seo: {
          phone: typeof seoEarly.phone === 'string' ? seoEarly.phone : undefined,
          email: typeof seoEarly.email === 'string' ? seoEarly.email : undefined,
          streetAddress:
            typeof seoEarly.streetAddress === 'string'
              ? seoEarly.streetAddress
              : undefined,
          addressLocality:
            typeof seoEarly.addressLocality === 'string'
              ? seoEarly.addressLocality
              : undefined,
          addressRegion:
            typeof seoEarly.addressRegion === 'string'
              ? seoEarly.addressRegion
              : undefined,
          postalCode:
            typeof seoEarly.postalCode === 'string'
              ? seoEarly.postalCode
              : undefined,
          legalName:
            typeof seoEarly.legalName === 'string' ? seoEarly.legalName : undefined,
        },
      })
      if (contactShortcut) return contactShortcut
    }

    if (route.kind === 'service_drawer') {
      const drawerShortcut = await trySurgicalServiceDrawerShortcut({
        tenantId: opts.tenantId,
        prompt: opts.prompt || '',
        base,
      })
      if (drawerShortcut) return drawerShortcut
    }

    if (route.kind === 'image_lightbox') {
      const lightboxShortcut = await trySurgicalImageLightboxShortcut({
        tenantId: opts.tenantId,
        prompt: opts.prompt || '',
        base,
      })
      if (lightboxShortcut) return lightboxShortcut
    }

    if (route.kind === 'clickable_cards') {
      const clickableShortcut = await trySurgicalClickableCardsShortcut({
        tenantId: opts.tenantId,
        prompt: opts.prompt || '',
        base,
      })
      if (clickableShortcut) return clickableShortcut
    }

    // Mid-tier: LLM emits op list only — cheerio applies (no full-page HTML).
    if (route.kind === 'ops') {
      const brandNameEarly = (cfg.brand_name ||
        tenant.business_name ||
        'Business') as string
      const opsResult = await runSurgicalOpsGenerate({
        brandName: brandNameEarly,
        prompt: opts.prompt || '',
        mode: modeEarly,
        base,
      })
      const sanitizedOps = sanitizeCustomConfig(opsResult.config)
      ensureWidgetPlaceholder(sanitizedOps)
      const supabaseOps = getSupabaseAdmin()
      const { error: opsErr } = await supabaseOps
        .from('site_configs')
        .update({
          custom_config_draft: sanitizedOps,
          custom_updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', opts.tenantId)
      if (opsErr) throw new Error(`Failed to save draft: ${opsErr.message}`)
      try {
        const { revalidateTenantSiteCache } = await import(
          '@/lib/tenants/revalidateTenantSite'
        )
        await revalidateTenantSiteCache(opts.tenantId)
      } catch (revalErr) {
        console.warn('[generateCustomSite] ops path revalidate failed:', revalErr)
      }
      return {
        draft: sanitizedOps,
        warnings: opsResult.extraWarnings,
        errors: [],
        reply: opsResult.reply,
        intent: 'surgical',
        changedPages: opsResult.changedPages,
      }
    }
  }

  const mode = opts.mode || base?.mode || 'inline'
  const products = Array.isArray(cfg.products_config) ? cfg.products_config : []
  const pagesConfig = Array.isArray(cfg.pages_config) ? cfg.pages_config : []
  const seo = (cfg.seo_config || {}) as Record<string, unknown>
  const brandName = (cfg.brand_name || tenant.business_name || 'Business') as string
  const industryKey =
    typeof cfg.industry === 'string'
      ? cfg.industry.trim().toLowerCase()
      : null
  const marketKey = [seo.addressLocality, seo.addressRegion]
    .filter((value): value is string => typeof value === 'string' && !!value.trim())
    .map((value) => value.trim().toLowerCase())
    .join('|') || null

  // Full redesigns must ship EVERY intake page (including inactive rows that
  // nav often still links to — we reactivate drafted paths on save).
  const requiredPaths = buildFullRedesignRequiredPaths(
    pagesConfig as Array<{ slug?: string; is_active?: boolean | null }>
  )
  const pageHints = requiredPaths.join(', ')

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
    /**
     * Prompt attachments already uploaded to the CDN — use these exact URLs
     * when the admin asks to place an image (hero, gallery, etc.).
     */
    attachedAssetUrls: placeableAssetUrls,
    attachmentsAreReferenceOnly:
      attachedAssetUrls.length > 0 && !placeAttachmentsOnSite,
    /** Uploaded CDN assets the admin can reference without pasting URLs. */
    // Cap media list so Full redesign prompts stay within the serverless time budget.
    mediaLibrary: [
      ...placeableAssetUrls.map((url, i) => ({
        kind: 'image' as const,
        name: `prompt-attachment-${i + 1}`,
        url,
      })),
      ...mediaLibrary.slice(0, 24).map((a) => ({
        kind: a.kind,
        name: a.name,
        url: a.url,
      })),
    ],
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

  let result =
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
          tenantId: opts.tenantId,
          jobKey: opts.jobKey,
          // Designs already shipped, so the model steers away from taken
          // directions up front rather than being rejected afterwards. Loaded
          // here because runFullGenerate has no Supabase access of its own.
          avoidList: await loadDesignAvoidList({
            supabase,
            tenantId: opts.tenantId,
            industryKey,
            marketKey,
          }),
          prompt: opts.prompt,
          mode,
          pageHints,
          requiredPaths,
          existingDraft: intent === 'full' ? existingDraft : null,
          resumeState: intent === 'full' ? opts.resumeState : undefined,
          onProgress: opts.onProgress,
          onCheckpoint: opts.onCheckpoint,
          context: {
            ...context,
            designIndustryKey: industryKey,
            designMarketKey: marketKey,
            /** Every intake page with its full section content — build them all. */
            intakePages,
            navLinks: Array.isArray(cfg.nav_links) ? cfg.nav_links : undefined,
          },
          images: attachmentImages,
        })

  // Backstop: if the admin asked for a hero image swap and the model missed the
  // attached CDN URL, force-apply it so Preview draft cannot keep the old photo.
  if (
    intent === 'surgical' &&
    base &&
    looksLikeHeroImageSurgicalRequest(opts.prompt || '') &&
    placeableAssetUrls.length > 0
  ) {
    const heroUrl =
      placeableAssetUrls.find((u) => looksLikeImageUrl(u)) || placeableAssetUrls[0]
    const homeHtml = result.config.pages['/']?.html || ''
    if (heroUrl && !homeHtml.includes(heroUrl)) {
      const fit = resolveHeroImageFit(opts.prompt || '')
      const fixed = cloneCustomConfig(result.config)
      const home = fixed.pages['/']
      if (home) {
        home.html = applyHeroImageToHomeHtml(home.html || '', heroUrl, fit)
        fixed.pages['/'] = home
        fixed.globalCss = applyHeroFitToGlobalCss(fixed.globalCss || '', fit)
        result = {
          ...result,
          config: fixed,
          changedPages: Array.from(new Set([...(result.changedPages || []), '/'])),
          reply:
            (result.reply ? `${result.reply} ` : '') +
            `Applied attached hero image with background-size:${fit}.`,
          extraWarnings: [
            ...(result.extraWarnings || []),
            'Model omitted the attached hero URL — applied it deterministically.',
          ],
        }
      }
    }
  }

  // Never mark Full redesign succeeded with an incomplete draft — missing
  // pages fall through to the old engine (or blank / 404) on Preview.
  if (intent === 'full') {
    result = {
      ...result,
      config: dropEmptyCustomPages(
        applyPathAliasesToCustomConfig(sanitizeCustomConfig(result.config))
      ),
    }
    assertFullRedesignPagesComplete(result.config, requiredPaths)
  }

  let sanitized = sanitizeCustomConfig(result.config)
  ensureWidgetPlaceholder(sanitized)

  if (intent === 'full') {
    sanitized = dropEmptyCustomPages(applyPathAliasesToCustomConfig(sanitized))
    assertFullRedesignPagesComplete(sanitized, requiredPaths)
  }
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

  // Full redesign: merge brief-introduced services into products_config + engine,
  // generate believable CDN images for adds not in intake, and wire those URLs
  // into HTML + gallery + custom_build_notes.
  let mergedProducts: ProductRow[] | null = null
  let pagesConfigUpdate: unknown | null = null
  let customBuildNotesUpdate: unknown | null = null
  if (intent === 'full') {
    if (
      'inventedBrief' in result &&
      result.inventedBrief &&
      typeof result.inventedBrief === 'object'
    ) {
      const invented = result.inventedBrief as {
        signatureConcept: string
        optimizedBrief: string
        source: string
      }
      customBuildNotesUpdate = mergeCustomBuildNotes(
        (cfg as { custom_build_notes?: unknown }).custom_build_notes,
        [
          buildInventedRedesignBriefNote({
            signatureConcept: invented.signatureConcept,
            optimizedBrief: invented.optimizedBrief,
            source: invented.source,
          }),
        ]
      )
      warnings.push(
        `Empty prompt — invented a full design-direction brief from intake + design system (${invented.source}): ${invented.signatureConcept}`
      )
    }
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

      try {
        const generated = await generateBriefServiceImages({
          tenantId: opts.tenantId,
          brandName,
          services: mergeResult.added,
          max: 8,
        })
        if (generated.length) {
          const imageByTitle: Record<string, string> = {}
          for (const g of generated) {
            imageByTitle[g.title.trim().toLowerCase()] = g.url
          }
          mergedProducts = applyImagesToProducts(mergedProducts, generated)
          sanitized = applyBriefServiceImagesToCustomHtml(sanitized, generated)
          pagesConfigUpdate = appendImagesToPagesConfigGallery(
            cfg.pages_config,
            generated.map((g) => g.url)
          )
          customBuildNotesUpdate = mergeCustomBuildNotes(
            customBuildNotesUpdate ??
              (cfg as { custom_build_notes?: unknown }).custom_build_notes,
            buildBriefServiceImageNotes(generated)
          )
          warnings.push(
            `Generated CDN images for brief-added services: ${generated
              .map((g) => g.title)
              .join(', ')}.`
          )
          // Re-inject any still-missing cards with image URLs when possible.
          for (const key of Object.keys(sanitized.pages || {})) {
            const page = sanitized.pages[key]
            if (!page) continue
            const missing = mergeResult.added.filter(
              (a) => !htmlMentionsService(page.html || '', a.title)
            )
            if (!missing.length) continue
            page.html = injectMissingServicesIntoHtml(
              page.html || '',
              missing.map((a) => ({
                title: a.title,
                description:
                  a.description || `${a.title} offered by this business.`,
              })),
              imageByTitle
            )
            sanitized.pages[key] = page
          }
        } else {
          warnings.push(
            'Brief-added services have no new images yet (generation returned none) — catalog rows were still added.'
          )
        }
      } catch (imgErr) {
        console.warn('[generateCustomSite] brief service images failed:', imgErr)
        warnings.push(
          'Could not generate images for brief-added services — titles were still added to the catalog; retry Full redesign or upload photos in Media.'
        )
      }
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
    for (const p of mergedProducts) {
      const title = typeof p.title === 'string' ? p.title.trim() : ''
      if (!title) continue
      if (!htmlBlob.includes(title.toLowerCase())) {
        warnings.push(
          `Service “${title}” is in the catalog but may be missing from redesign HTML — check home/services pages.`
        )
      }
    }
    const craftBrief =
      'inventedBrief' in result &&
      result.inventedBrief &&
      typeof result.inventedBrief === 'object' &&
      typeof (result.inventedBrief as { optimizedBrief?: unknown }).optimizedBrief ===
        'string'
        ? (result.inventedBrief as { optimizedBrief: string }).optimizedBrief
        : opts.prompt
    warnings.push(
      ...assessFullRedesignCraft({
        config: sanitized,
        serviceCount: mergedProducts.filter(
          (p) => typeof p.title === 'string' && p.title.trim()
        ).length,
        brief: craftBrief,
      })
    )
  }

  sanitized = sanitizeCustomConfig(sanitized)
  ensureWidgetPlaceholder(sanitized)

  const siteUpdate: Record<string, unknown> = {
    custom_config_draft: sanitized,
    custom_updated_at: new Date().toISOString(),
  }
  if (mergedProducts) {
    siteUpdate.products_config = mergedProducts
  }
  if (pagesConfigUpdate != null) {
    siteUpdate.pages_config =
      intent === 'full'
        ? activatePagesConfigForDraftPaths(
            pagesConfigUpdate,
            Object.keys(sanitized.pages)
          )
        : pagesConfigUpdate
  } else if (intent === 'full') {
    // Reactivate any drafted path that was left is_active=false (e.g. Reviews)
    // so Preview/engine fallback and nav targets do not 404.
    siteUpdate.pages_config = activatePagesConfigForDraftPaths(
      cfg.pages_config,
      Object.keys(sanitized.pages)
    )
  }
  if (customBuildNotesUpdate != null) {
    siteUpdate.custom_build_notes = customBuildNotesUpdate
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
 *
 * Not superseded by designTellScanner, despite the overlap. The scanner asks
 * "does the artifact contain a banned default?" and blocks; this asks "did the
 * build miss something the brief implied?" and only advises. The dual-lane check
 * below is the clearest case of the difference: it fires when the brief names two
 * disciplines and the design has only one accent — the opposite polarity to the
 * scanner's design_dual_lane_gateway, which fires on two lanes the brief never
 * asked for. Duplicate skin warnings are deduped at the call site, not here.
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
  tenantId: string
  jobKey?: string
  /** Designs already on the platform — drives the avoid-list and the collision gate. */
  avoidList: DesignAvoidList
  prompt: string
  mode: 'inline' | 'iframe'
  pageHints: string
  requiredPaths: string[]
  context: Record<string, unknown>
  images?: Array<{ mimeType: string; data: string }>
  /** Checkpointed draft from a prior attempt of this Graphile job (resume). */
  existingDraft?: CustomSiteConfig | null
  resumeState?: {
    lockedBrief?: CustomBuildLockedBrief | null
    serviceUpdates?: ServiceUpdates | null
    foundationReply?: string | null
  }
  onProgress?: (progress: {
    pass: string
    passesDone: string[]
    requiredPaths: string[]
    reply?: string
    lockedBrief?: CustomBuildLockedBrief
    serviceUpdates?: ServiceUpdates
    foundationReply?: string
  }) => Promise<void>
  onCheckpoint?: (draft: CustomSiteConfig) => Promise<void>
}): Promise<{
  config: CustomSiteConfig
  reply: string
  changedPages: string[]
  extraWarnings: string[]
  serviceUpdates: ServiceUpdates
  /** Present when admin left the seed empty — self-authored design-direction prompt. */
  inventedBrief?: {
    signatureConcept: string
    optimizedBrief: string
    source: string
  }
}> {
  // Full redesigns use Claude Sonnet 5 by default — Fable 5's adaptive
  // thinking routinely exceeds the ~5 minute serverless budget. Override with
  // CUSTOM_SITE_CLAUDE_MODEL=claude-fable-5 if you want the frontier model.
  const useClaude = !!process.env.ANTHROPIC_API_KEY
  const hasImages = !!(opts.images && opts.images.length > 0)
  const attachedAssetUrls = Array.isArray(opts.context.attachedAssetUrls)
    ? (opts.context.attachedAssetUrls as unknown[])
        .filter((u): u is string => typeof u === 'string' && /^https:\/\//i.test(u))
        .slice(0, 4)
    : []
  const attachmentsAreReferenceOnly = opts.context.attachmentsAreReferenceOnly === true
  const adminBrief = (opts.prompt || '').trim()
  const seedEmpty = !adminBrief
  const hasBrief = adminBrief.length > 0 || hasImages || attachedAssetUrls.length > 0

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

  const resumeLocked = opts.resumeState?.lockedBrief
  if (!resumeLocked) {
    await opts.onProgress?.({
      pass: 'design-system:crafting',
      passesDone: passesDoneFromDraft(opts.requiredPaths, opts.existingDraft || emptyFullRedesignDraft(opts.mode)),
      requiredPaths: opts.requiredPaths,
      reply: adminBrief
        ? 'Crafting a new design system around your Full redesign instructions…'
        : 'Crafting a new design system from intake, business context, and platform uniqueness history…',
    })
  }
  let enhanced: EnhancedFullRedesignBrief =
    resumeLocked &&
    typeof resumeLocked.optimizedBrief === 'string' &&
    resumeLocked.optimizedBrief.trim().length > 40
      ? {
          signatureConcept: resumeLocked.signatureConcept || 'Resumed design direction',
          materialWorld: resumeLocked.materialWorld || '',
          palette: Array.isArray(resumeLocked.palette) ? resumeLocked.palette : [],
          typography: {
            display: resumeLocked.typography?.display || 'Georgia',
            body: resumeLocked.typography?.body || 'system-ui',
            why: resumeLocked.typography?.why || 'resumed',
          },
          signatureElement: resumeLocked.signatureElement || '',
          copyRegister: resumeLocked.copyRegister || '',
          servicesToAdd: Array.isArray(resumeLocked.servicesToAdd)
            ? resumeLocked.servicesToAdd
            : [],
          avoidDefaults: Array.isArray(resumeLocked.avoidDefaults)
            ? resumeLocked.avoidDefaults
            : [],
          designSystem:
            resumeLocked.designSystem ||
            fallbackEnhancedBrief({
              brandName: opts.brandName,
              adminBrief,
              hasImages,
              engagementLabel,
              services,
            }).designSystem,
          optimizedBrief: resumeLocked.optimizedBrief,
          inventedFromIntake: !!resumeLocked.inventedFromIntake,
          source:
            resumeLocked.source === 'gemini' ||
            resumeLocked.source === 'anthropic' ||
            resumeLocked.source === 'fallback'
              ? resumeLocked.source
              : 'fallback',
        }
      : await enhanceFullRedesignBrief({
          brandName: opts.brandName,
          adminBrief,
          hasImages: hasImages || attachedAssetUrls.length > 0,
          engagementLabel,
          services,
          city: typeof seoCtx.city === 'string' ? seoCtx.city : undefined,
          region: typeof seoCtx.region === 'string' ? seoCtx.region : undefined,
          themeHint:
            typeof opts.context.themeHint === 'string' ? opts.context.themeHint : undefined,
          intakeHints: buildIntakeHintsForBrief(opts.context),
          avoid: opts.avoidList,
        })

  let directionReservation: DirectionReservation | null = null
  let reservationStatus: 'not_requested' | 'reserved' | 'unavailable' | 'conflict_exhausted' =
    opts.jobKey ? 'conflict_exhausted' : 'not_requested'
  const reservationDirection = (brief: EnhancedFullRedesignBrief) => ({
    typography: brief.typography,
    palette: brief.palette,
    composition: brief.designSystem.composition,
    signatureElement: brief.signatureElement,
  })
  if (opts.jobKey) {
    const rejectedFontKeys: string[] = []
    const rejectedPaletteKeys: string[] = []
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const result = await reserveDesignDirection({
        supabase: getSupabaseAdmin(),
        tenantId: opts.tenantId,
        jobKey: opts.jobKey,
        direction: reservationDirection(enhanced),
        industryKey:
          typeof opts.context.designIndustryKey === 'string'
            ? opts.context.designIndustryKey
            : null,
        marketKey:
          typeof opts.context.designMarketKey === 'string'
            ? opts.context.designMarketKey
            : null,
      })
      if (result.status === 'reserved') {
        directionReservation = result.reservation
        reservationStatus = 'reserved'
        break
      }
      if (result.status === 'unavailable') {
        reservationStatus = 'unavailable'
        break
      }

      const keys = plannedDirectionKeys(reservationDirection(enhanced))
      rejectedFontKeys.push(keys.fontKey)
      rejectedPaletteKeys.push(keys.paletteKey)
      enhanced = fallbackEnhancedBrief({
        brandName: opts.brandName,
        adminBrief,
        hasImages: hasImages || attachedAssetUrls.length > 0,
        engagementLabel,
        services,
        city: typeof seoCtx.city === 'string' ? seoCtx.city : undefined,
        region: typeof seoCtx.region === 'string' ? seoCtx.region : undefined,
        themeHint:
          typeof opts.context.themeHint === 'string' ? opts.context.themeHint : undefined,
        intakeHints: buildIntakeHintsForBrief(opts.context),
        avoid: {
          ...opts.avoidList,
          takenFontKeys: [...opts.avoidList.takenFontKeys, ...rejectedFontKeys],
          takenPaletteKeys: [...opts.avoidList.takenPaletteKeys, ...rejectedPaletteKeys],
        },
      })
    }
    if (!directionReservation && resumeLocked?.directionReservationId) {
      directionReservation = {
        id: resumeLocked.directionReservationId,
        directionKey:
          resumeLocked.directionKey || plannedDirectionKeys(reservationDirection(enhanced)).directionKey,
        expiresAt: '',
      }
    }
    if (!directionReservation) {
      throw new Error(
        reservationStatus === 'unavailable'
          ? 'Full redesign direction reservation service is unavailable; retry when the database is reachable.'
          : 'Full redesign could not reserve a distinct direction after eight attempts; retry with refreshed design history.'
      )
    }
  }

  const directionMetrics = enhanced.directionMetrics
  console.info(JSON.stringify({
    event: 'design_candidate_pool',
    tenantId: opts.tenantId,
    candidateCount: directionMetrics?.candidateCount ?? null,
    probeCount: directionMetrics?.probeCount ?? null,
    reuseScore: directionMetrics?.reuseScore ?? null,
    usedPreferredPair: directionMetrics?.usedPreferredPair ?? null,
    probeAlert:
      typeof directionMetrics?.probeCount === 'number' &&
      directionMetrics.probeCount > TYPOGRAPHY_PROBE_ALERT_THRESHOLD,
    reservationStatus,
  }))

  await opts.onProgress?.({
    pass: 'design-system:validating',
    passesDone: passesDoneFromDraft(opts.requiredPaths, opts.existingDraft || emptyFullRedesignDraft(opts.mode)),
    requiredPaths: opts.requiredPaths,
    reply: 'Validating the locked design system for originality, anti-AI quality, coherence, accessibility, and your instructions…',
    lockedBrief: {
      signatureConcept: enhanced.signatureConcept,
      optimizedBrief: enhanced.optimizedBrief,
      materialWorld: enhanced.materialWorld,
      palette: enhanced.palette,
      typography: enhanced.typography,
      signatureElement: enhanced.signatureElement,
      copyRegister: enhanced.copyRegister,
      servicesToAdd: enhanced.servicesToAdd,
      avoidDefaults: enhanced.avoidDefaults,
      designSystem: enhanced.designSystem,
      inventedFromIntake: enhanced.inventedFromIntake,
      source: enhanced.source,
      directionReservationId: directionReservation?.id,
      directionKey: directionReservation?.directionKey,
    },
  })

  const preflightFailures = validateFullRedesignPreflight(
    enhanced,
    opts.avoidList.takenFontKeys,
    opts.avoidList.taken
      .map((taken) => taken.signatureConcept || '')
      .filter(Boolean)
  )
  if (preflightFailures.length > 0) {
    throw new Error(
      `Full redesign design-system preflight failed before generation: ${preflightFailures.join('; ')}`
    )
  }

  const lockedBriefForJob: CustomBuildLockedBrief = {
    signatureConcept: enhanced.signatureConcept,
    optimizedBrief: enhanced.optimizedBrief,
    materialWorld: enhanced.materialWorld,
    palette: enhanced.palette,
    typography: enhanced.typography,
    signatureElement: enhanced.signatureElement,
    copyRegister: enhanced.copyRegister,
    servicesToAdd: enhanced.servicesToAdd,
    avoidDefaults: enhanced.avoidDefaults,
    designSystem: enhanced.designSystem,
    inventedFromIntake: enhanced.inventedFromIntake,
    source: enhanced.source,
    directionReservationId: directionReservation?.id,
    directionKey: directionReservation?.directionKey,
  }

  const systemPrompt = `You produce production-ready marketing sites as raw HTML + CSS for real local businesses on this platform. The complete design language below was created, independently reviewed, deterministically validated, and locked before this build began. Execute it precisely; do not fall back to a familiar house style.

${FULL_REDESIGN_DESIGN_SYSTEM}

# Core rule: nothing you produce may look AI-generated

AI design clusters around recognizable defaults. Know the tells and design away from them unless the brief explicitly asks for one. The substitute for defaults is subject-derived design — the product's materials, tools, artifacts, vernacular, locality, and audience. Name the subject, audience, and the page's single job first; derive every choice from those.

${
  seedEmpty || enhanced.inventedFromIntake
    ? `The user message includes a SELF-AUTHORED DESIGN DIRECTION PROMPT invented from intake using our design system (admin left the seed empty). Treat that prompt as if the admin typed it — execute it literally for palette, type, signature element, layout, copy register, and process. Do not invent a competing direction.`
    : `The user message includes an OPTIMIZED CREATIVE BRIEF (expanded from the admin seed + intake) plus the raw ADMIN SEED. The raw ADMIN SEED is the highest-authority creative constraint: execute every explicit request about composition, palette, typography, imagery, features, services, tone, and content. Optimizer additions may fill unspecified axes but may not overwrite user choices. Only platform safety, supplied facts, accessibility, or a documented prior-design collision can require adaptation; preserve the user's underlying intent when adapting.`
}

Banned defaults (unless the brief explicitly requests them):
- Purple-to-blue / indigo / teal SaaS gradients, or gradients used instead of a real palette decision
- Cream/off-white + high-contrast serif display + terracotta/warm-clay accent as a habit skin
- Near-black + single acid-green / neon lime / cyan / gold accent applied regardless of fit; carbon texture; skewed italic CTAs
- Hero template: vague headline ("Build faster. Ship smarter."), gray subhead, two buttons, gradient blob / abstract 3D on the right
- Standalone numeric counters (01 / 02 / 03, Step 01, figure labels) as visual decoration. Do not display process numbers by default even for a real sequence; semantic order, titles, spacing, and connectors already communicate progression. Show a number only when visitors must refer to it or it communicates a supplied fact. Never zero-pad a decorative sequence, and never number ordinary service, feature, testimonial, or team lists.
- Spec-sheet / technical document metadata: NEVER output artificial reference tags, spec sheet codes, or engineering document markers like "DOC. REF: ABT-01", "DOC: INQ-LOG", "REV: 2024", "REF: 01 / 02 / 03", "Case File", "System Spec //", "FIG 1", or programming comment syntax ("//") on public content. Never use document-style CTA labels such as "View Protocol", "Open Dossier", or "View Case File"; use audience-appropriate actions such as "View Services" or "Learn More". UI badges and labels must be natural, human, and industry-appropriate.
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
${opts.avoidList.promptBlock ? `\n${opts.avoidList.promptBlock}\n` : ''}
# Workflow (internal only — never print the analysis)

Pass 1 — Direction (before tokens or HTML):
1. Understand the product: type, audience, business goal, the one action this site drives (always the engagement engine below — never invent HTML forms / multi-step estimators / booking wizards).
2. Lock the OPTIMIZED CREATIVE BRIEF: signature concept, material world, palette hexes, type pairing, signature element. Reference images (if any) refine that direction — absorb mood/composition, do not copy trademarks.
3. Self-check: would ten AI tools given this brief plausibly produce the same direction? If yes, revise before coding. State the winning signature concept in the JSON "reply".

Pass 2 — System + site (then emit JSON only):
4. Tokens in globalCss :root — implement the optimized palette (adjust only for AA contrast / brief overrides); --df/--bf from the brief's Google Fonts; optional mono only if it fits; one --acc (second accent ONLY for true dual-lane); spacing/radius/shadow consistent with direction (precision brands ≠ soft 24px radii).
5. Shared chrome: sticky header with real shop name + nav + phone + primary CTA; designed footer with real contact; .wrap .eyebrow .btn(+variants). One atmospheric device that fits (paper grain, wash, photo bleed, hairline grid, air — not mandatory neon seams).
6. Home composition must be invented for this direction, not selected from a house template. Choose a fundamentally distinct spatial grammar (for example immersive image-led, typographic poster, dense catalog, asymmetric editorial, modular utility, horizontal narrative, or restrained single-column), then derive section order and proportions from it. Include services and the engagement engine, but do NOT default to hero → card grid → alternating image/text bands → centered CTA.
7. Build EVERY required path with the same header/footer. Services page: deep coverage of every service. Contact: tel:/mailto: + hours/address + optional second widget mount — never an HTML form. Use ALL intakePages + services copy; sharpen, don't invent.
8. Motion: one deliberate CSS moment (load or signature reveal). Respect prefers-reduced-motion. Excess animation is an AI tell.
9. Quality floor (do not announce): responsive ~768/~420, visible :focus, WCAG AA contrast, performance-conscious (no decorative assets that cost load without purpose).

# Non-negotiables (brief cannot remove these)

SERVICES — include every intake service from context.services${
    services.length
      ? `: ${services.join('; ')}`
      : ' (use titles in context.services)'
  }. Feature on home + real coverage on services (or equivalent). You MUST also add every service listed under REQUIRED SERVICE ADDS / servicesToAdd in the optimized brief (e.g. Vehicle Wrapping when the admin seed mentions wrapping) — feature them on home + services pages AND list them in serviceUpdates.added. Do NOT drop intake services unless the brief explicitly removes/replaces them — then serviceUpdates.removed with a short reason citing the brief. Never invent unrelated services the brief did not mention. Meta seeds like "write a prompt for a wrapping shop…" still count as naming those services.

ENGAGEMENT ENGINE — this site uses "${engagementLabel}" (${engagementModel}). Embed EXACTLY this HTML comment on home (literal, no attributes):
  ${WIDGET_PLACEHOLDER}
Place it in the conversion / estimate / book / order section; optional repeat on contact. Mount must be transparent/flush — never background, border, box-shadow, or heavy padding on the element holding the comment (widget paints its own card). Map any brief "quote estimator" / "book a bay" / multi-step form onto this band + tel CTA — do NOT emit HTML forms.

INTAKE — ship EXACTLY these paths as page keys (no inventing /reviews or /areas): ${opts.pageHints}. Nav hrefs MUST use those exact paths (Reviews label → /testimonials, Areas → /service-areas). Preserve client facts from intakePages / about / seo.

# Platform (violations are stripped and break the site)

- Body HTML only (no html/head/body wrappers). Semantic header/nav/main/section/footer.
- STRIPPED: script, iframe, object, embed, form, on* attributes, javascript: URLs. There is NO JavaScript.
- CSS scoped at render. No @import. @media, @keyframes, @font-face OK.
- FIRST node of every page html: <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=...&display=swap">
- Images: ONLY https URLs from context (attachedAssetUrls, services, intakePages, mediaLibrary). Never invent URLs.
- Root-relative internal links matching page keys.

ALLOWED CSS-only interactivity: :hover/:focus-within, sticky nav, scroll-behavior, transitions/keyframes, details/summary, :target or checkbox+sibling tabs/filters, static before/after image pairs when two real photo URLs exist. FORBIDDEN: script, on*, form, range sliders, JS painters, multi-step quote/booking wizards.

${
  attachedAssetUrls.length
    ? `ATTACHED CDN ASSETS (already uploaded — use these EXACT https URLs in HTML when the brief asks for a hero/photo; object-fit:contain or cover so the whole subject stays in view; do not invent other image URLs for those placements):\n${attachedAssetUrls.map((u, i) => `${i + 1}. ${u}`).join('\n')}`
    : hasImages || attachmentsAreReferenceOnly
      ? `REFERENCE-ONLY ATTACHMENTS — vision/context only. Use them to understand the request, visual problem, subject, or desired feel. The admin did NOT explicitly ask to place these files on the site: do not insert, embed, upload, publish, or reproduce them in page HTML/CSS, and do not choose a visually similar mediaLibrary URL as a substitute.`
      : ''
}

MULTI-PASS: This run builds the site in multiple model calls (home first, then one page at a time). Match shared chrome/CSS across pages. Never invent paths outside: ${opts.pageHints}.`

  const paletteLine = enhanced.palette
    .map((p) => `${p.role} ${p.hex}`)
    .join(', ')
  const takenRhythms = describeTakenSkeletons(opts.avoidList)
  const rhythmLock = takenRhythms
    ? `\n- Home section rhythm MUST NOT match any of these (already shipped): ${takenRhythms}`
    : ''
  const directionBlock = seedEmpty || enhanced.inventedFromIntake
    ? `SELF-AUTHORED DESIGN DIRECTION PROMPT:
${enhanced.optimizedBrief}

DIRECTION LOCK:
- Signature: ${enhanced.signatureConcept}
- Material world: ${enhanced.materialWorld}
- Palette: ${paletteLine || '(see self-authored prompt)'}
- Type: ${enhanced.typography.display} + ${enhanced.typography.body}
- Signature element: ${enhanced.signatureElement}
- Copy register: ${enhanced.copyRegister}
- Validated design system: ${JSON.stringify(enhanced.designSystem)}
- Avoid: ${enhanced.avoidDefaults.join('; ') || 'AI default clusters'}
- Services to add: ${
        enhanced.servicesToAdd.length
          ? enhanced.servicesToAdd.join(' | ')
          : '(none — keep intake services only)'
      }${rhythmLock}`
    : `ADMIN SEED:
${adminBrief}

OPTIMIZED CREATIVE BRIEF:
${enhanced.optimizedBrief}

DIRECTION LOCK:
- Signature: ${enhanced.signatureConcept}
- Material world: ${enhanced.materialWorld}
- Palette: ${paletteLine || '(see optimized brief)'}
- Type: ${enhanced.typography.display} + ${enhanced.typography.body}
- Signature element: ${enhanced.signatureElement}
- Copy register: ${enhanced.copyRegister}
- Validated design system: ${JSON.stringify(enhanced.designSystem)}
- Avoid: ${enhanced.avoidDefaults.join('; ') || 'AI default clusters'}
- Services to add: ${
        enhanced.servicesToAdd.length
          ? enhanced.servicesToAdd.join(' | ')
          : '(none unless ADMIN SEED names them)'
      }${rhythmLock}`

  const extraWarnings: string[] = [
    resumeLocked
      ? 'Resumed locked creative brief from prior checkpoint (direction unchanged).'
      : seedEmpty || enhanced.inventedFromIntake
        ? `Empty admin seed — invented a full design-direction prompt from intake + design system (${enhanced.source}), then executed it.`
        : `Creative brief enhanced from your prompt + intake (${enhanced.source}) before generation — palette/type/signature locked for bespoke, non-AI look.`,
    'Full redesign runs multi-pass (home, then each page) with draft checkpoints so Graphile retries can resume.',
  ]
  if (!hasBrief) {
    extraWarnings.push(
      'No admin text or reference image — self-authored direction used studio design-system rules + intake facts. Add a short seed next time to steer.'
    )
  }

  async function modelJson(args: {
    systemPrompt: string
    userPrompt: string
    maxOutputTokens: number
    abortMs: number
    temperature?: number
    withImages?: boolean
  }): Promise<Record<string, unknown>> {
    try {
      return await callModelJson({
        systemPrompt: args.systemPrompt,
        userPrompt: args.userPrompt,
        temperature: args.temperature ?? 0.7,
        maxOutputTokens: args.maxOutputTokens,
        preferredProvider: useClaude ? 'anthropic' : undefined,
        anthropicModel: CLAUDE_SONNET_MODEL,
        images: args.withImages ? opts.images : undefined,
        abortMs: args.abortMs,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/timed out|terminated/i.test(msg) && process.env.GEMINI_API_KEY) {
        console.warn('[runFullGenerate] primary model failed — Gemini fallback:', msg)
        extraWarnings.push(`Pass fell back to Gemini after: ${msg.slice(0, 120)}`)
        return await callModelJson({
          systemPrompt: args.systemPrompt,
          userPrompt: args.userPrompt,
          temperature: 0.65,
          maxOutputTokens: args.maxOutputTokens,
          preferredProvider: 'gemini',
          images: args.withImages ? opts.images : undefined,
        })
      }
      throw err
    }
  }

  const report = async (
    pass: string,
    draftCfg: CustomSiteConfig,
    replyText?: string,
    extras?: {
      serviceUpdates?: ServiceUpdates
      foundationReply?: string
    }
  ) => {
    const passesDone = passesDoneFromDraft(opts.requiredPaths, draftCfg)
    await opts.onProgress?.({
      pass,
      passesDone,
      requiredPaths: opts.requiredPaths,
      reply: replyText,
      lockedBrief: lockedBriefForJob,
      serviceUpdates: extras?.serviceUpdates,
      foundationReply: extras?.foundationReply,
    })
  }

  const checkpoint = async (draftCfg: CustomSiteConfig) => {
    await opts.onCheckpoint?.(
      dropEmptyCustomPages(
        applyPathAliasesToCustomConfig(sanitizeCustomConfig(draftCfg))
      )
    )
  }

  // ── design guard ──────────────────────────────────────────────────────────
  // Ordering is the whole safety argument: every guard runs AFTER the checkpoint
  // that makes a page "done" for remainingFullRedesignPaths. A crash mid-repair
  // therefore leaves the raw page checkpointed, the resume correctly skips it,
  // and the finalize scan still catches whatever was not repaired.
  const guardStartedAt = Date.now()
  const briefTextForScan = `${adminBrief}\n${enhanced.optimizedBrief}`
  const unresolvedTells: DesignTellFinding[] = []

  const repairBudgetLeft = () => Date.now() - guardStartedAt < REPAIR_CUTOFF_MS

  const noteUnresolved = (findings: DesignTellFinding[]) => {
    for (const f of findings) {
      if (f.severity !== 'error') continue
      if (unresolvedTells.some((u) => u.code === f.code && u.unitId === f.unitId)) continue
      unresolvedTells.push(f)
    }
  }

  /**
   * Scan the units just produced and, if something blocking is there, ask the
   * model for those units back with the exact violations named. Returns the
   * draft — repaired if the repair was accepted, unchanged otherwise.
   */
  const runGuard = async (
    label: string,
    draftCfg: CustomSiteConfig,
    units: RepairUnits,
    findings: DesignTellFinding[]
  ): Promise<CustomSiteConfig> => {
    const blocking = findings.filter((f) => f.severity === 'error')
    if (blocking.length === 0) return draftCfg

    if (!repairBudgetLeft()) {
      noteUnresolved(blocking)
      extraWarnings.push(
        `Design guard (${label}): ${blocking.length} issue(s) left unrepaired — repair budget for this run is spent.`
      )
      return draftCfg
    }

    const scan = (candidate: RepairUnits) =>
      toUnitQualityReport(
        Object.entries(candidate).flatMap(([unitId, content]) => {
          const path = unitId.startsWith('html:') ? unitId.slice('html:'.length) : null
          const scanned = path
            ? scanUnitTells(path, { html: content }, { briefText: briefTextForScan })
            : scanArtifactTells({
                globalCss: content,
                pages: {},
                briefText: briefTextForScan,
              })
          // Re-key onto repair unit ids so failedUnitIds addresses real units.
          return scanned.map((f) => ({ ...f, unitId: repairUnitIdForFinding(f.unitId) }))
        })
      )

    try {
      const repair = await repairDesignTells({
        units,
        findings,
        brandName: opts.brandName,
        directionBlock,
        pageHints: opts.pageHints,
        callModel: modelJson,
        scan,
        maxRetries: MAX_REPAIR_ATTEMPTS_PER_UNIT,
      })
      extraWarnings.push(...repair.warnings)
      if (repair.repairedUnitIds.length > 0) {
        console.info('[runFullGenerate] design repair', label, repair.repairedUnitIds.join(','))
      }
      const stillFailing = findings.filter(
        (f) =>
          f.severity === 'error' &&
          repair.report.failedUnitIds.includes(repairUnitIdForFinding(f.unitId))
      )
      noteUnresolved(stillFailing)
      return repair.repairedUnitIds.length > 0
        ? applyRepairedUnits(draftCfg, repair.units)
        : draftCfg
    } catch (err) {
      // A repair failure must never fail the build — the draft is already
      // checkpointed and the publish gate will still catch what survived.
      const msg = err instanceof Error ? err.message : String(err)
      console.warn('[runFullGenerate] design repair failed', label, msg)
      extraWarnings.push(`Design repair pass (${label}) failed: ${msg.slice(0, 140)}`)
      noteUnresolved(blocking)
      return draftCfg
    }
  }

  let draft: CustomSiteConfig =
    opts.existingDraft && isCustomSiteConfig(opts.existingDraft)
      ? dropEmptyCustomPages(applyPathAliasesToCustomConfig(opts.existingDraft))
      : emptyFullRedesignDraft(opts.mode)

  let serviceUpdates = parseServiceUpdates(
    opts.resumeState?.serviceUpdates ?? undefined
  )
  let foundationReply =
    typeof opts.resumeState?.foundationReply === 'string'
      ? opts.resumeState.foundationReply
      : ''
  const remaining = () => remainingFullRedesignPaths(opts.requiredPaths, draft)

  // —— Pass: foundation (globalCss + home) ——————————————
  if (remaining().includes('/')) {
    await report('foundation:/', draft)
    const foundationSystem = `${systemPrompt}

# This call — FOUNDATION ONLY
Output ONLY valid JSON:
{
  "mode": "${opts.mode}",
  "globalCss": "shared CSS (:root tokens + shared components, ≤9000 chars)",
  "pages": {
    "/": { "html": "full home body HTML ≤12000 chars", "css": "optional", "title": "SEO title", "description": "meta" }
  },
  "serviceUpdates": {
    "added": [{ "title": "Brief-added service", "description": "optional" }],
    "removed": [{ "title": "Only if brief explicitly removes", "reason": "cite brief" }]
  },
  "reply": "3-5 sentences: signature concept + confirm services + ${engagementLabel}"
}
Do NOT emit other page keys in this call — later passes build them.`

    const foundationUser = `Full redesign FOUNDATION for "${opts.brandName}".

${directionBlock}

KEEP ALWAYS:
- Engagement: ${engagementLabel} (${engagementModel}) — mount ${WIDGET_PLACEHOLDER} on home conversion section.
- Intake services: ${services.length ? services.join(' | ') : '(see context.services)'}
- Site nav must link exactly to: ${opts.pageHints} (Reviews label → /testimonials, Areas → /service-areas)

BUSINESS CONTEXT:
${JSON.stringify(opts.context)}

Build globalCss + home "/" only. Output JSON.`

    const parsed = await modelJson({
      systemPrompt: foundationSystem,
      userPrompt: foundationUser,
      maxOutputTokens: useClaude ? 16000 : 24576,
      abortMs: 420_000,
      withImages: true,
    })

    const homePage =
      parsed.pages &&
      typeof parsed.pages === 'object' &&
      !Array.isArray(parsed.pages)
        ? (parsed.pages as CustomSiteConfig['pages'])['/'] ||
          (parsed.pages as CustomSiteConfig['pages'])['']
        : undefined
    if (!isUsableCustomPageHtml(homePage?.html)) {
      throw new Error(
        'Foundation pass returned no usable home HTML — retry Full redesign.'
      )
    }

    // Merge home into existing pages — do not wipe sibling checkpoints if
    // home was empty but other paths were already done.
    draft = mergePageIntoDraft(
      {
        ...draft,
        mode: parsed.mode === 'iframe' ? 'iframe' : opts.mode,
        globalCss:
          typeof parsed.globalCss === 'string' && parsed.globalCss.trim()
            ? parsed.globalCss
            : draft.globalCss,
      },
      '/',
      homePage!,
      typeof parsed.globalCss === 'string' ? parsed.globalCss : draft.globalCss
    )
    serviceUpdates = parseServiceUpdates(parsed.serviceUpdates)
    const modelReply =
      typeof parsed.reply === 'string' && parsed.reply.trim()
        ? parsed.reply.trim()
        : 'Foundation (home + design system) ready — building remaining pages…'
    foundationReply =
      seedEmpty || enhanced.inventedFromIntake
        ? `Self-authored design direction (${enhanced.source}): ${enhanced.signatureConcept}\n\n${enhanced.optimizedBrief.slice(0, 900)}${enhanced.optimizedBrief.length > 900 ? '…' : ''}\n\n${modelReply}`
        : `Optimized direction (${enhanced.source}): ${enhanced.signatureConcept}\n\n${modelReply}`

    await checkpoint(draft)
    await report('foundation:/', draft, foundationReply, {
      serviceUpdates,
      foundationReply,
    })
    console.info('[runFullGenerate] checkpoint home')

    // Guard the foundation. This is the highest-leverage point: globalCss and
    // the home layout set the design every later page inherits, so a tell fixed
    // here is a tell that never reaches the rest of the site.
    const homeHtml = draft.pages['/']?.html || draft.pages['']?.html || ''
    const foundationFindings = scanArtifactTells({
      globalCss: draft.globalCss || '',
      pages: { '/': { html: homeHtml } },
      briefText: briefTextForScan,
      businessName: opts.brandName,
    })
    const guarded = await runGuard(
      'foundation',
      draft,
      {
        [unitIdForGlobalCss()]: draft.globalCss || '',
        [unitIdForPage('/')]: homeHtml,
      },
      foundationFindings
    )
    if (guarded !== draft) {
      draft = guarded
      await checkpoint(draft)
      await report('foundation:repair', draft, foundationReply, {
        serviceUpdates,
        foundationReply,
      })
    }
  } else {
    foundationReply =
      foundationReply ||
      'Resuming Full redesign — home already checkpointed; filling remaining pages.'
    await report('resume', draft, foundationReply, {
      serviceUpdates,
      foundationReply,
    })
    console.info(
      '[runFullGenerate] resume — skip home; remaining',
      remaining().join(',')
    )
  }

  // —— Passes: one remaining page at a time ——————————————
  const chrome = extractChromeSample(
    draft.pages['/']?.html || draft.pages['']?.html || ''
  )
  for (const path of remaining()) {
    await report(path, draft, foundationReply)
    const intakePage = Array.isArray(opts.context.intakePages)
      ? (opts.context.intakePages as Array<Record<string, unknown>>).find((p) => {
          const slug = typeof p.slug === 'string' ? p.slug : ''
          return normalizeCustomPath(slug) === path
        })
      : undefined

    const pageSystem = `${systemPrompt}

# This call — SINGLE PAGE ${path}
Reuse the locked design system. Match header/footer chrome from the sample.
Output ONLY valid JSON:
{
  "pages": {
    "${path}": { "html": "full page body HTML ≤7000 chars", "css": "optional", "title": "SEO title", "description": "meta" }
  },
  "reply": "one sentence confirming what this page covers"
}
Emit only "${path}" — no other pages, no globalCss.`

    const pageUser = `Build page "${path}" for "${opts.brandName}".

${directionBlock}

LOCKED globalCss (do not redefine; pages link the same fonts via <link> as home):
${(draft.globalCss || '').slice(0, 6000)}

CHROME SAMPLE (match structure/classes/nav hrefs):
${chrome || '(see home facts in context)'}

INTAKE PAGE CONTENT for ${path}:
${JSON.stringify(intakePage || { slug: path, note: 'no intake block — use brand/seo/services facts only' })}

SITE PATHS (nav hrefs must use these exact paths): ${opts.pageHints}
SERVICES: ${services.length ? services.join(' | ') : '(context.services)'}
ENGAGEMENT: ${engagementLabel} — optional second ${WIDGET_PLACEHOLDER} on /contact only.

BUSINESS CONTEXT (compact):
${JSON.stringify({
  brandName: opts.brandName,
  seo: opts.context.seo,
  services: opts.context.services,
  attachedAssetUrls: opts.context.attachedAssetUrls,
  mediaLibrary: Array.isArray(opts.context.mediaLibrary)
    ? (opts.context.mediaLibrary as unknown[]).slice(0, 12)
    : [],
})}

Output JSON for ${path} only.`

    const parsed = await modelJson({
      systemPrompt: pageSystem,
      userPrompt: pageUser,
      maxOutputTokens: useClaude ? 10000 : 16384,
      abortMs: 300_000,
      withImages: false,
      temperature: 0.65,
    })

    const pagesObj =
      parsed.pages && typeof parsed.pages === 'object' && !Array.isArray(parsed.pages)
        ? (parsed.pages as CustomSiteConfig['pages'])
        : {}
    const pageArt = pagesObj[path] || pagesObj[path.replace(/^\//, '')]
    if (!isUsableCustomPageHtml(pageArt?.html)) {
      throw new Error(
        `Page pass ${path} returned empty HTML — earlier pages remain checkpointed for Graphile resume.`
      )
    }

    draft = mergePageIntoDraft(draft, path, pageArt!, draft.globalCss)
    await checkpoint(draft)
    await report(path, draft, foundationReply)
    console.info('[runFullGenerate] checkpoint', path)

    // Guard this page. scanUnitTells deliberately skips globalCss-owned and
    // whole-site codes, so a page is never blamed — or regenerated — for a
    // palette or a missing font link it does not own.
    const pageFindings = scanUnitTells(
      path,
      { html: pageArt!.html || '' },
      { briefText: briefTextForScan, businessName: opts.brandName }
    )
    const guardedPage = await runGuard(
      path,
      draft,
      { [unitIdForPage(path)]: pageArt!.html || '' },
      pageFindings
    )
    if (guardedPage !== draft) {
      draft = guardedPage
      await checkpoint(draft)
      await report(`${path}:repair`, draft, foundationReply)
    }
  }

  const added = serviceUpdates.added ?? (serviceUpdates.added = [])
  const extracted = extractServicesNamedInBrief(adminBrief, services)
  const requiredAdds = [
    ...enhanced.servicesToAdd.map((title) => ({ title })),
    ...extracted,
  ]
  for (const row of requiredAdds) {
    const title = row.title.trim()
    if (!title) continue
    if (!added.some((s) => s.title.toLowerCase() === title.toLowerCase())) {
      added.push({
        title,
        description:
          'description' in row && typeof row.description === 'string'
            ? row.description
            : undefined,
      })
    }
  }

  const pages = { ...draft.pages }
  const injectedTitles: string[] = []
  for (const key of Object.keys(pages)) {
    const isHome = key === '/' || key === ''
    const isServices = /service/i.test(key)
    if (!isHome && !isServices) continue
    const page = pages[key]
    if (!page?.html) continue
    const missing = added.filter(
      (s) => s.title && !htmlMentionsService(page.html || '', s.title)
    )
    if (!missing.length) continue
    const withDesc = missing.map((s) => ({
      title: s.title,
      description:
        s.description ||
        extracted.find((e) => e.title.toLowerCase() === s.title.toLowerCase())
          ?.description ||
        `${s.title} offered by this business.`,
    }))
    pages[key] = {
      ...page,
      html: injectMissingServicesIntoHtml(page.html || '', withDesc),
    }
    for (const m of withDesc) {
      if (!injectedTitles.includes(m.title)) injectedTitles.push(m.title)
    }
  }
  if (injectedTitles.length) {
    extraWarnings.push(
      `Injected brief-added services into redesign HTML: ${injectedTitles.join(', ')}.`
    )
  }

  draft = { ...draft, pages }

  // ── finalize guard ────────────────────────────────────────────────────────
  // Whole-artifact scan: catches the codes a per-unit scan cannot judge (tone
  // balance across pages, the missing fonts link) and anything the service
  // injection above just introduced.
  const finalFindings = scanArtifactTells({
    globalCss: draft.globalCss || '',
    pages: draft.pages,
    briefText: briefTextForScan,
    businessName: opts.brandName,
  })
  noteUnresolved(finalFindings)

  // Uniqueness uses the complete visual system. Reordering sections is not
  // enough when palette, typography, geometry and recurring motifs still make
  // the result look like the same template.
  let fingerprint = extractCustomDesignFingerprint(draft)
  let collisions = findDesignCollisions(fingerprint, opts.avoidList.taken)
  if (collisions.length > 0 && repairBudgetLeft()) {
    const homeHtml = draft.pages['/']?.html || draft.pages['']?.html || ''
    const reshaped = await runGuard(
      'uniqueness',
      draft,
      { [unitIdForPage('/')]: homeHtml },
      [
        {
          code: 'design_duplicate_visual',
          unitId: '/',
          severity: 'error',
          message: `This redesign is visually too similar to another design already on the platform${
            collisions[0].signatureConcept ? ` ("${collisions[0].signatureConcept}")` : ''
          }.`,
          fix: 'Rebuild the home with a different composition family, typography pairing, palette relationship, geometry and signature motif. Preserve business facts, services, links and widget mount, but do not merely reorder the same sections.',
          samples: [`visual similarity ${collisions[0].score.toFixed(2)}`],
        },
      ]
    )
    if (reshaped !== draft) {
      draft = reshaped
      await checkpoint(draft)
      fingerprint = extractCustomDesignFingerprint(draft)
      collisions = findDesignCollisions(fingerprint, opts.avoidList.taken)
    }
  }
  if (collisions.length > 0) {
    extraWarnings.push(
      `Visual design still resembles ${collisions.length} prior redesign(s) on the platform — ${
        UNIQUENESS_ENFORCEMENT === 'block'
          ? 'publish will be blocked until it differs.'
          : 'review before publishing.'
      }`
    )
  }
  if (unresolvedTells.length > 0) {
    extraWarnings.push(
      `Design guard: ${unresolvedTells.length} issue(s) survived repair — ${unresolvedTells
        .slice(0, 3)
        .map((f) => `${f.unitId} ${f.code}`)
        .join(', ')}.`
    )
  }

  // Register this design so the next tenant's avoid-list knows about it. Draft
  // status: it is not live yet, but a draft still occupies a direction and a
  // concurrent build should be told so. Non-fatal by construction.
  await recordCustomDesignFingerprint({
    supabase: getSupabaseAdmin(),
    tenantId: opts.tenantId,
    status: 'draft',
    config: draft,
    signatureConcept: enhanced.signatureConcept,
    industryKey:
      typeof opts.context.designIndustryKey === 'string'
        ? opts.context.designIndustryKey
        : null,
    marketKey:
      typeof opts.context.designMarketKey === 'string'
        ? opts.context.designMarketKey
        : null,
  })
  if (directionReservation) {
    await consumeDesignDirectionReservation(
      getSupabaseAdmin(),
      directionReservation.id
    )
  }

  const configOut = finalizeFullRedesignDraft(draft, opts.requiredPaths)
  await checkpoint(configOut)
  await report('finalize', configOut, foundationReply)

  const reply =
    foundationReply ||
    'Custom draft generated across multiple passes. Preview it, then publish when ready.'

  return {
    config: configOut,
    reply,
    changedPages: Object.keys(configOut.pages),
    serviceUpdates,
    extraWarnings,
    inventedBrief:
      seedEmpty || enhanced.inventedFromIntake
        ? {
            signatureConcept: enhanced.signatureConcept,
            optimizedBrief: enhanced.optimizedBrief,
            source: enhanced.source,
          }
        : undefined,
  }
}


async function runSurgicalOpsGenerate(opts: {
  brandName: string
  prompt: string
  mode: 'inline' | 'iframe'
  base: CustomSiteConfig
}): Promise<{
  config: CustomSiteConfig
  reply: string
  changedPages: string[]
  extraWarnings: string[]
}> {
  const digest = buildPageDigest(opts.base.pages)
  const systemPrompt = `You are the world's top notch designer and web engineer. You consult with all kinds of industries including healthcare, big tech companies, trading companies, top social media site, publish companies, to name a few, and you know the ins and outs of AWESOME bespoke designs and terrible ones. Ensure that any edits are completely free from any AI-ish tells and look like the client paid a $1 billionaire for it - designed by a top notch designer/software engineer and architect on the planet. You emit ONLY a small list of DOM ops — never full page HTML.

Output ONLY valid JSON (no markdown fences):
{
  "reply": "1-2 sentences describing the ops",
  "ops": [
    { "op": "replaceText", "find": "Old", "replace": "New", "scope": "all" },
    { "op": "setAttr", "selector": "a.cta", "attr": "href", "value": "/contact" },
    { "op": "setHtml", "selector": "h1.hero-title", "html": "New headline" },
    { "op": "appendCss", "css": ".x{color:red}" }
  ]
}

Allowed ops only: replaceText, setAttr, setHtml, appendCss, wrap, unwrap.
Hard rules:
1. Max 20 ops. Prefer replaceText / setAttr. Use setHtml only for a single small node (under 4000 chars).
2. Never invent redesigns. Apply ONLY the admin request.
3. Do NOT return pages HTML. Do NOT replace globalCss wholesale — use appendCss for additive rules only.
4. find/replace strings must match the digest text exactly (case-insensitive apply is fine).
5. If you cannot identify a concrete edit, return { "reply": "…need specifics…", "ops": [] }.
6. NEVER output spec-sheet metadata, artificial reference codes (e.g. "DOC: INQ-LOG", "REV: 2024", "REF: 01 / 02"), or code comment syntax ("//") in public UI content.`

  const userPrompt = `Surgical op-list edit for "${opts.brandName}".

Admin request:
${opts.prompt}

Page digest (path, headings, text excerpt, sample hrefs) — source of truth for find strings:
${JSON.stringify(digest, null, 2)}`

  const parsed = await callModelJson({
    systemPrompt,
    userPrompt,
    temperature: 0.2,
    maxOutputTokens: 4096,
    useSurgicalProviderChain: true,
    anthropicModel: CLAUDE_SONNET_MODEL,
  })

  const { ops, errors: parseErrors } = parseSurgicalOps(parsed.ops)
  const modelReply =
    typeof parsed.reply === 'string' ? parsed.reply.trim() : ''

  if (!ops.length) {
    return {
      config: opts.base,
      reply:
        modelReply ||
        'No structured edits produced — please specify exact text to change or a selector.',
      changedPages: [],
      extraWarnings: [
        'Surgical ops path produced no valid ops — draft unchanged.',
        ...parseErrors,
      ],
    }
  }

  const applied = applyOpsToConfig(opts.base, ops)
  if (applied.hits === 0 || applied.changedPages.length === 0) {
    // appendCss-only still counts as a change
    const cssOnly =
      applied.globalCssAppend &&
      applied.changedPages.length === 0 &&
      applied.hits > 0
    if (!cssOnly) {
      return {
        config: opts.base,
        reply:
          'Model returned ops but none matched the live HTML — draft left unchanged. Try quoting exact on-page text.',
        changedPages: [],
        extraWarnings: [
          'Surgical ops executor reported zero hits.',
          ...parseErrors,
        ],
      }
    }
  }

  const patch: SurgicalPatch = {
    pages: {},
    globalCssAppend: applied.globalCssAppend,
    reply: modelReply || undefined,
  }
  for (const path of applied.changedPages) {
    const page = applied.config.pages[path]
    if (!page) continue
    patch.pages![path] = { html: page.html }
  }

  const allowFullCssReplace = looksLikeExplicitGlobalRestyle(opts.prompt)
  const { merged, changedPages, warnings: cssWarnings } = mergeCustomPatch(
    opts.base,
    patch,
    { allowFullCssReplace }
  )
  // If appendCss applied but merge didn't see page html changes, ensure CSS lands.
  if (
    applied.globalCssAppend &&
    (merged.globalCss || '') === (opts.base.globalCss || '')
  ) {
    const cssMerged = mergeSurgicalGlobalCss({
      baseCss: opts.base.globalCss || '',
      globalCssAppend: applied.globalCssAppend,
      allowFullCssReplace: false,
    })
    merged.globalCss = cssMerged.globalCss
  }
  merged.mode = opts.mode

  const integrity = assertSurgicalIntegrity(opts.base, merged)
  applySurgicalIntegrityRepairs(merged, integrity)

  let finalChanged = changedPages.filter((p) => {
    if (p === '(globalCss)') {
      return (merged.globalCss || '') !== (opts.base.globalCss || '')
    }
    return (
      (merged.pages[p]?.html || '') !== (opts.base.pages[p]?.html || '') ||
      (merged.pages[p]?.css || '') !== (opts.base.pages[p]?.css || '') ||
      (merged.pages[p]?.title || '') !== (opts.base.pages[p]?.title || '') ||
      (merged.pages[p]?.description || '') !==
        (opts.base.pages[p]?.description || '')
    )
  })
  if (
    (merged.globalCss || '') !== (opts.base.globalCss || '') &&
    !finalChanged.includes('(globalCss)')
  ) {
    finalChanged = [...finalChanged, '(globalCss)']
  }

  const extraWarnings: string[] = [...cssWarnings, ...integrity.warnings, ...parseErrors]
  let reply =
    modelReply ||
    (finalChanged.length
      ? `Applied ${ops.length} structured op(s) on ${finalChanged.join(', ')}.`
      : 'No pages changed.')

  if (finalChanged.length === 0) {
    extraWarnings.push('Surgical ops edit produced no page changes — draft unchanged.')
    if (/\b(updated|changed|replaced|fixed|renamed)\b/i.test(reply)) {
      reply =
        'Ops claimed changes but nothing matched the live HTML — draft left unchanged.'
    }
  }

  return {
    config: merged,
    reply,
    changedPages: finalChanged,
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
  const attachedUrls = Array.isArray(opts.context.attachedAssetUrls)
    ? (opts.context.attachedAssetUrls as unknown[]).filter(
        (u): u is string => typeof u === 'string' && /^https?:\/\//i.test(u)
      )
    : []
  const attachmentsAreReferenceOnly = opts.context.attachmentsAreReferenceOnly === true
  const mediaOrHeroSwap =
    hasImages ||
    attachedUrls.length > 0 ||
    looksLikeHeroImageSurgicalRequest(opts.prompt || '') ||
    looksLikeVideoSurgicalRequest(opts.prompt || '')
  const systemPrompt = `You are the world's top notch designer and web engineer. You consult with all kinds of industries including healthcare, big tech companies, trading companies, top social media site, publish companies, to name a few, and you know the ins and outs of AWESOME bespoke designs and terrible ones. Ensure that your edits are completely free from any AI-ish tells and look like the client paid a $1 billionaire for it - designed by a top notch designer/software engineer and architect on the planet. You make SURGICAL edits to an existing custom HTML/CSS site.

The admin already has a finished design. Your job is to apply ONLY what they asked for.

Output ONLY valid JSON matching this schema (no markdown fences):
{
  "intent": "surgical",
  "reply": "1-3 sentences describing exactly what you changed",
  "globalCss": null,
  "globalCssAppend": null,
  "pages": {
    "/": { "html": "ONLY if this page's HTML must change", "css": null, "title": null, "description": null }
  },
  "unchangedPages": ["/about", "/services"]
}

Hard rules:
1. Apply ONLY the admin's request. Do NOT redesign, restyle, rebrand, or restructure unless they explicitly asked for that.
2. PRESERVE layout, structure, CSS classes, colors, navigation, and the widget placeholder (${WIDGET_PLACEHOLDER}) unless asked to change them. Imagery is preserved UNLESS the admin asked to change a hero/photo/background — then you MUST replace that media URL.
3. Prefer text/copy edits inside existing markup — swap wording, keep the same tags and classes. For hero/image swaps, keep the same section markup and only change the image URL + background-size/object-fit as requested.
4. Return ONLY pages you actually changed under "pages". List every untouched path in "unchangedPages".
5. Set "globalCss" to null unless they explicitly asked to restyle site-wide CSS. For small additive rules (e.g. .clickable-card), use "globalCssAppend" (string) or page-level "css" — NEVER replace the whole stylesheet with a snippet. For service-card side drawers in inline mode, use CSS-only checkbox + label (no <script>, no javascript:, no ?service= query hacks). For image enlarge/lightbox requests, wrap EVERY content <img> (especially /portfolio) in <label class="img-lightbox"><input type="checkbox" class="lightbox-toggle"><img …></label> and append lightbox CSS — do not stop after Process/Financing.
6. If a page is unchanged, omit it from "pages" entirely (do not echo the full original HTML).
7. mode stays "${opts.mode}". Do not change render mode.
8. HTML is BODY CONTENT ONLY. No <script> in inline mode. No javascript: URLs. Keep existing class= attributes and <header>/<nav>/<footer> landmarks. Inline event handlers are stripped on render.
9. ${
    mediaOrHeroSwap
      ? 'For hero/image/video edits you MAY return the full home-page html (up to ~20000 characters) so the media URL lands correctly. JSON must still be complete and valid.'
      : 'Keep each returned html under ~2500 characters for text-only edits. JSON must be complete and valid.'
  }
10. If the request is ambiguous ("make it nicer") and does not specify what to change, set pages to {} and explain in reply that you need a more specific instruction — do NOT invent a redesign.
11. When the admin asks to add/embed a video (or says they don't see the video), use a URL from mediaLibrary in the business context — do NOT ask them to paste a URL that is already listed there. Insert a <video controls><source src="URL" type="video/mp4"></video> block after the hero on "/".
12. ${HUMAN_COPY_VOICE_RULES_SURGICAL}
${
  attachedUrls.length
    ? `13. ATTACHED IMAGES: the admin attached image(s). Prefer context.attachedAssetUrls / mediaLibrary https URLs — those are already on the CDN and MUST be used verbatim when placing the image on the site (hero, section, etc.). Use vision to understand crop/composition; keep the whole subject visible (background-size:contain / object-fit:contain, or carefully framed cover when they ask to fill). Do not invent other image URLs for those placements.`
    : hasImages || attachmentsAreReferenceOnly
      ? `13. REFERENCE-ONLY ATTACHMENTS: use the attached files only to understand the request, visual problem, subject, or desired direction. The admin did NOT explicitly ask to place them on the site. Do not insert, embed, upload, publish, or reproduce them in HTML/CSS, and do not replace existing site imagery because attachments were provided.`
    : ''
}
14. NO SPEC SHEET TAGS OR DECORATIVE COUNTERS: NEVER output artificial reference tags, spec sheet codes, engineering document markers, or standalone zero-padded counters like "01 / 02 / 03", "Step 01", "DOC: INQ-LOG", "REV: 2024", "DOC. REF:", "Case File", "System Spec //", "FIG 1", or programming comment syntax ("//") on public UI content. Processes should communicate order through semantic structure, titles, spacing, or connectors. Show numbers only when visitors must refer to them or they communicate supplied facts. Badges and labels must be natural, human, and industry-appropriate.`

  const attachedBlock = attachedUrls.length
    ? `ATTACHED CDN ASSET URLS (use these exact https URLs when placing images):\n${attachedUrls
        .map((u, i) => `${i + 1}. ${u}`)
        .join('\n')}\n\n`
    : ''

  const userPrompt = `Surgical edit for "${opts.brandName}".

${attachedBlock}Admin request (apply ONLY this):
${opts.prompt || 'No specific change requested. Treat any attachments as reference-only, return an empty pages object, and ask what should change.'}

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
    // Surgical only: Gemini → OpenAI → Anthropic (credits / API failures).
    useSurgicalProviderChain: true,
    anthropicModel: CLAUDE_SONNET_MODEL,
    images: opts.images,
  })

  const patch: SurgicalPatch = {
    globalCss:
      typeof parsed.globalCss === 'string'
        ? parsed.globalCss
        : parsed.globalCss === null
          ? null
          : undefined,
    globalCssAppend:
      typeof parsed.globalCssAppend === 'string'
        ? parsed.globalCssAppend
        : parsed.globalCssAppend === null
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

  const allowFullCssReplace = looksLikeExplicitGlobalRestyle(opts.prompt)
  const { merged, changedPages, warnings: cssWarnings } = mergeCustomPatch(
    opts.base,
    workingPatch,
    { allowFullCssReplace }
  )
  merged.mode = opts.mode

  const integrity = assertSurgicalIntegrity(opts.base, merged)
  applySurgicalIntegrityRepairs(merged, integrity)

  // Recompute changed pages after integrity reverts
  let finalChanged = changedPages.filter((p) => {
    if (p === '(globalCss)') {
      return (merged.globalCss || '') !== (opts.base.globalCss || '')
    }
    return (merged.pages[p]?.html || '') !== (opts.base.pages[p]?.html || '') ||
      (merged.pages[p]?.css || '') !== (opts.base.pages[p]?.css || '') ||
      (merged.pages[p]?.title || '') !== (opts.base.pages[p]?.title || '') ||
      (merged.pages[p]?.description || '') !== (opts.base.pages[p]?.description || '')
  })
  // Include pages integrity restored (no longer "changed") — already filtered.
  if (
    integrity.repaired.globalCss !== undefined &&
    !finalChanged.includes('(globalCss)') &&
    (merged.globalCss || '') !== (opts.base.globalCss || '')
  ) {
    finalChanged = [...finalChanged, '(globalCss)']
  }

  // Never trust a model "I updated everything" reply when the patch was empty.
  let reply =
    (workingPatch.reply && workingPatch.reply.trim()) ||
    (finalChanged.length
      ? `Updated ${finalChanged.join(', ')} only. Everything else left as-is.`
      : 'No pages changed. Please specify exactly what text or element to edit.')

  const extraWarnings: string[] = [...cssWarnings, ...integrity.warnings]
  if (integrity.issues.length > 0) {
    reply = `Applied safe parts of the edit; blocked ${integrity.issues.length} destructive change(s) that would break layout/CSS. ${extraWarnings[0] || ''}`.trim()
  }
  if (finalChanged.length === 0) {
    extraWarnings.push('Surgical edit produced no page changes — draft unchanged from base.')
    if (
      workingPatch.reply &&
      /\b(updated|changed|replaced|fixed|renamed|restored)\b/i.test(workingPatch.reply)
    ) {
      reply =
        'Model claimed changes but returned no usable page HTML (or changes were blocked by integrity checks) — draft left unchanged.'
      extraWarnings.push(
        'Ignored empty or destructive surgical patch that claimed success.'
      )
    }
  }

  return {
    config: merged,
    reply,
    changedPages: finalChanged,
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
  preferredProvider?: 'anthropic' | 'gemini' | 'openai'
  anthropicModel?: string
  images?: Array<{ mimeType: string; data: string }>
  /** Claude abort budget — Full redesign uses ~500s on the 800s worker. */
  abortMs?: number
  /**
   * Surgical edits only: Gemini → OpenAI → Anthropic across credit/API/JSON failures.
   * Full redesign keeps preferredProvider (Claude-first).
   */
  useSurgicalProviderChain?: boolean
}): Promise<Record<string, unknown>> {
  if (opts.useSurgicalProviderChain) {
    return callSurgicalModelJson(opts)
  }

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
        abortMs: opts.abortMs,
      })
      text = result.text
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/ANTHROPIC_API_KEY|GEMINI_API_KEY|OPENAI_API_KEY|not configured/i.test(msg)) {
        throw new Error(
          'AI is not configured (need ANTHROPIC_API_KEY for Claude Sonnet, or GEMINI_API_KEY as fallback).'
        )
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

/** Surgical-only: walk Gemini → OpenAI → Anthropic; advance on API or bad JSON. */
async function callSurgicalModelJson(opts: {
  systemPrompt: string
  userPrompt: string
  temperature: number
  maxOutputTokens: number
  anthropicModel?: string
  images?: Array<{ mimeType: string; data: string }>
  abortMs?: number
}): Promise<Record<string, unknown>> {
  const chain = configuredSurgicalProviders()
  if (chain.length === 0) {
    throw new Error(
      'AI is not configured for surgical edits (need GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY).'
    )
  }

  let lastText = ''
  let lastErr: unknown = null

  for (let p = 0; p < chain.length; p++) {
    const provider = chain[p]!
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
          preferredProvider: provider,
          anthropicModel: opts.anthropicModel,
          images: opts.images,
          abortMs: opts.abortMs,
        })
        text = result.text
        lastText = text
      } catch (err) {
        lastErr = err
        const msg = err instanceof Error ? err.message : String(err)
        const next = chain[p + 1]
        console.warn(
          `[generateCustomSite] surgical ${provider} API failed (attempt ${attempt + 1})${
            attempt === 0 ? ' — retrying once' : next ? ` — trying ${next}` : ''
          }: ${msg.slice(0, 400)}`
        )
        if (attempt === 0) continue
        break
      }

      try {
        const parsed = parseModelJson(text)
        if (p > 0) {
          console.warn(
            `[generateCustomSite] surgical JSON ok via fallback ${provider} (attempt ${attempt + 1})`
          )
        } else {
          console.info(
            `[generateCustomSite] surgical JSON ok via ${provider} (attempt ${attempt + 1})`
          )
        }
        return parsed
      } catch (err) {
        lastErr = err
        console.warn(
          `[generateCustomSite] surgical ${provider} unparseable JSON (${text.length} chars, attempt ${attempt + 1}) — ${
            attempt === 0
              ? 'retrying once'
              : chain[p + 1]
                ? `trying ${chain[p + 1]}`
                : 'giving up'
          }`
        )
      }
    }
  }

  const detail =
    lastErr instanceof Error ? lastErr.message : lastText ? 'parse error' : String(lastErr)
  throw new Error(
    `Surgical AI generation failed on all providers (${lastText.length} chars). ${detail}`
  )
}

export async function publishCustomSiteDraft(tenantId: string): Promise<{
  warnings: string[]
  errors: string[]
  liveNow: boolean
  /** Tenant public gate — draft publish does NOT flip this to active. */
  siteStatus: string | null
  publicVisible: boolean
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
  const { data: tenant } = await supabase
    .from('tenants')
    .select('business_name, site_status')
    .eq('id', tenantId)
    .maybeSingle()
  const draftReport = validateCustomSiteArtifact(sanitized, {
    businessName: tenant?.business_name,
  })

  // Uniqueness gate. Separate from the artifact report because it is the only
  // check that needs to look at other tenants — a draft can be flawless on its
  // own and still be a design somebody else is already using.
  const fingerprint = extractCustomDesignFingerprint(sanitized)
  const avoid = await loadDesignAvoidList({
    supabase,
    tenantId,
    excludeFingerprintHash: fingerprint.hash,
  })
  const collisions = findDesignCollisions(fingerprint, avoid.taken)
  const collisionIssues: ArtifactValidationIssue[] =
    collisions.length > 0
      ? [
          {
            code: 'design_duplicate_visual',
            severity: tellSeverity('design_duplicate_visual'),
            message: `This redesign is visually too similar to ${collisions.length} prior design on this platform${
              collisions[0].signatureConcept ? ` ("${collisions[0].signatureConcept}")` : ''
            }. Run Full redesign again with a different direction before publishing.`,
            fixable: false,
            meta: {
              path: '/',
              collidesWith: collisions.slice(0, 3).map((c) => c.tenantId),
              score: collisions[0].score,
            },
          },
        ]
      : []

  const blocking = [...draftReport.issues, ...collisionIssues].filter(
    (issue) => issue.severity === 'error'
  )

  if (blocking.length > 0) {
    const issues = [...draftReport.issues, ...collisionIssues]
    await supabase
      .from('site_configs')
      .update({
        custom_config_draft: sanitized,
        draft_artifact_kind: 'custom',
        draft_validation_status: 'failed',
        draft_validation_report: issues,
        draft_validated_at: draftReport.checkedAt,
        draft_artifact_hash: draftReport.artifactHash,
      })
      .eq('tenant_id', tenantId)
    const summary = blocking
      .slice(0, 3)
      .map((issue) => issue.message)
      .join('; ')
    throw new Error(`Cannot publish: ${summary}`)
  }

  const keys = fingerprintKeys(fingerprint)
  const { error: publishError } = await supabase.rpc(
    'publish_custom_site_with_fingerprint',
    {
      p_tenant_id: tenantId,
      p_custom_config: sanitized,
      p_validation_status: draftReport.status,
      p_validation_report: draftReport.issues,
      p_validated_at: draftReport.checkedAt,
      p_artifact_hash: draftReport.artifactHash,
      p_fingerprint_version: fingerprint.version,
      p_skeleton_key: keys.skeletonKey,
      p_palette_key: keys.paletteKey,
      p_font_key: keys.fontKey,
      p_shape_key: keys.shapeKey,
      p_motif_key: keys.motifKey,
      p_fingerprint_artifact_hash: fingerprint.hash,
      p_fingerprint: fingerprint,
    }
  )

  if (publishError) {
    throw new Error(`Failed to publish site and fingerprint atomically: ${publishError.message}`)
  }

  const siteStatus =
    typeof tenant?.site_status === 'string' ? tenant.site_status : null
  const publicVisible = siteStatus === 'active'

  const { revalidateTenantSiteCache } = await import('@/lib/tenants/revalidateTenantSite')
  const liveNow = await revalidateTenantSiteCache(tenantId)
  const publishedReport = await validateTenantSite(tenantId)
  await saveValidationReport(tenantId, publishedReport)

  return {
    warnings: draftReport.issues
      .filter((issue) => issue.severity === 'warning')
      .map((issue) => issue.message),
    errors: [],
    liveNow,
    siteStatus,
    publicVisible,
  }
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
      draft_artifact_kind: null,
      draft_validation_status: null,
      draft_validation_report: null,
      draft_validated_at: null,
      draft_artifact_hash: null,
      custom_updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
  if (error) throw new Error(`Failed to discard draft: ${error.message}`)
}
