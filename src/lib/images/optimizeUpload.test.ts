import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { optimizeUserImage } from './optimizeUpload'
import { guessImageUploadKind } from '@/lib/customSiteAssets'

describe('optimizeUserImage', () => {
  it('shrinks a large synthetic JPEG under hero bounds', async () => {
    const sharp = (await import('sharp')).default
    // Noise so mozjpeg cannot crush the buffer to a few KB.
    const noise = Buffer.alloc(3000 * 2000 * 3)
    for (let i = 0; i < noise.length; i++) noise[i] = (i * 17 + (i % 251)) & 255
    const big = await sharp(noise, {
      raw: { width: 3000, height: 2000, channels: 3 },
    })
      .jpeg({ quality: 95 })
      .toBuffer()

    expect(big.length).toBeGreaterThan(200_000)
    const out = await optimizeUserImage(big, 'hero', 'image/jpeg')
    expect(out.mime).toBe('image/jpeg')
    expect(out.ext).toBe('jpg')
    expect(out.buffer.length).toBeLessThan(big.length)
    const meta = await sharp(out.buffer).metadata()
    expect(meta.width || 0).toBeLessThanOrEqual(1920)
    expect(meta.height || 0).toBeLessThanOrEqual(1080)
  })
})

describe('guessImageUploadKind', () => {
  it('maps hero/logo/product names', () => {
    expect(guessImageUploadKind('hero_bus.jpg')).toBe('hero')
    expect(guessImageUploadKind('brand-logo.png')).toBe('logo')
    expect(guessImageUploadKind('service-card-1.jpg')).toBe('product')
    expect(guessImageUploadKind('random-shot.jpg')).toBe('general')
  })
})

describe('upload path wiring', () => {
  it('admin custom assets optimize images before storage', () => {
    const src = readFileSync(join(__dirname, '../customSiteAssets.ts'), 'utf8')
    expect(src).toContain('optimizeUserImage')
    expect(src).toContain('finalizeCustomImageAfterDirectUpload')
  })

  it('AI site assets go through uploadOptimizedBuffer', () => {
    const src = readFileSync(join(__dirname, '../openai-images.ts'), 'utf8')
    expect(src).toContain('uploadOptimizedBuffer')
  })
})
