/**
 * CSS-only image lightbox for inline custom sites (no <script>).
 * Pattern: <label class="img-lightbox"><input type="checkbox" class="lightbox-toggle"><img></label>
 *
 * Prior surgical runs often claimed success after wiring Process/Financing
 * only — Portfolio galleries were left as bare <img>. This module wraps
 * content images site-wide (skipping logos, nav, and service-drawer faces).
 */

import * as cheerio from 'cheerio'
import type { Element } from 'domhandler'
import { isNonNavigationalHref } from '@/lib/site-content/brandLink'

export const IMAGE_LIGHTBOX_SUPPORT_CSS = `/* surgical: image lightbox (CSS-only, inline-safe) */
.img-lightbox{display:block;cursor:zoom-in;margin:0;}
.img-lightbox img{display:block;width:100%;height:auto;}
.img-lightbox .lightbox-toggle{position:absolute;opacity:0;pointer-events:none;width:0;height:0;}
.img-lightbox .lightbox-toggle:checked + img{
  position:fixed;inset:0;width:100vw;height:100vh;max-width:none;max-height:none;
  object-fit:contain;background:rgba(0,0,0,0.92);z-index:99999;cursor:zoom-out;margin:0;padding:2rem;box-sizing:border-box;
}
`

export function looksLikeImageLightboxRequest(prompt: string): boolean {
  const p = prompt || ''
  if (!p.trim()) return false
  if (/\blightbox\b/i.test(p)) return true
  if (
    /\b(image|photo|picture|pic|img)s?\b/i.test(p) &&
    /\b(enlarg(?:e|es|ed|ing)|zoom(?:s|ed|ing)?(?:\s+in)?|fullscreen|full[- ]?screen|bigger)\b/i.test(
      p
    )
  ) {
    return true
  }
  if (
    /\b(click|tap|open)(?:ed|ing)?\b[\s\S]{0,48}\b(image|photo|picture|pic|img)s?\b/i.test(
      p
    ) &&
    /\b(enlarg|zoom|fullscreen|lightbox|bigger|modal)\b/i.test(p)
  ) {
    return true
  }
  return false
}

function isChromeImage($: cheerio.CheerioAPI, el: Element): boolean {
  const $img = $(el)
  if (
    $img.closest(
      'header, nav, footer, .site-header, .site-nav, .site-footer, .logo, .brand, .cs-brand, a.cs-brand'
    ).length
  ) {
    return true
  }
  const cls =
    `${$img.attr('class') || ''} ${$img.parent().attr('class') || ''}`.toLowerCase()
  if (/\b(logo|icon|avatar|badge|sprite|cs-brand)\b/.test(cls)) return true
  const alt = ($img.attr('alt') || '').toLowerCase()
  if (/\blogo\b/.test(alt)) return true
  const src = ($img.attr('src') || '').toLowerCase()
  if (/\/logo[-_/]|logo\.(svg|png|webp|jpe?g)(\?|$)/i.test(src)) return true
  const w = parseInt($img.attr('width') || '', 10)
  const h = parseInt($img.attr('height') || '', 10)
  if (
    (Number.isFinite(w) && w > 0 && w <= 48) ||
    (Number.isFinite(h) && h > 0 && h <= 48)
  ) {
    return true
  }
  return false
}

function shouldSkipImage($: cheerio.CheerioAPI, el: Element): boolean {
  const $img = $(el)
  if ($img.closest('.img-lightbox').length) return true
  // Service drawers already own the click — don't steal it for lightbox.
  if ($img.closest('.svc-drawer-wrap').length) return true
  if ($img.closest('a[href]').length) return true
  if (isChromeImage($, el)) return true
  const src = ($img.attr('src') || '').trim()
  if (!src || src.startsWith('data:image/svg')) return true
  return false
}

/**
 * Logos must navigate home — never enlarge. Unwrap chrome images that were
 * wrongly lightbox-wrapped, and ensure brand marks are `<a href="/">`.
 */
