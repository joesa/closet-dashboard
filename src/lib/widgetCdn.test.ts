import { describe, expect, it } from 'vitest'
import { DEFAULT_WIDGET_CDN_BASE, normalizeWidgetCdnUrl } from './widgetCdn'

describe('normalizeWidgetCdnUrl', () => {
  it('leaves local paths alone', () => {
    expect(normalizeWidgetCdnUrl('/widget.js')).toBe('/widget.js')
  })

  it('uses the release loader by default', () => {
    expect(DEFAULT_WIDGET_CDN_BASE).toBe('https://closet-widget.vercel.app/loader.js')
  })

  it('does not add mutable version state to an absolute URL', () => {
    expect(normalizeWidgetCdnUrl('https://cdn.example/loader.js')).toBe(
      'https://cdn.example/loader.js'
    )
  })
})
