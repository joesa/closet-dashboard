import { describe, expect, it } from 'vitest'
import { DEFAULT_WIDGET_VERSION, withWidgetCacheBust } from './widgetCdn'

describe('withWidgetCacheBust', () => {
  it('leaves local paths alone', () => {
    expect(withWidgetCacheBust('/widget.js')).toBe('/widget.js')
  })

  it('appends ?v= when missing', () => {
    expect(withWidgetCacheBust('https://closet-widget.vercel.app/widget.js')).toBe(
      `https://closet-widget.vercel.app/widget.js?v=${DEFAULT_WIDGET_VERSION}`
    )
  })

  it('preserves an existing v param', () => {
    expect(
      withWidgetCacheBust('https://closet-widget.vercel.app/widget.js?v=9.9.9')
    ).toBe('https://closet-widget.vercel.app/widget.js?v=9.9.9')
  })

  it('accepts an explicit version override', () => {
    expect(
      withWidgetCacheBust('https://closet-widget.vercel.app/widget.js', '1.2.3')
    ).toBe('https://closet-widget.vercel.app/widget.js?v=1.2.3')
  })
})
