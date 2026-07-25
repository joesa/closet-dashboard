import { describe, expect, it } from 'vitest'
import {
  MAX_ADMIN_IMAGE_ATTACHMENTS,
  isAdminImageHttpsUrl,
  normalizeAdminImageDataUrls,
  normalizeAdminImageRefs,
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

describe('isAdminImageHttpsUrl / normalizeAdminImageRefs', () => {
  it('accepts CDN and common image https URLs', () => {
    expect(
      isAdminImageHttpsUrl(
        'https://vtlvqatzsolycqzeknru.supabase.co/storage/v1/object/public/site-assets/custom/x/a.jpg'
      )
    ).toBe(true)
    expect(isAdminImageHttpsUrl('https://cdn.example.com/hero.webp')).toBe(true)
    expect(isAdminImageHttpsUrl('http://insecure.example.com/a.png')).toBe(false)
  })

  it('keeps https URLs and data URLs up to the cap', () => {
    const cdn =
      'https://vtlvqatzsolycqzeknru.supabase.co/storage/v1/object/public/site-assets/custom/t/a.jpg'
    const data = 'data:image/png;base64,aaa'
    expect(normalizeAdminImageRefs([cdn, data, 'nope', null])).toEqual([cdn, data])
    const many = Array.from({ length: 8 }, (_, i) => `data:image/png;base64,${i}`)
    expect(normalizeAdminImageRefs(many)).toHaveLength(MAX_ADMIN_IMAGE_ATTACHMENTS)
  })

  it('legacy normalizeAdminImageDataUrls still drops https', () => {
    const cdn =
      'https://vtlvqatzsolycqzeknru.supabase.co/storage/v1/object/public/site-assets/custom/t/a.jpg'
    expect(normalizeAdminImageDataUrls([cdn, 'data:image/png;base64,aaa'])).toEqual([
      'data:image/png;base64,aaa',
    ])
  })
})
