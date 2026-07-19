import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  isCustomSiteConfig,
  sanitizeCustomConfig,
  type CustomSiteConfig,
} from '@/lib/customSite'

const SITE_ASSETS_BUCKET = 'site-assets'

export type CustomAssetKind = 'video' | 'image' | 'file'

export type CustomAssetRecord = {
  name: string
  path: string
  url: string
  size: number | null
  contentType: string | null
  kind: CustomAssetKind
  updatedAt: string | null
  /** custom/ uploads vs provisioned engine images under <slug>/ */
  source: 'custom' | 'engine'
}

const VIDEO_MIME = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-m4v',
])
const IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
])
const FILE_MIME = new Set([
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  'application/zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
])

const MAX_BYTES: Record<CustomAssetKind, number> = {
  video: 80 * 1024 * 1024, // 80MB
  image: 12 * 1024 * 1024, // 12MB
  file: 25 * 1024 * 1024, // 25MB
}

export function assetPrefix(tenantId: string): string {
  return `custom/${tenantId}`
}

export function classifyMime(mime: string): CustomAssetKind | null {
  const m = (mime || '').toLowerCase().split(';')[0].trim()
  if (VIDEO_MIME.has(m) || m.startsWith('video/')) return 'video'
  if (IMAGE_MIME.has(m) || m.startsWith('image/')) return 'image'
  if (FILE_MIME.has(m)) return 'file'
  return null
}

export function assertAllowedUpload(opts: {
  mime: string
  size: number
  kindHint?: CustomAssetKind
}): CustomAssetKind {
  const kind = opts.kindHint || classifyMime(opts.mime)
  if (!kind) {
    throw new Error(
      `Unsupported file type "${opts.mime}". Allowed: video (mp4/webm), images, PDF/DOC/TXT/CSV/ZIP.`
    )
  }
  // If caller forced a kind, still verify mime family matches.
  const detected = classifyMime(opts.mime)
  if (detected && detected !== kind && opts.kindHint) {
    throw new Error(`File MIME ${opts.mime} does not match selected kind "${kind}".`)
  }
  const max = MAX_BYTES[kind]
  if (opts.size > max) {
    throw new Error(
      `File too large (${Math.round(opts.size / (1024 * 1024))}MB). Max for ${kind}: ${Math.round(max / (1024 * 1024))}MB.`
    )
  }
  return kind
}

function safeFileName(name: string): string {
  const base = (name || 'upload').split(/[/\\]/).pop() || 'upload'
  return base
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120) || 'upload'
}

function extFromNameOrMime(name: string, mime: string): string {
  const fromName = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  if (fromName && /^[a-z0-9]{1,8}$/.test(fromName)) return fromName
  const map: Record<string, string> = {
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'application/pdf': 'pdf',
    'text/plain': 'txt',
    'text/csv': 'csv',
    'application/json': 'json',
    'application/zip': 'zip',
  }
  return map[mime.toLowerCase().split(';')[0].trim()] || 'bin'
}

function buildStoragePath(opts: {
  tenantId: string
  fileName: string
  mime: string
}): { path: string; name: string; contentType: string } {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const safe = safeFileName(opts.fileName)
  const contentType = opts.mime.split(';')[0].trim() || 'application/octet-stream'
  const ext = extFromNameOrMime(safe, contentType)
  const baseName = safe.replace(/\.[^.]+$/, '')
  return {
    path: `${assetPrefix(opts.tenantId)}/${stamp}-${baseName}.${ext}`,
    name: `${baseName}.${ext}`,
    contentType,
  }
}

/**
 * Create a short-lived signed upload URL so the browser can PUT the file
 * straight to Supabase (bypasses Vercel request body limits for video).
 */
export async function createCustomSiteAssetUpload(opts: {
  tenantId: string
  fileName: string
  mime: string
  size: number
  kindHint?: CustomAssetKind
}): Promise<{
  kind: CustomAssetKind
  path: string
  name: string
  contentType: string
  signedUrl: string
  token: string
  publicUrl: string
}> {
  const kind = assertAllowedUpload({
    mime: opts.mime,
    size: opts.size,
    kindHint: opts.kindHint,
  })
  const { path, name, contentType } = buildStoragePath(opts)
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.storage
    .from(SITE_ASSETS_BUCKET)
    .createSignedUploadUrl(path)
  if (error || !data) {
    throw new Error(`Could not create signed upload: ${error?.message || 'unknown'}`)
  }
  const { data: pub } = supabase.storage.from(SITE_ASSETS_BUCKET).getPublicUrl(path)
  return {
    kind,
    path,
    name,
    contentType,
    signedUrl: data.signedUrl,
    token: data.token,
    publicUrl: pub.publicUrl,
  }
}

