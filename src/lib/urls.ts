import { DEFAULT_WIDGET_CDN_BASE, normalizeWidgetCdnUrl } from '@/lib/widgetCdn'

/** Canonical production dashboard origin (emails, redirects, embeds). */
export const DEFAULT_PUBLIC_ORIGIN = 'https://www.ditchtheform.com'

/**
 * Normalize a candidate origin to the public dashboard host.
 * Remaps legacy closetquotes.com → ditchtheform.com. Keeps localhost for local
 * email/dev. Never returns an empty string.
 */
export function normalizePublicOrigin(
  raw: string | null | undefined
): string | null {
  const trimmed = (raw || '').trim().replace(/\/$/, '')
  if (!trimmed) return null
  try {
    const withScheme = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`
    const u = new URL(withScheme)
    const host = u.hostname.toLowerCase()
    if (
      host === 'closetquotes.com' ||
      host === 'www.closetquotes.com' ||
      host.endsWith('.closetquotes.com')
    ) {
      return DEFAULT_PUBLIC_ORIGIN
    }
    if (host === 'localhost' || host === '127.0.0.1') {
      return `${u.protocol}//${u.host}`
    }
    return `${u.protocol}//${u.host}`
  } catch {
    return null
  }
}

/**
 * Public dashboard / API origin for emails, Stripe returns, intake verify
 * links, and widget embeds. Prefer configured env; never emit closetquotes.
 */
export function publicAppOrigin(fallbackRequestOrigin?: string | null): string {
  return (
    normalizePublicOrigin(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizePublicOrigin(process.env.NEXT_PUBLIC_SITE_URL) ||
    normalizePublicOrigin(fallbackRequestOrigin) ||
    DEFAULT_PUBLIC_ORIGIN
  )
}

function defaultWidgetScriptUrl(): string {
  const site = publicAppOrigin()
  // Local dev always uses /public/widget.js so preview matches the latest bundle.
  if (/localhost|127\.0\.0\.1/.test(site)) return '/widget.js'
  const base =
    process.env.NEXT_PUBLIC_WIDGET_CDN_URL?.trim() || DEFAULT_WIDGET_CDN_BASE
  return normalizeWidgetCdnUrl(base)
}

/** CDN loader for the content-addressed closet widget release. */
export const WIDGET_CDN_URL = defaultWidgetScriptUrl()

/** Public dashboard / widget API origin (no trailing slash). */
export const PUBLIC_API_URL = publicAppOrigin()

export function widgetEmbedScriptTag(): string {
  return `<script src="${WIDGET_CDN_URL}"></script>`
}

/**
 * The custom element for an engagement model. Exported so the dashboard's live
 * preview mounts the same element the embed snippet tells the contractor to
 * paste — when the preview was hardcoded to the quote widget, a booking
 * business had no way to notice it had been handed the wrong snippet.
 */
export function widgetTagName(engagementModel: string = 'quote'): string {
  return engagementModel === 'order'
    ? 'closet-order-widget'
    : engagementModel === 'booking'
      ? 'closet-booking-widget'
      : engagementModel === 'ticket'
        ? 'closet-ticket-widget'
        : 'closet-quote-widget'
}

export function widgetEmbedSnippet(
  contractorId: string,
  engagementModel: string = 'quote'
): string {
  const tagName = widgetTagName(engagementModel)
  return `<${tagName} data-contractor-id="${contractorId}" data-api-url="${PUBLIC_API_URL}"></${tagName}>\n${widgetEmbedScriptTag()}`
}