export function normalizeBrandLogoLinks(html: string): {
  html: string
  fixed: number
} {
  if (!html) return { html: html || '', fixed: 0 }

  const $ = cheerio.load(html, { xml: false }, false)
  let fixed = 0

  // Snapshot matching nodes first — unwrapping mutates the tree mid-iteration.
  const chromeImgs = $('img')
    .toArray()
    .filter((el) => isChromeImage($, el))

  for (const el of chromeImgs) {
    let $img = $(el)
    if (!$img.length) continue

    const $wrap = $img.closest('label.img-lightbox')
    if ($wrap.length) {
      const outer = $.html($img)
      if (outer) {
        $wrap.replaceWith(outer)
        fixed += 1
        // Find the replacement img (same src) nearest to prior context.
        const src = $img.attr('src') || ''
        $img = $('img')
          .filter((_, candidate) => ($(candidate).attr('src') || '') === src)
          .first()
        if (!$img.length) continue
      }
    }

    const $anchor = $img.closest('a[href]')
    if (!$anchor.length) {
      $img.wrap('<a class="cs-brand" href="/"></a>')
      fixed += 1
      continue
    }

    if (isNonNavigationalHref($anchor.attr('href'))) {
      $anchor.attr('href', '/')
      fixed += 1
    }
    const cls = $anchor.attr('class') || ''
    if (
      !/\bcs-brand\b/.test(cls) &&
      ($anchor.closest('header, nav, .site-header, .site-nav, .logo, .brand').length ||
        /\b(logo|brand)\b/i.test(cls))
    ) {
      $anchor.attr('class', `${cls} cs-brand`.trim())
    }
  }

  return { html: $.root().html() || '', fixed }
}

/**
 * Wrap bare content <img> tags in CSS-only lightbox labels.
 * Idempotent for images already inside .img-lightbox.
 * Also repairs brand/logo images so they link home instead of enlarging.
 */
export function wireImageLightboxes(html: string): {
  html: string
  count: number
} {
  if (!html) return { html: html || '', count: 0 }

  const normalized = normalizeBrandLogoLinks(html)
  const $ = cheerio.load(normalized.html, { xml: false }, false)
  let count = 0

  $('img').each((_, el) => {
    if (shouldSkipImage($, el)) return
    const $img = $(el)
    const outer = $.html($img)
    if (!outer) return
    $img.replaceWith(
      `<label class="img-lightbox"><input type="checkbox" class="lightbox-toggle" aria-label="Enlarge image">${outer}</label>`
    )
    count += 1
  })

  return { html: $.root().html() || '', count }
}

/** Prefer gallery paths when the prompt names portfolio/gallery/work. */
export function lightboxPriorityPaths(
  prompt: string,
  allPaths: string[]
): string[] {
  const p = prompt || ''
  const galleryHint =
    /\b(portfolio|gallery|our\s+work|projects?|photos?\s+page)\b/i.test(p)
  const galleryPaths = allPaths.filter((path) =>
    /\/(portfolio|gallery|work|projects)(\/|$)/i.test(path)
  )
  if (galleryPaths.length === 0) return allPaths
  const rest = allPaths.filter((path) => !galleryPaths.includes(path))
  // Always put gallery pages first; when the prompt names them, still scan the rest after.
  void galleryHint
  return [...galleryPaths, ...rest]
}

/**
 * Ensure lightbox CSS exists. Strips older incomplete/duplicated snippets
 * that only covered Process/Financing pages, then appends the canonical block.
 */
export function ensureImageLightboxCss(globalCss: string): string {
  let css = globalCss || ''
  css = css.replace(/\/\*\s*surgical:\s*image lightbox[\s\S]*?(?=\/\*\s*surgical:|$)/gi, '')
  // Remove prior .img-lightbox / .lightbox-toggle rule blocks (may be duplicated).
  css = css.replace(
    /(?:^|\n)[^\n{]*\.(?:img-lightbox|lightbox-toggle)[^{]*\{[^{}]*\}/gi,
    '\n'
  )
  css = css.replace(/\n{3,}/g, '\n\n').trim()
  if (
    /\.img-lightbox\b/.test(css) &&
    /\.lightbox-toggle:checked\s*\+\s*img/.test(css) &&
    /object-fit\s*:\s*contain/i.test(css)
  ) {
    return `${css}\n`
  }
  return `${css}\n\n${IMAGE_LIGHTBOX_SUPPORT_CSS}\n`
}
