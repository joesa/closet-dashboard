import type { CustomSiteConfig } from '@/lib/customSite'
import type { ProductRow } from '@/lib/ai/mergeBriefServices'
import type { BriefServiceImageResult } from '@/lib/ai/generateBriefServiceImages'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;')
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Attach generated CDN URLs onto products_config rows (+ provenance in details). */
export function applyImagesToProducts(
  products: ProductRow[],
  images: BriefServiceImageResult[]
): ProductRow[] {
  if (!images.length) return products
  const byTitle = new Map(images.map((i) => [norm(i.title), i]))
  return products.map((p) => {
    const title = typeof p.title === 'string' ? p.title.trim() : ''
    if (!title) return p
    const hit = byTitle.get(norm(title))
    if (!hit) return p
    const prevDetails =
      p.details && typeof p.details === 'object' && !Array.isArray(p.details)
        ? (p.details as Record<string, unknown>)
        : {}
    return {
      ...p,
      image: hit.url,
      details: {
        ...prevDetails,
        imageSource: 'ai_brief_add',
        imageNote: hit.note,
      },
    }
  })
}

/**
 * Ensure brief-added / matching service cards in custom HTML use the real
 * CDN image as <img src>, and append new photos into gallery grids.
 */
export function applyBriefServiceImagesToCustomHtml(
  config: CustomSiteConfig,
  images: BriefServiceImageResult[]
): CustomSiteConfig {
  if (!images.length) return config
  const next: CustomSiteConfig = JSON.parse(JSON.stringify(config))

  for (const key of Object.keys(next.pages || {})) {
    const page = next.pages[key]
    if (!page || typeof page.html !== 'string') continue
    let html = page.html

    for (const img of images) {
      html = ensureServiceCardImage(html, img.title, img.url)
    }
    html = appendImagesToGallery(html, images.map((i) => i.url))
    page.html = html
    next.pages[key] = page
  }

  return next
}

/** Insert or replace an <img> inside the first card that mentions the service title. */
export function ensureServiceCardImage(
  html: string,
  title: string,
  imageUrl: string
): string {
  if (!html || !title || !imageUrl.startsWith('https')) return html
  const safeUrl = escapeAttr(imageUrl)
  const safeAlt = escapeAttr(title)
  const imgTag = `<img src="${safeUrl}" alt="${safeAlt}" loading="lazy" data-brief-service-image="1" />`

  // Prefer data-brief-added tickets we inject.
  const briefRe =
    /(<div\b[^>]*\bdata-brief-added="1"[^>]*>)([\s\S]*?)(<\/div>)/gi
  let replaced = false
  html = html.replace(briefRe, (full, open: string, inner: string, close: string) => {
    if (replaced) return full
    if (!inner.toLowerCase().includes(title.toLowerCase())) return full
    replaced = true
    if (/<img\b/i.test(inner)) {
      const nextInner = inner.replace(
        /<img\b[^>]*>/i,
        imgTag
      )
      return open + nextInner + close
    }
    return `${open}${imgTag}${inner}${close}`
  })
  if (replaced) return html

  // Fallback: ticket / svc-card whose heading matches the title.
  const cardRe =
    /(<(?:div|article)\b[^>]*class="[^"]*\b(?:ticket|svc-card|service-card)\b[^"]*"[^>]*>)([\s\S]*?)(<\/(?:div|article)>)/gi
  return html.replace(cardRe, (full, open: string, inner: string, close: string) => {
    if (replaced) return full
    const h3 = /<h3\b[^>]*>([\s\S]*?)<\/h3>/i.exec(inner)
    const heading = (h3?.[1] || '').replace(/<[^>]+>/g, '').trim()
    if (norm(heading) !== norm(title) && !inner.toLowerCase().includes(title.toLowerCase())) {
      return full
    }
    // Avoid double-matching nested cards; only first hit.
    replaced = true
    if (/<img\b/i.test(inner)) {
      return open + inner.replace(/<img\b[^>]*>/i, imgTag) + close
    }
    return `${open}${imgTag}${inner}${close}`
  })
}

