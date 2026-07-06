import { describe, it, expect } from 'vitest'
import { designFingerprint, siteSeed } from '@/lib/catalog/designFingerprint'

// MUST match the canonical literals pinned in the renderer test
// (custom-closets-websites/src/lib/designFingerprint.test.ts). If these two
// tests ever disagree, the mirror has drifted from the renderer and the
// collision-avoidance guarantee is unsound.
const CASES: Array<[string, string, string]> = [
  ['luxury-minimal', 'Summit Closets', '2.0.4.2.3.h0.b1.a1'],
  ['modern-office', 'acme|office|closets', '4.1.2.1.2.h1.b1.a0'],
  ['sophisticated-wine', 'Vintage Cellars|napa', '5.0.2.2.2.h2.b1.a0'],
  ['creative-craft', 'Maker Studio', '11.0.3.2.1.h0.b0.a1'],
  ['brutalist', 'Bold Co#2', '7.0.4.0.3.h1.b0.a2'],
]

describe('designFingerprint mirror (closet-dashboard)', () => {
  it.each(CASES)('%s / %s matches renderer', (theme, seed, expected) => {
    expect(designFingerprint(theme, seed)).toBe(expected)
  })

  it('siteSeed precedence: designVariant > widgetId > brandName', () => {
    expect(siteSeed({ designVariant: 'a', widgetId: 'b', brandName: 'c' })).toBe('a')
    expect(siteSeed({ widgetId: 'b', brandName: 'c' })).toBe('b')
    expect(siteSeed({ brandName: 'c' })).toBe('c')
    expect(siteSeed({})).toBe('')
  })
})
