/**
 * CSS-only service-card drawers for inline custom sites (no <script>).
 * Pattern: checkbox + label card + fixed .side-drawer sibling.
 */

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

function extractCardParts(innerHtml: string): {
  title: string
  body: string
  img: string
  stamp: string
} {
  const title =
    innerHtml.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i)?.[1]?.replace(/<[^>]+>/g, '').trim() ||
    'Service'
  const body =
    innerHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1]?.replace(/<[^>]+>/g, '').trim() || ''
  const img = innerHtml.match(/<img\b[^>]*>/i)?.[0] || ''
  const stamp =
    innerHtml.match(/<span[^>]*class=["'][^"']*stamp[^"']*["'][^>]*>[\s\S]*?<\/span>/i)?.[0] ||
    ''
  return { title, body, img, stamp }
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
  return `<div class="svc-drawer-wrap"><input type="checkbox" id="${id}" class="drawer-toggle" /><label for="${id}" class="${labelClass}">${cardInner}</label><div class="side-drawer"><label for="${id}" class="drawer-overlay"><span class="close-overlay" aria-hidden="true"></span></label><aside class="drawer-panel" role="dialog" aria-label="${title.replace(/"/g, '')}"><label for="${id}" class="close-btn" aria-label="Close">×</label>${panelImg}<h3>${title}</h3>${panelBody}<p class="drawer-cta"><a href="/contact" class="btn btn-primary">Get a quote</a></p></aside></div></div>`
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
  let count = 0
  let index = 0

  // Already wired
  if (/\bsvc-drawer-wrap\b/.test(html) && /\bdrawer-toggle\b/.test(html)) {
    return { html, count: 0 }
  }

  // Primary: <a class="plate" href="?service=...">…</a> or any plate link in a services grid
  let out = html.replace(
    /<a\b([^>]*\bclass=(["'])([^"']*\bplate\b[^"']*)\2[^>]*)>([\s\S]*?)<\/a>/gi,
    (full, attrs: string, _q: string, classList: string, inner: string) => {
      // Skip nav/brand plates
      if (!/<h[1-4]\b/i.test(inner) && !/<img\b/i.test(inner)) return full
      const { title, body, img } = extractCardParts(inner)
      const id = slugId(title, index++)
      count += 1
      const labelClass = /\bclickable-card\b/.test(classList)
        ? classList
        : `${classList} clickable-card`.trim()
      // Keep stamp/img/h3/p as card face; drop nested anchors
      const cardInner = inner.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1')
      return buildDrawerWrap({
        id,
        cardInner,
        title,
        body,
        img,
        labelClass,
      })
    }
  )

  // Secondary: unlinked <div|article class="…card|plate…">
  if (count === 0) {
    out = html.replace(
      /<(div|article)(\s[^>]*\bclass=(["'])([^"']*\b(?:plate|service-card|product-card|svc-card)[^"']*)\3[^>]*)>([\s\S]*?)<\/\1>/gi,
      (full, tag: string, attrs: string, _q: string, classList: string, inner: string) => {
        if (/\bsvc-drawer-wrap\b/.test(full)) return full
        if (!/<h[1-4]\b/i.test(inner)) return full
        const { title, body, img } = extractCardParts(inner)
        const id = slugId(title, index++)
        count += 1
        const labelClass = /\bplate\b/.test(classList)
          ? `${classList} clickable-card`
          : `plate clickable-card ${classList}`
        return buildDrawerWrap({
          id,
          cardInner: inner.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1'),
          title,
          body,
          img,
          labelClass,
        })
      }
    )
  }

  return { html: out, count }
}

export function ensureServiceDrawerCss(globalCss: string): string {
  const css = globalCss || ''
  if (/\.svc-drawer-wrap\b/.test(css) && /\.drawer-toggle:checked/.test(css)) {
    return css
  }
  return `${css.replace(/\s+$/, '')}\n\n${DRAWER_SUPPORT_CSS}\n`
}

export { DRAWER_SUPPORT_CSS }
