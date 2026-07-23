/**
 * Canonical embed URL for closet-widget. Keep in sync with
 * custom-closets-websites/src/lib/widgetCdn.ts (separate packages).
 *
 * Bump DEFAULT_WIDGET_VERSION when shipping a widget release that must
 * invalidate cached <script src> tags immediately (also bump closet-widget
 * package.json version and optionally set NEXT_PUBLIC_WIDGET_VERSION on Vercel).
 */
export const DEFAULT_WIDGET_CDN_BASE = 'https://closet-widget.vercel.app/widget.js'

/** Matches closet-widget/package.json version for hard cache-bust. */
export const DEFAULT_WIDGET_VERSION = '0.1.3'

export function withWidgetCacheBust(url: string, version?: string): string {
  const raw = (url || '').trim()
  if (!raw) return raw
  // Local /public/widget.js — no bust needed (copied on predev).
  if (raw.startsWith('/')) return raw
  const v =
    (version || process.env.NEXT_PUBLIC_WIDGET_VERSION || DEFAULT_WIDGET_VERSION).trim() ||
    DEFAULT_WIDGET_VERSION
  try {
    const u = new URL(raw)
    if (!u.searchParams.has('v')) u.searchParams.set('v', v)
    return u.toString()
  } catch {
    const sep = raw.includes('?') ? '&' : '?'
    return raw.includes('v=') ? raw : `${raw}${sep}v=${encodeURIComponent(v)}`
  }
}
