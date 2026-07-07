/**
 * Backfill: repair already-provisioned sites whose sub-pages shipped as one
 * giant text block (no layout) and/or with raw `{ "content": "..." }` JSON
 * leaking into the body, and whose Portfolio gallery has no images.
 *
 * For every site_config it rebuilds "degenerate" pages into structured blocks
 * (intro text + alternating image sections woven with the site's product
 * images) and injects a Portfolio gallery from product images when empty.
 *
 * Dry run by default; pass --apply to write.
 *
 *   set -a && . ./.env.local && set +a && node scripts/backfill-page-structure.mjs
 *   set -a && . ./.env.local && set +a && node scripts/backfill-page-structure.mjs --apply
 */
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const supa = createClient(url, key, { auth: { persistSession: false } })

// ---- logic mirrored from src/lib/catalog/sitePages.ts ----------------------

function parsePageCopy(raw) {
  if (typeof raw !== 'string') return ''
  const t = raw.trim()
  if (!t) return ''
  if (t.startsWith('{') && t.includes('"content"')) {
    try {
      const obj = JSON.parse(t)
      if (typeof obj.content === 'string') return obj.content.trim()
    } catch {
      const m = t.match(/"content"\s*:\s*"([\s\S]*)$/)
      if (m) {
        return m[1]
          .replace(/"\s*}?\s*$/, '')
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"')
          .replace(/\\t/g, ' ')
          .trim()
      }
    }
  }
  return t
}

function splitParagraphs(text) {
  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
}

function contentToBlocks(rawContent, title, images = []) {
  const content = parsePageCopy(rawContent)
  const paras = splitParagraphs(content)
  if (paras.length === 0) {
    return [
      { type: 'text', heading: title, body: content || `Detailed information about ${title.toLowerCase()}.` },
    ]
  }
  const imgs = images.filter((u) => typeof u === 'string' && u.trim().length > 0)
  const blocks = [{ type: 'text', heading: title, body: paras[0] }]
  const rest = paras.slice(1)
  if (rest.length === 0) return blocks
  const perGroup = rest.length > 4 ? 2 : 1
  const groups = []
  for (let i = 0; i < rest.length; i += perGroup) {
    groups.push(rest.slice(i, i + perGroup).join('\n\n'))
  }
  groups.forEach((body, i) => {
    blocks.push({
      type: i % 2 === 0 ? 'image_left' : 'image_right',
      heading: '',
      body,
      ...(imgs.length > 0 ? { image: imgs[i % imgs.length] } : {}),
    })
  })
  return blocks
}

function portfolioSlug(slug) {
  return String(slug || '').replace(/^\/+/, '').toLowerCase() === 'portfolio'
}

function injectGallery(pages, galleryUrls) {
  const urls = (galleryUrls || []).filter((u) => typeof u === 'string' && u.trim().length > 0)
  if (urls.length === 0) return pages
  return pages.map((page) => {
    if (!portfolioSlug(page.slug)) return page
    const galleryBlock = {
      type: 'gallery',
      heading: 'Our Work',
      body: 'Photos from recent projects — the craftsmanship and finishes our clients chose.',
      images: urls,
    }
    const blocks = (page.content_blocks || []).filter((b) => b.type !== 'gallery')
    return {
      ...page,
      hero: { ...page.hero, ...(urls[0] ? { backgroundImage: urls[0] } : {}) },
      content_blocks: [galleryBlock, ...blocks],
    }
  })
}

// A page needs repair when it has no structured layout: a single text block,
// zero blocks, or any text block whose body is raw JSON copy.
function pageNeedsFix(page) {
  const blocks = Array.isArray(page.content_blocks) ? page.content_blocks : []
  if (blocks.length === 0) return true
  const nonGallery = blocks.filter((b) => b.type !== 'gallery')
  const onlyText = nonGallery.length > 0 && nonGallery.every((b) => b.type === 'text')
  const jsonLeak = blocks.some(
    (b) => typeof b.body === 'string' && b.body.trim().startsWith('{') && b.body.includes('"content"')
  )
  return (onlyText && nonGallery.length <= 1) || jsonLeak
}

// Reconstruct the page copy from the existing blocks (parse any JSON leak).
function copyFromBlocks(page) {
  const blocks = Array.isArray(page.content_blocks) ? page.content_blocks : []
  const parts = blocks
    .filter((b) => b.type === 'text' || b.type === 'image_left' || b.type === 'image_right')
    .map((b) => parsePageCopy(b.body))
    .filter(Boolean)
  return parts.join('\n\n')
}

async function main() {
  const { data: configs, error } = await supa
    .from('site_configs')
    .select('id,tenant_id,brand_name,pages_config,products_config')
  if (error) throw error

  let sitesTouched = 0
  let pagesFixed = 0

  for (const cfg of configs ?? []) {
    const pages = Array.isArray(cfg.pages_config) ? cfg.pages_config : []
    if (pages.length === 0) continue

    const pool = (Array.isArray(cfg.products_config) ? cfg.products_config : [])
      .map((p) => p?.image)
      .filter((u) => typeof u === 'string' && u.length > 0)

    let changed = false
    let next = pages.map((page) => {
      if (!pageNeedsFix(page)) return page
      const copy = copyFromBlocks(page)
      if (!copy) return page
      changed = true
      pagesFixed++
      return { ...page, content_blocks: contentToBlocks(copy, page.title, pool) }
    })

    // Ensure the Portfolio page has a gallery. Prefer prospect uploads, else
    // fall back to the product images.
    const hasPortfolio = next.some((p) => portfolioSlug(p.slug))
    if (hasPortfolio) {
      let galleryUrls = []
      const { data: intake } = await supa
        .from('prospect_intakes')
        .select('gallery_images')
        .eq('provisioned_contractor_id', cfg.tenant_id)
        .maybeSingle()
      if (Array.isArray(intake?.gallery_images)) {
        galleryUrls = intake.gallery_images.filter((u) => typeof u === 'string' && u.length > 0)
      }
      if (galleryUrls.length === 0) galleryUrls = pool
      const portfolioHasGallery = next.some(
        (p) => portfolioSlug(p.slug) && (p.content_blocks || []).some((b) => b.type === 'gallery' && (b.images || []).length > 0)
      )
      if (!portfolioHasGallery && galleryUrls.length > 0) {
        next = injectGallery(next, galleryUrls)
        changed = true
      }
    }

    if (!changed) continue
    sitesTouched++
    console.log(`${APPLY ? 'UPDATE' : 'DRY  '} [${cfg.brand_name}] rebuilt ${next.filter((p, i) => p !== pages[i]).length} page(s)`)
    for (const p of next) {
      console.log(`        ${p.slug}: ${(p.content_blocks || []).map((b) => b.type).join(', ')}`)
    }

    if (APPLY) {
      const { error: upErr } = await supa
        .from('site_configs')
        .update({ pages_config: next })
        .eq('id', cfg.id)
      if (upErr) console.error(`   failed: ${upErr.message}`)
    }
  }

  console.log(
    APPLY
      ? `\nApplied updates to ${sitesTouched} site(s), ${pagesFixed} page(s) restructured.`
      : `\nDry run: ${sitesTouched} site(s), ${pagesFixed} page(s) would change. Re-run with --apply.`
  )
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
