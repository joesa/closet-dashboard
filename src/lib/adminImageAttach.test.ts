import { describe, expect, it } from 'vitest'
import {
  MAX_ADMIN_IMAGE_ATTACHMENTS,
  normalizeAdminImageDataUrls,
  parseAdminImageDataUrl,
} from './adminImageAttach'

describe('parseAdminImageDataUrl', () => {
  it('parses jpeg data urls', () => {
    const raw = 'data:image/jpeg;base64,abc123+/='
    expect(parseAdminImageDataUrl(raw)).toEqual({
      mimeType: 'image/jpeg',
      data: 'abc123+/=',
    })
  })

  it('normalizes image/jpg to image/jpeg', () => {
    expect(parseAdminImageDataUrl('data:image/jpg;base64,xx')?.mimeType).toBe(
      'image/jpeg'
    )
  })

  it('rejects non-images', () => {
    expect(parseAdminImageDataUrl('data:text/plain;base64,xx')).toBeNull()
    expect(parseAdminImageDataUrl('https://example.com/a.png')).toBeNull()
  })
})

describe('normalizeAdminImageDataUrls', () => {
  it('keeps only valid images up to the cap', () => {
    const good = 'data:image/png;base64,aaa'
    const bad = 'not-an-image'
    const many = Array.from({ length: 8 }, (_, i) => `data:image/png;base64,${i}`)
    expect(normalizeAdminImageDataUrls([good, bad, null, 1])).toEqual([good])
    expect(normalizeAdminImageDataUrls(many)).toHaveLength(
      MAX_ADMIN_IMAGE_ATTACHMENTS
    )
  })
})
