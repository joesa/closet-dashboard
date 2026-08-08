import sharp from 'sharp'

export type ImageUploadKind = 'logo' | 'gallery' | 'hero' | 'product' | 'general'

type Profile = {
  maxWidth: number
  maxHeight: number
  quality: number
  upscaleLongEdge?: number
}

/**
 * High-quality optimization profiles. We resize only when the source exceeds
 * sensible display bounds and keep quality high so bespoke customer photos
 * still look premium on the live site.
 */
const PROFILES: Record<ImageUploadKind, Profile> = {
  // Heroes are full-bleed and often viewed on high-DPI displays. Preserve a
  // genuine 4K source and bring smaller generated/uploaded heroes to a 3840px
  // long edge before high-quality encoding.
  logo: { maxWidth: 800, maxHeight: 800, quality: 90 },
  gallery: { maxWidth: 1600, maxHeight: 1600, quality: 82 },
  hero: { maxWidth: 3840, maxHeight: 3840, quality: 92, upscaleLongEdge: 3840 },
  product: { maxWidth: 1400, maxHeight: 1400, quality: 82 },
  general: { maxWidth: 1600, maxHeight: 1600, quality: 82 },
}

const MAX_INPUT_PIXELS = 40_000_000
const FORMAT_MIME: Record<string, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
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
  const image = sharp(input, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS }).rotate()
  const meta = await image.metadata()

  const width = meta.width ?? 0
  const height = meta.height ?? 0
  const actualMime = meta.format ? FORMAT_MIME[meta.format] : undefined
  const declaredMime = mimeHint?.toLowerCase().split(';')[0].trim()
  if (!actualMime) throw new Error('Unsupported or corrupt image format')
  if (declaredMime && declaredMime !== actualMime) {
    throw new Error('File contents do not match the declared image type')
  }
  if (!width || !height || width * height > MAX_INPUT_PIXELS) {
    throw new Error('Image dimensions are invalid or too large')
  }
  if ((meta.pages || 1) > 1) throw new Error('Animated images are not supported')
  const longEdge = Math.max(width, height)
  const needsResize =
    width > profile.maxWidth ||
    height > profile.maxHeight ||
    (profile.upscaleLongEdge !== undefined && longEdge < profile.upscaleLongEdge)
  const enlarging =
    profile.upscaleLongEdge !== undefined && longEdge < profile.upscaleLongEdge

  let pipeline = image
  if (needsResize) {
    const landscape = width >= height
    pipeline = pipeline.resize({
      width: landscape ? profile.maxWidth : undefined,
      height: landscape ? undefined : profile.maxHeight,
      fit: 'inside',
      withoutEnlargement: !enlarging,
      kernel: sharp.kernel.lanczos3,
    })
  }

  if (enlarging) {
    pipeline = pipeline.sharpen({ sigma: 0.8, m1: 0.5, m2: 1.5 })
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
