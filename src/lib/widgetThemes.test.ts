import { describe, expect, it } from 'vitest'
import {
  inferSiteAppearanceMode,
  pickWidgetThemeForSite,
  WIDGET_THEMES,
} from './widgetThemes'

describe('widgetThemes catalog', () => {
  it('has 50 unique theme ids', () => {
    expect(WIDGET_THEMES).toHaveLength(50)
    const ids = new Set(WIDGET_THEMES.map((t) => t.id))
    expect(ids.size).toBe(50)
  })
})

describe('inferSiteAppearanceMode', () => {
  it('detects dark custom CSS', () => {
    expect(
      inferSiteAppearanceMode(
        '<body class="dark">',
        ':root{--bg:#0a0a0a;background:#121212;color:#fff}'
      )
    ).toBe('dark')
  })

  it('detects light from cream --bg even when dark section tokens exist', () => {
    expect(
      inferSiteAppearanceMode(
        '<section class="hero dark">',
        ':root{--bg:#f4f1ea;--dark:#131518;--acc:#c05a1e}'
      )
    ).toBe('light')
  })

  it('detects dark from near-black --bg', () => {
    expect(
      inferSiteAppearanceMode('<main>', ':root{--bg:#0e1014;--ink:#f5f5f5}')
    ).toBe('dark')
  })
})

describe('pickWidgetThemeForSite', () => {
  it('prefers dark AV themes for home theater', () => {
    const picked = pickWidgetThemeForSite({
      mode: 'dark',
      industryHint: 'Kidefa Home Theater Pros cinema AV',
    })
    expect(picked.mode).toBe('dark')
    expect([
      'velvet-cinema',
      'charcoal-stage',
      'noir-brass',
      'midnight-ink',
      'obsidian',
    ]).toContain(picked.id)
  })

  it('prefers light clinic themes for dental', () => {
    const picked = pickWidgetThemeForSite({
      mode: 'light',
      industryHint: 'Bright Smile Dental clinic',
    })
    expect(picked.mode).toBe('light')
    expect([
      'mint-clinic',
      'arctic-frost',
      'gallery-white',
      'cloud-linen',
      'porcelain',
    ]).toContain(picked.id)
  })

  it('prefers warm auto/car-wash themes over lavender for light sites', () => {
    const picked = pickWidgetThemeForSite({
      mode: 'light',
      brandColor: '#c05a1e',
      industryHint: 'Wehora Car Wash mobile detailing',
    })
    expect(picked.mode).toBe('light')
    expect(picked.id).not.toBe('lavender-mist')
    expect([
      'terracotta',
      'slate-studio',
      'cement',
      'sandstone',
      'rosewood',
    ]).toContain(picked.id)
  })
})