/** Append CDN URLs into existing gallery grids (class contains gal / gallery). */
export function appendImagesToGallery(html: string, urls: string[]): string {
  const clean = urls.filter((u) => typeof u === 'string' && u.startsWith('https'))
  if (!html || !clean.length) return html

  const gridRe =
    /(<div\b[^>]*class="[^"]*\b(?:gal-grid|gallery-grid|gallery)\b[^"]*"[^>]*>)([\s\S]*?)(<\/div>)/i
  const m = gridRe.exec(html)
  if (!m || m.index == null) {
    // No gallery grid — append a small proof strip before footer/widget.
    const figs = clean
      .map(
        (u, i) =>
          `<figure class="gal-item" data-brief-gallery="1"><img src="${escapeAttr(u)}" alt="Added service work ${i + 1}" loading="lazy" /></figure>`
      )
      .join('\n')
    const block = `\n<section class="gallery brief-added-gallery" aria-label="Added service photos">\n<div class="gal-grid">\n${figs}\n</div>\n</section>\n`
    const widgetIdx = html.search(/<!--\s*CLOSET_WIDGET/i)
    if (widgetIdx >= 0) return html.slice(0, widgetIdx) + block + html.slice(widgetIdx)
    const footerIdx = html.search(/<footer\b/i)
    if (footerIdx >= 0) return html.slice(0, footerIdx) + block + html.slice(footerIdx)
    return html + block
  }

  const existing = m[2] || ''
  const additions = clean
    .filter((u) => !existing.includes(u))
    .map(
      (u, i) =>
        `<img src="${escapeAttr(u)}" alt="Service photo ${i + 1}" loading="lazy" data-brief-gallery="1" />`
    )
    .join('\n')
  if (!additions) return html
  const start = m.index
  const end = start + m[0].length
  const rebuilt = `${m[1]}${existing}\n${additions}\n${m[3]}`
  return html.slice(0, start) + rebuilt + html.slice(end)
}

type PageConfigRow = {
  slug?: string
  content_blocks?: Array<Record<string, unknown>>
  hero?: Record<string, unknown>
  [key: string]: unknown
}

/** Merge new URLs into pages_config gallery blocks (engine portfolio pages). */
export function appendImagesToPagesConfigGallery(
  pagesConfig: unknown,
  urls: string[]
): unknown {
  const clean = urls.filter((u) => typeof u === 'string' && u.startsWith('https'))
  if (!Array.isArray(pagesConfig) || !clean.length) return pagesConfig

  return (pagesConfig as PageConfigRow[]).map((page) => {
    const slug = typeof page.slug === 'string' ? page.slug.toLowerCase() : ''
    const isPortfolio =
      slug.includes('portfolio') ||
      slug.includes('gallery') ||
      slug.includes('our-work') ||
      slug === 'work'
    if (!isPortfolio && !Array.isArray(page.content_blocks)) return page

    const blocks = Array.isArray(page.content_blocks)
      ? page.content_blocks.map((b) => {
          if (!b || typeof b !== 'object') return b
          if (b.type !== 'gallery') return b
          const prev = Array.isArray(b.images)
            ? (b.images as unknown[]).filter((u): u is string => typeof u === 'string')
            : []
          const merged = [...prev]
          for (const u of clean) {
            if (!merged.includes(u)) merged.push(u)
          }
          return { ...b, images: merged }
        })
      : page.content_blocks

    // If portfolio page has no gallery block, add one when this looks like portfolio.
    if (isPortfolio) {
      const hasGallery = Array.isArray(blocks)
        ? blocks.some((b) => b && typeof b === 'object' && b.type === 'gallery')
        : false
      if (!hasGallery) {
        const galleryBlock = {
          type: 'gallery',
          heading: 'Our Work',
          body: 'Recent jobs — including services added from the redesign brief.',
          images: clean,
        }
        return {
          ...page,
          content_blocks: [galleryBlock, ...(Array.isArray(blocks) ? blocks : [])],
        }
      }
    }

    return { ...page, content_blocks: blocks }
  })
}

export type CustomBuildNote = {
  at: string
  kind: 'brief_service_image'
  service: string
  imageUrl: string
  note: string
}

export function buildBriefServiceImageNotes(
  images: BriefServiceImageResult[]
): CustomBuildNote[] {
  const at = new Date().toISOString()
  return images.map((i) => ({
    at,
    kind: 'brief_service_image' as const,
    service: i.title,
    imageUrl: i.url,
    note: i.note,
  }))
}

export function mergeCustomBuildNotes(
  existing: unknown,
  additions: CustomBuildNote[]
): CustomBuildNote[] {
  const prev = Array.isArray(existing)
    ? (existing.filter(
        (n) => n && typeof n === 'object' && !Array.isArray(n)
      ) as CustomBuildNote[])
    : []
  return [...prev, ...additions].slice(-200)
}
