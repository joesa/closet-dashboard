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
  logo: { maxWidth: 800, maxHeight: 800, quality: 92 },
  gallery: { maxWidth: 2400, maxHeight: 2400, quality: 88 },
  hero: { maxWidth: 2560, maxHeight: 1440, quality: 90 },
  product: { maxWidth: 1920, maxHeight: 1920, quality: 88 },
  general: { maxWidth: 2048, maxHeight: 2048, quality: 88 },
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

  // Hero/gallery/product: WebP at high quality — great compression without
  // the mushy look of aggressive JPEG recompression on customer photos.
  const buffer = await pipeline
    .webp({ quality: profile.quality, effort: 4, smartSubsample: true })
    .toBuffer()
  return { buffer, mime: 'image/webp', ext: 'webp' }
}
