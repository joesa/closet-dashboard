
/**
 * sharp is loaded on demand, never at module scope.
 *
 * A static `import sharp from 'sharp'` links libvips the moment anything in
 * this module's import graph is pulled in, and on Vercel that dlopen fails
 * (`libvips-cpp.so.8.18.3: cannot open shared object file`). The failure is not
 * confined to image work: it takes down every route that transitively imports
 * this file. /api/intake/pro/start died that way, and so did the provisioning
 * fallback cron — which meant the only automatic recovery for a stuck
 * provision job had been returning 500 to every call.
 */
async function loadSharp() {
  return (await import('sharp')).default
}

const MAX_PIXELS = 40_000_000
const MAX_DIMENSION = 12_000
const MAX_SVG_BYTES = 512 * 1024
const FORMAT_MIME: Record<string, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

export type PreparedContentImage = {
  buffer: Buffer
  mime: 'image/jpeg' | 'image/png' | 'image/webp'
  fileName: string
}

function pngName(fileName: string) {
  return `${fileName.replace(/\.[^.]+$/, '') || 'logo'}.png`
}

async function rasterizeSvg(buffer: Buffer, fileName: string): Promise<PreparedContentImage> {
  if (buffer.length > MAX_SVG_BYTES) throw new Error('SVG logos must be under 512KB')
  const source = buffer.toString('utf8').replace(/^\uFEFF/, '')
  if (!/^\s*<svg[\s>]/i.test(source)) throw new Error('Invalid SVG logo')
  if (/<!DOCTYPE|<!ENTITY|<script\b|<foreignObject\b|<(?:iframe|object|embed)\b/i.test(source)) {
    throw new Error('SVG contains active or external content')
  }
  if (/\bon\w+\s*=|\b(?:href|xlink:href)\s*=\s*(['"])(?!#)[^'"]*\1|url\s*\(|@import/i.test(source)) {
    throw new Error('SVG contains event handlers or external references')
  }
  try {
    const sharp = await loadSharp()
    const image = sharp(Buffer.from(source), {
      failOn: 'error',
      limitInputPixels: MAX_PIXELS,
      density: 192,
    })
    const metadata = await image.metadata()
    const width = metadata.width || 0
    const height = metadata.height || 0
    if (!width || !height || width > MAX_DIMENSION || height > MAX_DIMENSION) {
      throw new Error('SVG dimensions are invalid or too large')
    }
    const output = await image.png({ compressionLevel: 9 }).toBuffer()
    return { buffer: output, mime: 'image/png', fileName: pngName(fileName) }
  } catch (error) {
    throw new Error(error instanceof Error ? `Invalid SVG logo: ${error.message}` : 'Invalid SVG logo')
  }
}

/** Verify decoded type/dimensions, reject polyglot MIME claims, and rasterize SVG. */
export async function prepareContentImageUpload(opts: {
  buffer: Buffer
  declaredMime: string
  fileName: string
  allowSvg: boolean
}): Promise<PreparedContentImage> {
  const declared = opts.declaredMime.toLowerCase().split(';')[0].trim()
  if (declared === 'image/svg+xml') {
    if (!opts.allowSvg) throw new Error('SVG is only supported for logos')
    return rasterizeSvg(opts.buffer, opts.fileName)
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(declared)) {
    throw new Error('Use JPEG, PNG, or WebP images')
  }
  try {
    const sharp = await loadSharp()
    const image = sharp(opts.buffer, { failOn: 'error', limitInputPixels: MAX_PIXELS })
    const metadata = await image.metadata()
    const detectedMime = metadata.format ? FORMAT_MIME[metadata.format] : undefined
    if (!detectedMime || detectedMime !== declared) {
      throw new Error('File contents do not match the declared image type')
    }
    const width = metadata.width || 0
    const height = metadata.height || 0
    if (!width || !height || width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_PIXELS) {
      throw new Error('Image dimensions are invalid or too large')
    }
    if ((metadata.pages || 1) > 1) throw new Error('Animated images are not supported')
    return { buffer: opts.buffer, mime: detectedMime as PreparedContentImage['mime'], fileName: opts.fileName }
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Invalid or corrupt image')
  }
}
