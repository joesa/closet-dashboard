import { describe, expect, it } from 'vitest'
import {
  ACCENT_POOL,
  GROUND_POOL,
  TYPE_PAIR_POOL,
  directionKeys,
  pickDeterministicDirection,
} from './deterministicDirectionSeed'
import { scanDesignTells } from '@/lib/validation/designTellScanner'
import { paletteFingerprintKey } from '@/lib/design/customDesignFingerprint'

const BRANDS = [
  'Ridgeline Closets',
  'Harbor Auto Detail',
  'Cypress Plumbing',
  'Fulton Roofing',
  'Del Rio Landscaping',
  'Northgate Electrical',
  'Bayside Cabinetry',
  'Ironwood Fencing',
  'Meridian Glass',
  'Coastal Gutter Works',
]

describe('pickDeterministicDirection', () => {
  it('is stable for the same business', () => {
    const input = { brandName: 'Ridgeline Closets', city: 'Nashville', services: ['closets'] }
    expect(pickDeterministicDirection(input)).toEqual(pickDeterministicDirection(input))
  })

  it('gives different businesses different directions', () => {
    const keys = BRANDS.map((brandName) =>
      directionKeys(pickDeterministicDirection({ brandName, city: 'Nashville' }))
    )
    const paletteKeys = new Set(keys.map((k) => k.paletteKey))
    // The old fallback returned one palette for every business on the platform.
    expect(paletteKeys.size).toBe(BRANDS.length)
    // Fonts draw from a 14-pair pool, so ~7 distinct from 10 draws is the
    // expected birthday-collision result, not a distribution bug. Runtime
    // collisions are handled by probing against takenFontKeys, not by the hash.
    expect(new Set(keys.map((k) => k.fontKey)).size).toBeGreaterThanOrEqual(7)
  })

  it('always names real Google Fonts rather than describing them', () => {
    for (const brandName of BRANDS) {
      const d = pickDeterministicDirection({ brandName })
      expect(d.typography.display).toMatch(/^[A-Z]/)
      expect(d.typography.display).not.toMatch(/choose|real|font that fits/i)
      expect(TYPE_PAIR_POOL.some((p) => p.display === d.typography.display)).toBe(true)
    }
  })

  it('emits a full five-role palette of valid hexes', () => {
    const d = pickDeterministicDirection({ brandName: 'Ridgeline Closets' })
    expect(d.palette.map((p) => p.role)).toEqual(['bg', 'ink', 'muted', 'line', 'acc'])
    for (const role of d.palette) expect(role.hex).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('probes past a taken palette', () => {
    const first = pickDeterministicDirection({ brandName: 'Ridgeline Closets' })
    const taken = directionKeys(first)
    const second = pickDeterministicDirection({
      brandName: 'Ridgeline Closets',
      takenPaletteKeys: [taken.paletteKey],
    })
    expect(directionKeys(second).paletteKey).not.toBe(taken.paletteKey)
    expect(second.seedIndex).toBeGreaterThan(first.seedIndex)
    expect(second.composition).not.toBe(first.composition)
    expect(second.signatureElement).not.toBe(first.signatureElement)
  })

  it('uses the same palette key format as artifact fingerprints', () => {
    const direction = pickDeterministicDirection({ brandName: 'Ridgeline Closets' })
    expect(directionKeys(direction).paletteKey).toBe(
      paletteFingerprintKey(direction.palette)
    )
  })

  it('probes past a taken type pairing', () => {
    const first = pickDeterministicDirection({ brandName: 'Fulton Roofing' })
    const second = pickDeterministicDirection({
      brandName: 'Fulton Roofing',
      takenFontKeys: [directionKeys(first).fontKey],
    })
    expect(directionKeys(second).fontKey).not.toBe(directionKeys(first).fontKey)
    expect(second.composition).not.toBe(first.composition)
    expect(second.signatureElement).not.toBe(first.signatureElement)
  })

  it('still returns a usable direction when everything is taken', () => {
    const allPalettes = GROUND_POOL.flatMap((ground) =>
      ACCENT_POOL.map((accent) =>
        paletteFingerprintKey([
          { role: 'bg', hex: ground.bg },
          { role: 'ink', hex: ground.ink },
          { role: 'muted', hex: ground.muted },
          { role: 'line', hex: ground.line },
          { role: 'acc', hex: accent.hex },
        ])
      )
    )
    const allFonts = TYPE_PAIR_POOL.map((p) => `${p.display}+${p.body}`.toLowerCase())
    const d = pickDeterministicDirection({
      brandName: 'Ridgeline Closets',
      takenPaletteKeys: allPalettes,
      takenFontKeys: allFonts,
    })
    expect(d.palette).toHaveLength(5)
    expect(d.typography.display).toBeTruthy()
  })

  it('has enough curated type capacity to probe past the original fleet pool', () => {
    const originalPool = TYPE_PAIR_POOL.slice(0, 14)
      .map((pair) => `${pair.display}+${pair.body}`.toLowerCase())
    const direction = pickDeterministicDirection({
      brandName: 'Concurrency Fixture',
      takenFontKeys: originalPool,
    })
    expect(originalPool).not.toContain(directionKeys(direction).fontKey)
  })
})

describe('the pools cannot produce what the design system bans', () => {
  it('no ground/accent pair trips a banned skin, and no pairing trips a banned font', () => {
    for (const ground of GROUND_POOL) {
      for (const accent of ACCENT_POOL) {
        for (const pair of TYPE_PAIR_POOL) {
          const css = `:root{--bg:${ground.bg};--ink:${ground.ink};--muted:${ground.muted};--line:${ground.line};--acc:${accent.hex};--df:"${pair.display}";--bf:"${pair.body}"}
h1{font-family:var(--df)}body{font-family:var(--bf)}`
          const codes = scanDesignTells({ globalCss: css, pages: {} }).map((f) => f.code)
          expect(codes, `${ground.id}/${accent.id}/${pair.display}`).not.toContain(
            'design_dark_neon_skin'
          )
          expect(codes, `${ground.id}/${accent.id}/${pair.display}`).not.toContain(
            'design_cream_terracotta_skin'
          )
          expect(codes, `${ground.id}/${accent.id}/${pair.display}`).not.toContain(
            'design_banned_font_family'
          )
        }
      }
    }
  })
})
