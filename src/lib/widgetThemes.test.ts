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

  it('detects light custom CSS', () => {
    expect(
      inferSiteAppearanceMode('<main>', 'body{background:#ffffff;color:#222}')
    ).toBe('light')
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
})
