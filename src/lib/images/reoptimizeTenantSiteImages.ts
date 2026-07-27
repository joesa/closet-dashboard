import { createHash } from 'crypto'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  isCustomSiteConfig,
  sanitizeCustomConfig,
  type CustomSiteConfig,
} from '@/lib/customSite'
import { optimizeUserImage, type ImageUploadKind } from '@/lib/images/optimizeUpload'
import { uploadPreparedImage } from '@/lib/images/uploadOptimized'
import { guessImageUploadKind } from '@/lib/customSiteAssets'

const IMAGE_URL_RE =
  /https:\/\/[^\s"'\\]+\.(?:jpe?g|png|webp|gif|avif)(?:\?[^\s"'\\]*)?/gi

export type ReoptimizeResult = {
  tenantId: string
  scanned: number
  optimized: number
  skipped: number
  failed: number
  bytesBefore: number
  bytesAfter: number
  replacements: Array<{ from: string; to: string; before: number; after: number }>
  errors: string[]
}

function collectImageUrls(...blobs: string[]): string[] {
  const set = new Set<string>()
  for (const blob of blobs) {
    for (const m of blob.matchAll(IMAGE_URL_RE)) {
      const u = m[0].replace(/[),.;]+$/, '')
      if (/site-assets\//i.test(u)) set.add(u)
    }
  }
  return [...set]
}

function rewriteUrlsInText(
  text: string,
  map: Map<string, string>
): string {
  if (!text || map.size === 0) return text
  let out = text
  for (const [from, to] of map) {
    if (from === to) continue
    out = out.split(from).join(to)
  }
  return out
}

function rewriteConfig(
  config: CustomSiteConfig,
  map: Map<string, string>
): CustomSiteConfig {
  const next = structuredClone(config)
  next.globalCss = rewriteUrlsInText(next.globalCss || '', map)
  for (const [path, page] of Object.entries(next.pages || {})) {
    next.pages[path] = {
      ...page,
      html: rewriteUrlsInText(page.html || '', map),
      css: page.css ? rewriteUrlsInText(page.css, map) : page.css,
    }
  }
  return next
}

function kindForUrl(url: string): ImageUploadKind {
  const name = decodeURIComponent(url.split('/').pop() || '')
  if (/\/product-|product_/i.test(url) || /product-/i.test(name)) return 'product'
  if (/hero/i.test(name) || /\/hero/i.test(url)) return 'hero'
  if (/logo/i.test(name)) return 'logo'
  return guessImageUploadKind(name)
}

/**
 * Download every site-assets image referenced by draft+published custom HTML,
 * re-encode with sharp, upload under custom/<tenantId>/opt/, rewrite URLs.
 */
export async function reoptimizeTenantSiteImages(
  tenantId: string
): Promise<ReoptimizeResult> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('site_configs')
    .select('custom_config, custom_config_draft')
    .eq('tenant_id', tenantId)
    .single()
  if (error || !data) throw new Error(error?.message || 'Site config not found')

  const draft = isCustomSiteConfig(data.custom_config_draft)
    ? data.custom_config_draft
    : null
  const published = isCustomSiteConfig(data.custom_config)
    ? data.custom_config
    : null

  const urls = collectImageUrls(
    draft ? JSON.stringify(draft) : '',
    published ? JSON.stringify(published) : ''
  )

  const result: ReoptimizeResult = {
    tenantId,
    scanned: urls.length,
    optimized: 0,
    skipped: 0,
    failed: 0,
    bytesBefore: 0,
    bytesAfter: 0,
    replacements: [],
    errors: [],
  }

  const map = new Map<string, string>()

  for (const url of urls) {
    try {
      // Already an opt/ object from a prior run — still re-check size.
      const res = await fetch(url)
      if (!res.ok) {
        result.failed += 1
        result.errors.push(`${url} → HTTP ${res.status}`)
        continue
      }
      const mime = (res.headers.get('content-type') || 'image/jpeg').split(';')[0]
      if (mime === 'image/svg+xml') {
        result.skipped += 1
        continue
      }
      const buf = Buffer.from(await res.arrayBuffer())
      result.bytesBefore += buf.length

      // Skip tiny already-small files (<120KB) unless PNG (often huge).
      if (buf.length < 120_000 && !/png/i.test(mime) && !/\.png(\?|$)/i.test(url)) {
        result.skipped += 1
        result.bytesAfter += buf.length
        continue
      }

      const kind = kindForUrl(url)
      const optimized = await optimizeUserImage(buf, kind, mime)
      if (optimized.buffer.length >= buf.length * 0.95 && optimized.buffer.length > 80_000) {
        // Negligible gain — keep original
        result.skipped += 1
        result.bytesAfter += buf.length
        continue
      }

      const hash = createHash('sha1').update(optimized.buffer).digest('hex').slice(0, 12)
      const baseName = (url.split('/').pop() || 'image')
        .replace(/\?.*$/, '')
        .replace(/\.[^.]+$/, '')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .slice(0, 80)
      const path = `custom/${tenantId}/opt/${baseName}-${hash}.${optimized.ext}`
      const newUrl = await uploadPreparedImage(optimized, path)

      map.set(url, newUrl)
      result.optimized += 1
      result.bytesAfter += optimized.buffer.length
      result.replacements.push({
        from: url,
        to: newUrl,
        before: buf.length,
        after: optimized.buffer.length,
      })
    } catch (err) {
      result.failed += 1
      result.errors.push(
        `${url} → ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  if (map.size === 0) return result

  const updates: Record<string, unknown> = {
    custom_updated_at: new Date().toISOString(),
  }
  if (draft) {
    updates.custom_config_draft = sanitizeCustomConfig(rewriteConfig(draft, map))
  }
  if (published) {
    updates.custom_config = sanitizeCustomConfig(rewriteConfig(published, map))
  }

  const { error: upErr } = await supabase
    .from('site_configs')
    .update(updates)
    .eq('tenant_id', tenantId)
  if (upErr) throw new Error(`Failed to save rewritten config: ${upErr.message}`)

  try {
    const { revalidateTenantSiteCache } = await import(
      '@/lib/tenants/revalidateTenantSite'
    )
    await revalidateTenantSiteCache(tenantId)
  } catch (revalErr) {
    console.warn('[reoptimizeTenantSiteImages] revalidate failed:', revalErr)
  }

  return result
}
