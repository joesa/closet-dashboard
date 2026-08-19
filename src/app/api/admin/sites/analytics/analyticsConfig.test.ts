import { describe, expect, it } from 'vitest'
import { buildAnalyticsConfig } from './route'

/**
 * These values end up in a page on the customer's own domain, so the
 * validation is a security boundary rather than input tidying.
 */
describe('buildAnalyticsConfig', () => {
  it('accepts a GA4 id on its own', () => {
    expect(buildAnalyticsConfig('G-ABC1234567', '')).toEqual({
      ok: true,
      config: { ga4: 'G-ABC1234567' },
    })
  })

  it('accepts a plausible domain on its own', () => {
    expect(buildAnalyticsConfig('', 'example.com')).toEqual({
      ok: true,
      config: { plausible: 'example.com' },
    })
  })

  it('accepts both', () => {
    const result = buildAnalyticsConfig('G-ABC1234567', 'example.com')
    expect(result).toEqual({ ok: true, config: { ga4: 'G-ABC1234567', plausible: 'example.com' } })
  })

  it('treats both empty as turning analytics off, not as an error', () => {
    expect(buildAnalyticsConfig('', '')).toEqual({ ok: true, config: {} })
  })

  it('trims whitespace', () => {
    expect(buildAnalyticsConfig('  G-ABC1234567 ', ' example.com ')).toMatchObject({
      ok: true,
      config: { ga4: 'G-ABC1234567', plausible: 'example.com' },
    })
  })

  it.each([
    '<script>alert(1)</script>',
    "G-ABC');alert(1);//",
    'UA-12345-6',
    'https://evil.example/x.js',
  ])('rejects %s as a ga4 id', (value) => {
    expect(buildAnalyticsConfig(value, '')).toEqual({ ok: false, reason: 'ga4' })
  })

  it.each(['<script>x</script>', 'example.com/"><script>', 'has space.com'])(
    'rejects %s as a plausible domain',
    (value) => {
      expect(buildAnalyticsConfig('', value)).toEqual({ ok: false, reason: 'plausible' })
    }
  )

  it('rejects the whole submission when one field is bad, rather than saving half', () => {
    expect(buildAnalyticsConfig('G-ABC1234567', '<script>')).toEqual({
      ok: false,
      reason: 'plausible',
    })
  })

  it('handles nulls', () => {
    expect(buildAnalyticsConfig(null, null)).toEqual({ ok: true, config: {} })
  })
})