/**
 * Upload a custom-site asset to the public site-assets bucket under
 * custom/<tenantId>/<stamp>-<name> and return its permanent CDN URL.
 * Prefer createCustomSiteAssetUpload + client PUT for files over ~4MB.
 */
export async function uploadCustomSiteAsset(opts: {
  tenantId: string
  buffer: Buffer
  fileName: string
  mime: string
  kindHint?: CustomAssetKind
}): Promise<CustomAssetRecord> {
  const kind = assertAllowedUpload({
    mime: opts.mime,
    size: opts.buffer.length,
    kindHint: opts.kindHint,
  })
  const { path, name, contentType } = buildStoragePath({
    tenantId: opts.tenantId,
    fileName: opts.fileName,
    mime: opts.mime,
  })

  const supabase = getSupabaseAdmin()
  const { error } = await supabase.storage.from(SITE_ASSETS_BUCKET).upload(path, opts.buffer, {
    contentType,
    upsert: false,
  })
  if (error) throw new Error(`Upload failed: ${error.message}`)

  const { data } = supabase.storage.from(SITE_ASSETS_BUCKET).getPublicUrl(path)
  return {
    name,
    path,
    url: data.publicUrl,
    size: opts.buffer.length,
    contentType,
    kind,
    updatedAt: new Date().toISOString(),
    source: 'custom',
  }
}

async function listStoragePrefix(
  prefix: string,
  source: 'custom' | 'engine'
): Promise<CustomAssetRecord[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.storage.from(SITE_ASSETS_BUCKET).list(prefix, {
    limit: 500,
    sortBy: { column: 'updated_at', order: 'desc' },
  })
  if (error) throw new Error(`List failed (${prefix}): ${error.message}`)

  const rows: CustomAssetRecord[] = []
  for (const item of data || []) {
    if (!item.name || item.name.endsWith('/')) continue
    // Skip nested "folder" placeholders Supabase sometimes returns.
    if (item.id === null && !item.metadata) continue
    const path = `${prefix}/${item.name}`
    const { data: pub } = supabase.storage.from(SITE_ASSETS_BUCKET).getPublicUrl(path)
    const mime =
      (item.metadata as { mimetype?: string } | null)?.mimetype ||
      guessMimeFromName(item.name)
    rows.push({
      name: item.name,
      path,
      url: pub.publicUrl,
      size: typeof item.metadata?.size === 'number' ? item.metadata.size : null,
      contentType: mime,
      kind: classifyMime(mime || '') || 'file',
      updatedAt: item.updated_at || null,
      source,
    })
  }
  return rows
}

/** Resolve platform asset slug (subdomain) for engine images under site-assets/<slug>/. */
export async function resolveTenantAssetSlug(tenantId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('domains')
    .select('hostname, source')
    .eq('tenant_id', tenantId)
    .eq('source', 'platform_subdomain')
    .maybeSingle()
  const host = (data?.hostname || '').trim()
  if (!host) return null
  const slug = host.split('.')[0]?.trim()
  return slug || null
}

export type ListTenantMediaOptions = {
  /** Filter to one kind, or omit / 'all' for everything. */
  kind?: CustomAssetKind | 'all'
  /** Include provisioned engine images under site-assets/<slug>/ (default true). */
  includeEngine?: boolean
}

/**
 * List admin-uploaded (and optionally provisioned) media for a tenant.
 * Custom uploads: site-assets/custom/<tenantId>/
 * Engine images:  site-assets/<subdomain>/
 */
export async function listTenantMediaAssets(
  tenantId: string,
  opts: ListTenantMediaOptions = {}
): Promise<CustomAssetRecord[]> {
  const kind = opts.kind && opts.kind !== 'all' ? opts.kind : null
  const includeEngine = opts.includeEngine !== false

  const custom = await listStoragePrefix(assetPrefix(tenantId), 'custom')
  let engine: CustomAssetRecord[] = []
  if (includeEngine) {
    const slug = await resolveTenantAssetSlug(tenantId)
    if (slug && slug !== 'custom') {
      try {
        engine = await listStoragePrefix(slug, 'engine')
      } catch {
        // Missing slug folder is fine for custom-only tenants.
        engine = []
      }
    }
  }

  const merged = [...custom, ...engine].sort((a, b) => {
    const ta = a.updatedAt ? Date.parse(a.updatedAt) : 0
    const tb = b.updatedAt ? Date.parse(b.updatedAt) : 0
    return tb - ta
  })

  if (!kind) return merged
  return merged.filter((r) => r.kind === kind)
}

