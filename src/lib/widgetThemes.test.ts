import { describe, expect, it } from 'vitest'
import {
  inferSiteAppearanceMode,
  pickWidgetThemeForSite,
  WIDGET_THEMES,
} from './widgetThemes'

function luminance(hex: string): number {
  const channels = [1, 3, 5]
    .map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrast(a: string, b: string): number {
  const lighter = Math.max(luminance(a), luminance(b))
  const darker = Math.min(luminance(a), luminance(b))
  return (lighter + 0.05) / (darker + 0.05)
}

describe('widgetThemes catalog', () => {
  it('has 50 unique theme ids', () => {
    expect(WIDGET_THEMES).toHaveLength(50)
    const ids = new Set(WIDGET_THEMES.map((t) => t.id))
    expect(ids.size).toBe(50)
  })

  it('keeps all persisted widget text tokens at WCAG AA contrast', () => {
    const failures: string[] = []
    for (const theme of WIDGET_THEMES) {
      for (const text of [theme.textPrimary, theme.textSecondary, theme.textMuted]) {
        for (const surface of [theme.surfaceBase, theme.surfaceElevated, theme.surfaceMuted]) {
          const ratio = contrast(text, surface)
          if (ratio < 4.5) failures.push(`${theme.id}: ${text} on ${surface} (${ratio.toFixed(2)})`)
        }
      }
      const brandRatio = contrast(theme.brandText, theme.brand)
      if (brandRatio < 4.5) failures.push(`${theme.id}: brand text (${brandRatio.toFixed(2)})`)
    }
    expect(failures).toEqual([])
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
