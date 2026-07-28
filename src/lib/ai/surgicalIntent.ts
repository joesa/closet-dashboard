/**
 * Rule-based surgical intent router.
 * Fixed priority: video → hero → contact → drawer → lightbox → clickable → ops → open_ended.
 */

import { looksLikeContactSurgicalRequest } from '@/lib/ai/surgicalContactReplace'
import {
  looksLikeClickableCardsRequest,
} from '@/lib/ai/surgicalIntegrity'
import { looksLikeImageLightboxRequest } from '@/lib/ai/surgicalImageLightbox'
import { looksLikeServiceDrawerRequest } from '@/lib/ai/surgicalServiceDrawer'

export type SurgicalRouteKind =
  | 'video'
  | 'hero_image'
  | 'contact'
  | 'service_drawer'
  | 'image_lightbox'
  | 'clickable_cards'
  | 'ops'
  | 'open_ended'

export type SurgicalRoute = { kind: SurgicalRouteKind }

export type ClassifySurgicalIntentCtx = {
  /** Attached vision images (data URLs) — hero may still need LLM if no CDN URL. */
  hasImages?: boolean
  /** CDN URLs already attached to the prompt. */
  attachedAssetUrls?: string[]
}

export function looksLikeVideoSurgicalRequest(prompt: string): boolean {
  return (
    /\b(video|mp4|webm|testimonial)\b/i.test(prompt) ||
    /\b(don't|do not|cant|can't|cannot)\s+see\b/i.test(prompt) ||
    /\bmissing\s+video\b/i.test(prompt) ||
    /\badd\s+(the\s+)?(uploaded\s+)?(video|mp4)\b/i.test(prompt) ||
    /\bembed\b/i.test(prompt)
  )
}

/** Admin asked to set/replace the home hero (or main background) image. */
export function looksLikeHeroImageSurgicalRequest(prompt: string): boolean {
  const p = prompt || ''
  if (looksLikeVideoSurgicalRequest(p) && !/\b(hero|banner|background)\b/i.test(p)) {
    return false
  }
  if (
    /\b(hero|banner|splash)\b/i.test(p) &&
    /\b(image|photo|picture|pic|background|bg)\b/i.test(p)
  ) {
    return true
  }
  if (
    /\b(background|header|main\s+page|homepage|home\s+page)\b/i.test(p) &&
    /\b(image|photo|picture|pic)\b/i.test(p)
  ) {
    return true
  }
  if (
    /\b(use|set|make|put|replace|swap|change)\b[\s\S]{0,80}\b(this|the|attached|uploaded)\b[\s\S]{0,80}\b(image|photo|picture|pic)\b/i.test(
      p
    ) &&
    /\b(hero|banner|splash|background|home|main\s+page|homepage)\b/i.test(p)
  ) {
    return true
  }
  return false
}

/**
 * Mid-tier mechanical edits: rename, find/replace, set href/src, CTA retarget.
 * Contact / drawer / clickable / hero / video take priority above this.
 */
export function looksLikeSurgicalOpsRequest(prompt: string): boolean {
  const p = prompt || ''
  if (!p.trim()) return false

  if (
    /\b(rename|rebrand)\b/i.test(p) ||
    /\bfind\s+(?:and\s+)?replace\b/i.test(p) ||
    /\breplace\s+(?:all|every|the\s+text|text)\b/i.test(p)
  ) {
    return true
  }

  // "change X to Y" / "update the heading to …" — not contact/phone/email/address
  // (those are handled by the contact route).
  if (
    /\b(change|update|swap|set)\b[\s\S]{0,60}\bto\b/i.test(p) &&
    !/\b(phone|telephone|\btel\b|email|e-mail|mailto|address|street|zip(?:code)?|postal)\b/i.test(
      p
    )
  ) {
    return true
  }

  if (
    /\b(set|change|update|fix)\b[\s\S]{0,40}\b(href|src|link|url)\b/i.test(p) ||
    /\bmake\s+the\s+(?:cta|button|link)\s+(?:go\s+to|point\s+to|link\s+to)\b/i.test(
      p
    ) ||
    /\b(?:cta|button)\b[\s\S]{0,40}\blink\s+to\b/i.test(p)
  ) {
    return true
  }

  if (
    /\b(update|change|fix|rewrite)\b[\s\S]{0,40}\b(heading|headline|title|label|button\s+label|cta)\b/i.test(
      p
    )
  ) {
    return true
  }

  return false
}

/**
 * Classify a surgical prompt. Prefer structured routes when matchers hit
 * (same priority as the previous independent if-chain).
 */
export function classifySurgicalIntent(
  prompt: string,
  ctx: ClassifySurgicalIntentCtx = {}
): SurgicalRoute {
  const p = prompt || ''

  // Video shortcut skips when vision images are present (legacy behavior).
  if (!(ctx.hasImages) && looksLikeVideoSurgicalRequest(p)) {
    return { kind: 'video' }
  }

  if (looksLikeHeroImageSurgicalRequest(p)) {
    return { kind: 'hero_image' }
  }

  if (looksLikeContactSurgicalRequest(p)) {
    return { kind: 'contact' }
  }

  if (looksLikeServiceDrawerRequest(p)) {
    return { kind: 'service_drawer' }
  }

  if (looksLikeImageLightboxRequest(p)) {
    return { kind: 'image_lightbox' }
  }

  if (looksLikeClickableCardsRequest(p)) {
    return { kind: 'clickable_cards' }
  }

  if (looksLikeSurgicalOpsRequest(p)) {
    return { kind: 'ops' }
  }

  return { kind: 'open_ended' }
}