/** @deprecated Prefer listTenantMediaAssets — kept for call sites that only need custom/. */
export async function listCustomSiteAssets(tenantId: string): Promise<CustomAssetRecord[]> {
  return listTenantMediaAssets(tenantId, { includeEngine: false })
}

export function mediaCounts(assets: CustomAssetRecord[]): {
  all: number
  image: number
  video: number
  file: number
} {
  return {
    all: assets.length,
    image: assets.filter((a) => a.kind === 'image').length,
    video: assets.filter((a) => a.kind === 'video').length,
    file: assets.filter((a) => a.kind === 'file').length,
  }
}

function guessMimeFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    txt: 'text/plain',
    csv: 'text/csv',
    json: 'application/json',
    zip: 'application/zip',
  }
  return map[ext] || 'application/octet-stream'
}

/**
 * Set the first empty (or first) <video><source src="..."> on the home page
 * to the given URL. Saves into custom_config_draft (creates draft from
 * published if needed).
 */
export async function applyVideoUrlToHomeDraft(
  tenantId: string,
  videoUrl: string
): Promise<{ changed: boolean; draft: CustomSiteConfig }> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('site_configs')
    .select('custom_config_draft, custom_config')
    .eq('tenant_id', tenantId)
    .single()
  if (error || !data) throw new Error('Site config not found')

  const base =
    (isCustomSiteConfig(data.custom_config_draft) && data.custom_config_draft) ||
    (isCustomSiteConfig(data.custom_config) && data.custom_config) ||
    null
  if (!base) {
    throw new Error('No custom site draft/published config to update — generate a custom site first.')
  }

  const draft: CustomSiteConfig = JSON.parse(JSON.stringify(base))
  const home = draft.pages['/']
  if (!home?.html) throw new Error('Home page missing from custom config.')

  let html = home.html
  let changed = false

  // Prefer filling an empty source first.
  if (/<source\b[^>]*\bsrc\s*=\s*(["'])\s*\1/i.test(html)) {
    html = html.replace(
      /(<source\b[^>]*\bsrc\s*=\s*)(["'])\s*\2/i,
      `$1$2${videoUrl}$2`
    )
    changed = true
  } else if (/<source\b[^>]*\bsrc\s*=\s*(["'])[^"']*\1/i.test(html)) {
    html = html.replace(
      /(<source\b[^>]*\bsrc\s*=\s*)(["'])[^"']*\2/i,
      `$1$2${videoUrl}$2`
    )
    changed = true
  } else if (/<video\b[^>]*\bsrc\s*=\s*(["'])\s*\1/i.test(html)) {
    html = html.replace(
      /(<video\b[^>]*\bsrc\s*=\s*)(["'])\s*\2/i,
      `$1$2${videoUrl}$2`
    )
    changed = true
  } else if (/<video\b/i.test(html)) {
    // Has <video> but no source — inject one.
    html = html.replace(
      /(<video\b[^>]*>)/i,
      `$1\n<source src="${videoUrl}" type="video/mp4">`
    )
    changed = true
  } else {
    // No video element — append a simple testimonial block.
    html += `
<section class="container" style="padding: 2rem 1.5rem 4rem;">
  <div class="card" style="text-align:center;">
    <h2 style="margin-bottom:1.5rem;">Client Testimonial</h2>
    <div style="aspect-ratio:16/9;overflow:hidden;">
      <video controls style="width:100%;height:100%;background:#000;">
        <source src="${videoUrl}" type="video/mp4">
      </video>
    </div>
  </div>
</section>`
    changed = true
  }

  home.html = html
  draft.pages['/'] = home
  const sanitized = sanitizeCustomConfig(draft)

  const { error: updateErr } = await supabase
    .from('site_configs')
    .update({
      custom_config_draft: sanitized,
      custom_updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
  if (updateErr) throw new Error(`Failed to update draft: ${updateErr.message}`)

  return { changed, draft: sanitized }
}

function videoSectionHtml(videoUrl: string, heading = 'Featured video'): string {
  const safeUrl = videoUrl.replace(/"/g, '')
  const safeHeading = heading.replace(/[<>&"]/g, '')
  return `
<section data-custom-video style="padding:2.5rem 1.5rem 4rem;max-width:960px;margin:0 auto;">
  <h2 style="margin:0 0 1.25rem;font-size:1.5rem;text-align:center;">${safeHeading}</h2>
  <div style="aspect-ratio:16/9;overflow:hidden;border-radius:12px;background:#000;">
    <video controls playsinline style="width:100%;height:100%;display:block;background:#000;">
      <source src="${safeUrl}" type="video/mp4">
    </video>
  </div>
</section>`
}

/** Insert a video block immediately after the first hero-like section, else after first </section>, else append. */
export function insertVideoAfterHero(html: string, videoUrl: string): string {
  const block = videoSectionHtml(videoUrl)
  if (/data-custom-video/i.test(html) && /<source\b/i.test(html)) {
    // Replace existing custom video source rather than stacking duplicates.
    if (/<source\b[^>]*\bsrc\s*=\s*(["'])[^"']*\1/i.test(html)) {
      return html.replace(
        /(<source\b[^>]*\bsrc\s*=\s*)(["'])[^"']*\2/i,
        `$1$2${videoUrl.replace(/"/g, '')}$2`
      )
    }
  }

  const heroClose =
    /(<section\b[^>]*(?:hero|banner|splash)[^>]*>[\s\S]*?<\/section>)/i.exec(html) ||
    /(<header\b[^>]*>[\s\S]*?<\/header>)/i.exec(html)
  if (heroClose && heroClose.index != null) {
    const end = heroClose.index + heroClose[0].length
    return `${html.slice(0, end)}\n${block}\n${html.slice(end)}`
  }

  const firstSection = /<\/section>/i.exec(html)
  if (firstSection && firstSection.index != null) {
    const end = firstSection.index + firstSection[0].length
    return `${html.slice(0, end)}\n${block}\n${html.slice(end)}`
  }

  return `${html || ''}\n${block}`
}

/**
 * Ensure a custom draft exists (bootstrapping a simple home page from engine
 * brand/hero fields when needed), then place the video after the hero.
 */
export async function ensureHomeVideoAfterHero(opts: {
  tenantId: string
  videoUrl: string
}): Promise<{ draft: CustomSiteConfig; bootstrapped: boolean }> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('site_configs')
    .select(
      'custom_config_draft, custom_config, brand_name, hero_config, about_config, products_config'
    )
    .eq('tenant_id', opts.tenantId)
    .single()
  if (error || !data) throw new Error('Site config not found')

  let bootstrapped = false
  let base =
    (isCustomSiteConfig(data.custom_config_draft) && data.custom_config_draft) ||
    (isCustomSiteConfig(data.custom_config) && data.custom_config) ||
    null

  if (!base) {
    bootstrapped = true
    const brand = String(data.brand_name || 'Our Company').replace(/[<>&"]/g, '')
    const hero = (data.hero_config || {}) as {
      headline?: string
      subheadline?: string
      backgroundImage?: string
    }
    const headline = String(hero.headline || brand).replace(/[<>&"]/g, '').slice(0, 80)
    const sub = String(hero.subheadline || '').replace(/[<>&"]/g, '').slice(0, 200)
    const bg =
      typeof hero.backgroundImage === 'string' &&
      !/\.(mp4|webm|mov)(\?|$)/i.test(hero.backgroundImage)
        ? hero.backgroundImage.replace(/"/g, '')
        : ''
    const about = String(
      (data.about_config as { description?: string } | null)?.description || ''
    )
      .replace(/[<>&"]/g, '')
      .slice(0, 600)
    const products = Array.isArray(data.products_config) ? data.products_config : []
    const serviceLis = products
      .slice(0, 6)
      .map((p: { title?: string }) =>
        typeof p?.title === 'string'
          ? `<li style="margin:0.35rem 0;">${p.title.replace(/[<>&"]/g, '')}</li>`
          : ''
      )
      .join('')

    base = {
      mode: 'inline',
      globalCss: `body{margin:0;font-family:Georgia,serif;color:#111;background:#f6f4f1;}a{color:inherit;}`,
      pages: {
        '/': {
          title: brand,
          html: `
<section class="hero" style="min-height:55vh;display:flex;align-items:flex-end;padding:3rem 1.5rem;background:${
            bg
              ? `#111 url('${bg}') center/cover no-repeat`
              : 'linear-gradient(145deg,#1a1a1a,#333)'
          };color:#fff;">
  <div style="max-width:720px;">
    <p style="letter-spacing:0.12em;text-transform:uppercase;font-size:0.75rem;opacity:0.8;margin:0 0 0.75rem;">${brand}</p>
    <h1 style="margin:0;font-size:clamp(2rem,5vw,3.25rem);line-height:1.1;">${headline}</h1>
    ${sub ? `<p style="margin:1rem 0 0;font-size:1.1rem;opacity:0.9;max-width:36rem;">${sub}</p>` : ''}
  </div>
</section>
${about ? `<section style="padding:2.5rem 1.5rem;max-width:720px;margin:0 auto;"><p style="font-size:1.1rem;line-height:1.6;">${about}</p></section>` : ''}
${serviceLis ? `<section style="padding:1rem 1.5rem 3rem;max-width:720px;margin:0 auto;"><h2 style="font-size:1.35rem;">Services</h2><ul style="padding-left:1.2rem;">${serviceLis}</ul></section>` : ''}
`,
        },
      },
    }
  }

  const draft: CustomSiteConfig = JSON.parse(JSON.stringify(base))
  const home = draft.pages['/'] || Object.values(draft.pages)[0]
  if (!home) throw new Error('Home page missing from custom config.')
  home.html = insertVideoAfterHero(home.html || '', opts.videoUrl)
  draft.pages['/'] = home
  const sanitized = sanitizeCustomConfig(draft)

  const { error: updateErr } = await supabase
    .from('site_configs')
    .update({
      custom_config_draft: sanitized,
      custom_updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', opts.tenantId)
  if (updateErr) throw new Error(`Failed to update draft: ${updateErr.message}`)
  return { draft: sanitized, bootstrapped }
}

/**
 * Append an image (or link for other files) block to a page in the draft.
 */
export async function appendAssetToDraftPage(opts: {
  tenantId: string
  pagePath: string
  url: string
  kind: CustomAssetKind
  label?: string
  /** When 'after_hero' and kind is video, insert after hero instead of page end. */
  position?: 'end' | 'after_hero'
}): Promise<CustomSiteConfig> {
  if (opts.kind === 'video' && opts.position === 'after_hero') {
    const { draft } = await ensureHomeVideoAfterHero({
      tenantId: opts.tenantId,
      videoUrl: opts.url,
    })
    return draft
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('site_configs')
    .select('custom_config_draft, custom_config')
    .eq('tenant_id', opts.tenantId)
    .single()
  if (error || !data) throw new Error('Site config not found')

  const base =
    (isCustomSiteConfig(data.custom_config_draft) && data.custom_config_draft) ||
    (isCustomSiteConfig(data.custom_config) && data.custom_config) ||
    null
  if (!base) {
    throw new Error('No custom site draft/published config — generate a custom site first.')
  }

  const draft: CustomSiteConfig = JSON.parse(JSON.stringify(base))
  const path = opts.pagePath.startsWith('/') ? opts.pagePath : `/${opts.pagePath}`
  const page = draft.pages[path] || draft.pages['/']
  if (!page) throw new Error(`Page ${path} not found in custom config.`)

  const label = (opts.label || 'Asset').replace(/[<>&"]/g, '')
  let block = ''
  if (opts.kind === 'image') {
    block = `\n<figure style="margin:2rem 0;text-align:center;"><img src="${opts.url}" alt="${label}" style="max-width:100%;height:auto;border-radius:8px;" /><figcaption style="margin-top:0.5rem;opacity:0.7;">${label}</figcaption></figure>\n`
  } else if (opts.kind === 'video') {
    block = videoSectionHtml(opts.url, label || 'Featured video')
  } else {
    block = `\n<p style="margin:1.5rem 0;"><a href="${opts.url}" target="_blank" rel="noopener noreferrer">${label}</a></p>\n`
  }

  page.html = `${page.html || ''}${block}`
  draft.pages[path] = page
  const sanitized = sanitizeCustomConfig(draft)

  const { error: updateErr } = await supabase
    .from('site_configs')
    .update({
      custom_config_draft: sanitized,
      custom_updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', opts.tenantId)
  if (updateErr) throw new Error(`Failed to update draft: ${updateErr.message}`)
  return sanitized
}
