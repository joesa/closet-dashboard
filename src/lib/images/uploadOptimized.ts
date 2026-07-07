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

/** Upload an already-optimized buffer to site-assets and return the public URL. */
export async function uploadPreparedImage(
  image: OptimizedImage,
  storagePath: string
): Promise<string> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.storage
    .from(SITE_ASSETS_BUCKET)
    .upload(storagePath, image.buffer, {
      contentType: image.mime,
      upsert: true,
    })
  if (error) throw error
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
