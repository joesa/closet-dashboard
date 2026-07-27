/**
 * CSS-only service-card drawers for inline custom sites (no <script>).
 * Pattern: checkbox + label card + fixed .side-drawer sibling.
 * Card wiring uses cheerio (tree-safe) instead of nested regex.
 */

import * as cheerio from 'cheerio'
import type { Element } from 'domhandler'

const DRAWER_SUPPORT_CSS = `/* surgical: service card drawers (CSS-only, inline-safe) */
.svc-drawer-wrap{min-width:0;position:relative;}
.svc-drawer-wrap > label.plate,.svc-drawer-wrap > label.clickable-card{cursor:pointer;display:block;height:100%;text-decoration:none;color:inherit;}
.drawer-toggle{position:absolute;opacity:0;pointer-events:none;width:0;height:0;}
.side-drawer{position:fixed;inset:0;z-index:9999;pointer-events:none;visibility:hidden;display:flex;justify-content:flex-end;text-align:left;}
.drawer-overlay{position:absolute;inset:0;background:rgba(0,0,0,0.55);opacity:0;transition:opacity .25s ease;}
.close-overlay{display:block;width:100%;height:100%;cursor:pointer;}
.drawer-panel{position:relative;width:min(420px,100%);background:var(--bg,#f4f1ec);color:var(--ink,#1c1c1a);height:100%;transform:translateX(100%);transition:transform .3s ease;padding:3rem 1.5rem 2rem;overflow-y:auto;box-shadow:-4px 0 24px rgba(0,0,0,.15);display:flex;flex-direction:column;gap:.85rem;}
.drawer-panel .close-btn{position:absolute;top:.75rem;right:1rem;font-size:2rem;line-height:1;cursor:pointer;color:inherit;}
.drawer-toggle:checked ~ .side-drawer{pointer-events:auto;visibility:visible;}
.drawer-toggle:checked ~ .side-drawer .drawer-overlay{opacity:1;}
.drawer-toggle:checked ~ .side-drawer .drawer-panel{transform:translateX(0);}
.drawer-panel img{width:100%;height:auto;border:1px solid var(--line,#c9c4ba);margin:0;}
.drawer-panel h3{margin:0;font-size:1.75rem;line-height:1.1;text-transform:uppercase;}
.drawer-panel p{margin:0;color:var(--muted,#6b6862);line-height:1.5;}
.drawer-panel .drawer-cta{margin-top:auto;}
`

export function looksLikeServiceDrawerRequest(prompt: string): boolean {
  const p = prompt || ''
  const wantsDrawer =
    /\b(side\s*-?\s*drawer|drawer|side\s*panel|slide[- ]?out|slide[- ]?over)\b/i.test(
      p
    ) || /\breveal(?:s|ing)?\s+details?\b/i.test(p)
  const aboutCards =
    /\b(card|service|plate)\b/i.test(p) || /\bclick(?:ed|ing)?\b/i.test(p)
  return wantsDrawer && aboutCards
}

