import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { prepareContentImageUpload } from './mediaSecurity'

describe('prepareContentImageUpload', () => {
  it('rejects a file whose bytes do not match its declared MIME type', async () => {
    const png = await sharp({
      create: { width: 8, height: 8, channels: 3, background: '#228844' },
    }).png().toBuffer()
    await expect(
      prepareContentImageUpload({ buffer: png, declaredMime: 'image/jpeg', fileName: 'fake.jpg', allowSvg: false })
    ).rejects.toThrow(/do not match/i)
  })

  it('rejects corrupt image bytes', async () => {
    await expect(
      prepareContentImageUpload({ buffer: Buffer.from('<script>alert(1)</script>'), declaredMime: 'image/png', fileName: 'attack.png', allowSvg: false })
    ).rejects.toThrow()
  })

  it('rejects active SVG and external references', async () => {
    const malicious = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>')
    await expect(
      prepareContentImageUpload({ buffer: malicious, declaredMime: 'image/svg+xml', fileName: 'logo.svg', allowSvg: true })
    ).rejects.toThrow(/active or external/i)
  })

  it('rasterizes a safe SVG logo to inert PNG bytes', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="12" height="8"><rect width="12" height="8" fill="#247a52"/></svg>')
    const output = await prepareContentImageUpload({
      buffer: svg,
      declaredMime: 'image/svg+xml',
      fileName: 'logo.svg',
      allowSvg: true,
    })
    expect(output.mime).toBe('image/png')
    expect(output.fileName).toBe('logo.png')
    expect((await sharp(output.buffer).metadata()).format).toBe('png')
  })
})
