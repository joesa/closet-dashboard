/**
 * Hrefs a brand/logo link must never keep.
 *
 * The obvious cases are empty, "#" and javascript:. The one that actually bit
 * us is subtler: a logo whose href points at an *asset*. Selecting the brand
 * link in the editor and applying an image URL set the anchor's href (that is
 * what "Apply to selection" does to an <a>), so Alvarado's logo linked to
 * /api/a/<token> — clicking it downloaded a JPEG instead of going home. A
 * repair that only looked for empty/#/javascript: left it in place.
 *
 * Kept deliberately narrow: real destinations ("/", "/about", an external
 * site) must pass, or logos stop linking where they should.
 *
 * Mirrored in custom-closets-websites/src/lib/brandLink.ts — the renderer
 * repairs at paint time, this repairs what gets stored.
 */
const ASSET_HREF =
  /^\/api\/a\/|\/storage\/v1\/object\/|\.(?:jpe?g|png|webp|gif|svg|avif|bmp|ico)(?:[?#]|$)/i

export function isNonNavigationalHref(href: string | null | undefined): boolean {
  const value = (href || '').trim()
  if (!value || value === '#') return true
  if (/^javascript:/i.test(value)) return true
  return ASSET_HREF.test(value)
}
