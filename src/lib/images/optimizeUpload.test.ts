import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { optimizeUserImage } from './optimizeUpload'
import { guessImageUploadKind } from '@/lib/customSiteAssets'

describe('optimizeUserImage', () => {
  it('preserves a 4K hero at high-quality UHD dimensions', async () => {
    const sharp = (await import('sharp')).default
    const source = await sharp({
      create: {
        width: 3840,
        height: 2160,
        channels: 3,
        background: { r: 42, g: 96, b: 118 },
      },
    }).jpeg({ quality: 95 })
      .toBuffer()

    const out = await optimizeUserImage(source, 'hero', 'image/jpeg')
    expect(out.mime).toBe('image/jpeg')
    expect(out.ext).toBe('jpg')
    const meta = await sharp(out.buffer).metadata()
    expect(meta.width).toBe(3840)
    expect(meta.height).toBe(2160)
  })

  it('upscales and sharpens a smaller generated hero to a 4K long edge', async () => {
    const sharp = (await import('sharp')).default
    const source = await sharp({
      create: {
        width: 1536,
        height: 1024,
        channels: 3,
        background: { r: 116, g: 88, b: 64 },
      },
    }).png().toBuffer()

    const out = await optimizeUserImage(source, 'hero', 'image/png')
    const meta = await sharp(out.buffer).metadata()
    expect(meta.width).toBe(3840)
    expect(meta.height).toBe(2560)
  }, 15_000)
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
    expect(src).toContain('opts.imageUploadKind ?? guessImageUploadKind(opts.fileName)')
    expect(src).toContain('finalizeCustomImageAfterDirectUpload')
  })

  it('dashboard hero replacements request the hero upload profile', () => {
    const page = readFileSync(join(__dirname, '../../app/dashboard/website/page.tsx'), 'utf8')
    const route = readFileSync(join(__dirname, '../../app/api/dashboard/site-media/route.ts'), 'utf8')
    expect(page).toContain("form.append('imageUploadKind', 'hero')")
    expect(route).toContain("form.get('imageUploadKind') === 'hero' ? 'hero' : undefined")
    expect(route).toContain('imageUploadKind,')
  })

  it('AI site assets go through uploadOptimizedBuffer', () => {
    const src = readFileSync(join(__dirname, '../openai-images.ts'), 'utf8')
    expect(src).toContain('uploadOptimizedBuffer')
  })
})
