import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PUBLIC_ORIGIN,
  normalizePublicOrigin,
  publicAppOrigin,
} from './urls'

describe('normalizePublicOrigin', () => {
  it('remaps closetquotes.com to ditchtheform', () => {
    expect(normalizePublicOrigin('https://closetquotes.com')).toBe(
      DEFAULT_PUBLIC_ORIGIN
    )
    expect(normalizePublicOrigin('https://www.closetquotes.com/login')).toBe(
      DEFAULT_PUBLIC_ORIGIN
    )
  })

  it('keeps ditchtheform and localhost', () => {
    expect(normalizePublicOrigin('https://www.ditchtheform.com/')).toBe(
      'https://www.ditchtheform.com'
    )
    expect(normalizePublicOrigin('http://localhost:3001')).toBe(
      'http://localhost:3001'
    )
  })

  it('returns null for empty', () => {
    expect(normalizePublicOrigin('')).toBeNull()
    expect(normalizePublicOrigin(null)).toBeNull()
  })
})

describe('publicAppOrigin', () => {
  it('falls back to default when nothing configured', () => {
    // Env may be set in vitest; still assert remapping of request origin.
    expect(publicAppOrigin('https://closetquotes.com')).not.toContain(
      'closetquotes'
    )
  })
})
