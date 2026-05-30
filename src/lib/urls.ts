/** CDN URL for the embeddable closet-quote-widget IIFE bundle. */
export const WIDGET_CDN_URL =
  process.env.NEXT_PUBLIC_WIDGET_CDN_URL?.trim() ||
  'https://closet-widget.vercel.app/widget.js'

/** Public dashboard / widget API origin (no trailing slash). */
export const PUBLIC_API_URL =
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_SITE_URL?.trim()?.replace(/\/$/, '') ||
  'https://www.closetquotes.com'

export function widgetEmbedScriptTag(): string {
  return `<script src="${WIDGET_CDN_URL}"></script>`
}

export function widgetEmbedSnippet(contractorId: string): string {
  return `<closet-quote-widget data-contractor-id="${contractorId}" data-api-url="${PUBLIC_API_URL}"></closet-quote-widget>\n${widgetEmbedScriptTag()}`
}
