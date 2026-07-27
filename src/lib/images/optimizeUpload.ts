import sharp from 'sharp'

export type ImageUploadKind = 'logo' | 'gallery' | 'hero' | 'product' | 'general'

type Profile = {
  maxWidth: number
  maxHeight: number
  quality: number
}

/**
 * High-quality optimization profiles. We resize only when the source exceeds
 * sensible display bounds and keep quality high so bespoke customer photos
 * still look premium on the live site.
 */
const PROFILES: Record<ImageUploadKind, Profile> = {
  // Tuned for web: enough pixels for retina heroes/cards, mozjpeg keeps quality.
  logo: { maxWidth: 800, maxHeight: 800, quality: 90 },
  gallery: { maxWidth: 1600, maxHeight: 1600, quality: 82 },
  hero: { maxWidth: 1920, maxHeight: 1080, quality: 85 },
  product: { maxWidth: 1400, maxHeight: 1400, quality: 82 },
  general: { maxWidth: 1600, maxHeight: 1600, quality: 82 },
}

export type OptimizedImage = {
  buffer: Buffer
  mime: string
  ext: string
}

/**
 * Resize (only when needed), auto-orient, strip metadata, and re-encode user
 * uploads for fast delivery while preserving a bespoke, high-end look.
 */
export async function optimizeUserImage(
  input: Buffer,
  kind: ImageUploadKind,
  mimeHint?: string
): Promise<OptimizedImage> {
  if (mimeHint === 'image/svg+xml') {
    return { buffer: input, mime: 'image/svg+xml', ext: 'svg' }
  }

  const profile = PROFILES[kind]
  const image = sharp(input, { failOn: 'none' }).rotate()
  const meta = await image.metadata()

  const width = meta.width ?? 0
  const height = meta.height ?? 0
  const needsResize = width > profile.maxWidth || height > profile.maxHeight

  let pipeline = image
  if (needsResize) {
    pipeline = pipeline.resize({
      width: profile.maxWidth,
      height: profile.maxHeight,
      fit: 'inside',
      withoutEnlargement: true,
    })
  }

  // Logos often need transparency — keep PNG at high quality.
  if (kind === 'logo' && meta.hasAlpha) {
    const buffer = await pipeline
      .png({ compressionLevel: 9, quality: Math.min(profile.quality + 3, 100) })
      .toBuffer()
    return { buffer, mime: 'image/png', ext: 'png' }
  }

  // Prefer JPEG for user-uploaded photos. WebP is fine when the upload path is
  // healthy, but JPEG is universally decodable and avoids a class of storage
  // client bugs that corrupted WebP binaries in production.
  const buffer = await pipeline.jpeg({ quality: profile.quality, mozjpeg: true }).toBuffer()
  return { buffer, mime: 'image/jpeg', ext: 'jpg' }
}