function slugId(title: string, index: number): string {
  const base = (title || `service-${index}`)
    .toLowerCase()
    .replace(/&amp;/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `svc-drawer-${base || index}-${index}`
}

function extractCardParts(
  $: cheerio.CheerioAPI,
  $card: cheerio.Cheerio<Element>
): {
  title: string
  body: string
  img: string
} {
  const title =
    $card.find('h1, h2, h3, h4').first().text().replace(/\s+/g, ' ').trim() ||
    'Service'
  const body =
    $card.find('p').first().text().replace(/\s+/g, ' ').trim() || ''
  const $img = $card.find('img').first()
  const img = $img.length ? $.html($img) || '' : ''
  return { title, body, img }
}

function buildDrawerWrap(opts: {
  id: string
  cardInner: string
  title: string
  body: string
  img: string
  labelClass: string
}): string {
  const { id, cardInner, title, body, img, labelClass } = opts
  const panelImg = img || ''
  const panelBody = body
    ? `<p>${body}</p>`
    : '<p>Ask us about this service — we will walk you through fit, timing, and next steps.</p>'
  const safeTitle = title.replace(/"/g, '')
  return `<div class="svc-drawer-wrap"><input type="checkbox" id="${id}" class="drawer-toggle" /><label for="${id}" class="${labelClass}">${cardInner}</label><div class="side-drawer"><label for="${id}" class="drawer-overlay"><span class="close-overlay" aria-hidden="true"></span></label><aside class="drawer-panel" role="dialog" aria-label="${safeTitle}"><label for="${id}" class="close-btn" aria-label="Close">×</label>${panelImg}<h3>${title}</h3>${panelBody}<p class="drawer-cta"><a href="/contact" class="btn btn-primary">Get a quote</a></p></aside></div></div>`
}

function wireOneCard(
  $: cheerio.CheerioAPI,
  $el: cheerio.Cheerio<Element>,
  index: number
): boolean {
  if ($el.closest('.svc-drawer-wrap').length) return false
  if (!$el.find('h1, h2, h3, h4').length && !$el.find('img').length) return false

  const classList = $el.attr('class') || ''
  const { title, body, img } = extractCardParts($, $el)

  // Flatten nested anchors inside the card face.
  $el.find('a').each((_, a) => {
    $(a).replaceWith($(a).contents())
  })

  const labelClass = /\bclickable-card\b/.test(classList)
    ? classList
    : `${classList} clickable-card`.trim() || 'plate clickable-card'

  const cardInner = $el.html() || ''
  const id = slugId(title, index)
  const wrap = buildDrawerWrap({
    id,
    cardInner,
    title,
    body,
    img,
    labelClass,
  })
  $el.replaceWith(wrap)
  return true
}

/**
 * Convert service plate cards (often broken `<a href="?service=…">` links) into
 * CSS-only checkbox drawers that work in inline mode.
 */
export function wireServiceCardDrawers(html: string): {
  html: string
  count: number
} {
  if (!html) return { html: html || '', count: 0 }

  // Already wired
  if (/\bsvc-drawer-wrap\b/.test(html) && /\bdrawer-toggle\b/.test(html)) {
    return { html, count: 0 }
  }

  const $ = cheerio.load(html, { xml: false }, false)
  let count = 0
  let index = 0

  // Primary: <a class="…plate…"> service cards
  const plateAnchors = $('a[class*="plate"]').toArray().filter((el) => {
    const $el = $(el)
    if ($el.closest('.svc-drawer-wrap').length) return false
    if ($el.find('h1, h2, h3, h4').length === 0 && $el.find('img').length === 0) {
      return false
    }
    return true
  })

  for (const el of plateAnchors) {
    if (wireOneCard($, $(el), index)) {
      count += 1
      index += 1
    }
  }

  // Secondary: unlinked plate / service-card containers
  if (count === 0) {
    const cardSel =
      'div[class*="plate"], article[class*="plate"], div[class*="service-card"], article[class*="service-card"], div[class*="product-card"], article[class*="product-card"], div[class*="svc-card"], article[class*="svc-card"]'
    const cards = $(cardSel)
      .toArray()
      .filter((el) => {
        const $el = $(el)
        if ($el.closest('.svc-drawer-wrap').length) return false
        if ($el.find(cardSel).length > 0) return false
        if ($el.find('h1, h2, h3, h4').length === 0) return false
        return true
      })

    for (const el of cards) {
      if (wireOneCard($, $(el), index)) {
        count += 1
        index += 1
      }
    }
  }

  return { html: $.root().html() || '', count }
}

export function ensureServiceDrawerCss(globalCss: string): string {
  const css = globalCss || ''
  if (/\.svc-drawer-wrap\b/.test(css) && /\.drawer-toggle:checked/.test(css)) {
    return css
  }
  return `${css.replace(/\s+$/, '')}\n\n${DRAWER_SUPPORT_CSS}\n`
}

export { DRAWER_SUPPORT_CSS }
