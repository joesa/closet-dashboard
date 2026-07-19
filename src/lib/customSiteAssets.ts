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
  }
}

/** List assets previously uploaded for this tenant's custom site. */
export async function listCustomSiteAssets(tenantId: string): Promise<CustomAssetRecord[]> {
  const supabase = getSupabaseAdmin()
  const prefix = assetPrefix(tenantId)
  const { data, error } = await supabase.storage.from(SITE_ASSETS_BUCKET).list(prefix, {
    limit: 200,
    sortBy: { column: 'updated_at', order: 'desc' },
  })
  if (error) throw new Error(`List failed: ${error.message}`)

  const rows: CustomAssetRecord[] = []
  for (const item of data || []) {
    if (!item.name || item.name.endsWith('/')) continue
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
    })
  }
  return rows
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

/**
 * Append an image (or link for other files) block to a page in the draft.
 */
export async function appendAssetToDraftPage(opts: {
  tenantId: string
  pagePath: string
  url: string
  kind: CustomAssetKind
  label?: string
}): Promise<CustomSiteConfig> {
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
    block = `\n<section style="margin:2rem 0;"><video controls style="width:100%;max-height:70vh;background:#000;"><source src="${opts.url}" type="video/mp4"></video></section>\n`
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
