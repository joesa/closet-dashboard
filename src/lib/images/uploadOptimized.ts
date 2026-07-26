import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { decodeDataUrl, isDataImageUrl } from '@/lib/images/decodeDataUrl'
import {
  optimizeUserImage,
  type ImageUploadKind,
  type OptimizedImage,
} from '@/lib/images/optimizeUpload'

const SITE_ASSETS_BUCKET = 'site-assets'

export async function uploadOptimizedBuffer(
  buffer: Buffer,
  storagePath: string,
  kind: ImageUploadKind,
  mimeHint?: string
): Promise<string> {
  const optimized = await optimizeUserImage(buffer, kind, mimeHint)
  const path = storagePath.includes('.')
    ? storagePath.replace(/\.[^.]+$/, `.${optimized.ext}`)
    : `${storagePath}.${optimized.ext}`
  return uploadPreparedImage(optimized, path)
}

/**
 * Upload bytes to the public site-assets bucket via the Storage REST API.
 *
 * Uses raw fetch + Uint8Array body on purpose. supabase-js storage upload has
 * been observed on Vercel to persist UTF-8-mangled binaries (U+FFFD in the
 * object) even when the local Buffer/Uint8Array was valid — which shows up as
 * broken <img> tags for user uploads.
 */
export async function uploadPreparedImage(
  image: OptimizedImage,
  storagePath: string
): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!baseUrl || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  // Copy into a clean ArrayBuffer-backed view (avoid Buffer pool / SharedArrayBuffer quirks).
  const bytes = Uint8Array.from(image.buffer)

  const endpoint = `${baseUrl}/storage/v1/object/${SITE_ASSETS_BUCKET}/${storagePath}`
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'Content-Type': image.mime,
      'x-upsert': 'true',
      'cache-control': 'max-age=3600',
    },
    body: bytes,
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Storage upload failed (${res.status}): ${detail.slice(0, 300)}`)
  }

  // Prefer supabase helper for consistent public URL formatting.
  const supabase = getSupabaseAdmin()
  return supabase.storage.from(SITE_ASSETS_BUCKET).getPublicUrl(storagePath).data.publicUrl
}

/**
 * If `url` is a data URL, optimize + upload it. Otherwise return HTTPS URLs
 * unchanged (already hosted assets, including AI-generated images).
 */
export async function persistImageUrl(
  url: string,
  storagePath: string,
  kind: ImageUploadKind
): Promise<string> {
  const trimmed = url.trim()
  if (!trimmed) return trimmed
  if (!isDataImageUrl(trimmed)) return trimmed

  const decoded = decodeDataUrl(trimmed)
  if (!decoded) return trimmed

  return uploadOptimizedBuffer(decoded.buffer, storagePath, kind, decoded.mime)
}
