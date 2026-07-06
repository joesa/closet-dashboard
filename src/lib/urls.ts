function defaultWidgetScriptUrl(): string {
  const site =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    ''
  // Local dev always uses /public/widget.js so preview matches the latest bundle.
  if (/localhost|127\.0\.0\.1/.test(site)) return '/widget.js'
  return (
    process.env.NEXT_PUBLIC_WIDGET_CDN_URL?.trim() ||
    'https://closet-widget.vercel.app/widget.js'
  )
}

/** CDN URL for the embeddable closet-quote-widget IIFE bundle. */
export const WIDGET_CDN_URL = defaultWidgetScriptUrl()

/** Public dashboard / widget API origin (no trailing slash). */
export const PUBLIC_API_URL =
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_SITE_URL?.trim()?.replace(/\/$/, '') ||
  'https://www.closetquotes.com'

export function widgetEmbedScriptTag(): string {
  return `<script src="${WIDGET_CDN_URL}"></script>`
}

export function widgetEmbedSnippet(contractorId: string, engagementModel: string = 'quote'): string {
  const tagName = engagementModel === 'order' ? 'closet-order-widget' : 'closet-quote-widget'
  return `<${tagName} data-contractor-id="${contractorId}" data-api-url="${PUBLIC_API_URL}"></${tagName}>\n${widgetEmbedScriptTag()}`
}
