/**
 * Canonical widget loader URL. Keep in sync with
 * custom-closets-websites/src/lib/widgetCdn.ts (separate packages).
 *
 * The loader is always revalidated and resolves a content-addressed,
 * SRI-protected release, so consumers never pin a manual package version.
 */
export const DEFAULT_WIDGET_CDN_BASE = 'https://closet-widget.vercel.app/loader.js'

export function normalizeWidgetCdnUrl(url: string): string {
  const raw = (url || '').trim()
  if (!raw) return raw
  try {
    return raw.startsWith('/') ? raw : new URL(raw).toString()
  } catch {
    return raw
  }
}
