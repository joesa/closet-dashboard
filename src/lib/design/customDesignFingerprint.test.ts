import { describe, expect, it } from 'vitest'
import type { CustomSiteConfig } from '@/lib/customSite'
import {
  CUSTOM_FINGERPRINT_VERSION,
  axisSimilarities,
  describeFingerprintForAvoidList,
  extractCustomDesignFingerprint,
  fingerprintKeys,
  isDesignCollision,
  isSkeletonCollision,
  skeletonSimilarity,
  visualSimilarity,
} from './customDesignFingerprint'

const CSS_A = `:root{--bg:#f7f4ef;--ink:#1a1f1e;--muted:#5a6562;--line:#c5d0cc;--acc:#2f5d50;--df:"Fraunces";--bf:"Karla"}
.card{border-radius:8px;border:1px solid var(--line);box-shadow:0 1px 2px #0001}
header{position:sticky;top:0}`

const CSS_B = `:root{--bg:#0b0d0f;--ink:#f2f2f2;--muted:#8a8a8a;--line:#232323;--acc:#35506b;--df:"Bitter";--bf:"Public Sans"}
.card{border-radius:0}`

const HERO = '<section><h1>Walk-in closets in Green Hills</h1><a href="/quote">Get a quote</a></section>'
const GRID = '<section><h3>A</h3><h3>B</h3><h3>C</h3></section>'
const SPLIT = '<section><img src="https://x/a.jpg"><p>Story</p></section>'
const GALLERY =
  '<section><img src="https://x/1.jpg"><img src="https://x/2.jpg"><img src="https://x/3.jpg"><img src="https://x/4.jpg"></section>'
const BAND = '<section><a href="/quote">Book this week</a></section>'
const PROSE = '<section><p>Some words about the work we do here.</p></section>'

function config(globalCss: string, homeSections: string[]): CustomSiteConfig {
  return {
    mode: 'inline',
    globalCss,
    pages: { '/': { html: homeSections.join('') } },
  }
}

describe('extractCustomDesignFingerprint', () => {
  it('is deterministic for the same artifact', () => {
    const c = config(CSS_A, [HERO, GRID, SPLIT, BAND])
    expect(extractCustomDesignFingerprint(c)).toEqual(extractCustomDesignFingerprint(c))
  })

  it('reads palette roles, fonts, skeleton, shape and motifs', () => {
    const fp = extractCustomDesignFingerprint(config(CSS_A, [HERO, GRID, SPLIT, BAND]))
    expect(fp.version).toBe(CUSTOM_FINGERPRINT_VERSION)
    expect(fp.paletteBuckets.map((b) => b.split(':')[0])).toEqual([
      'bg',
      'ink',
      'muted',
      'line',
      'acc',
    ])
    expect(fp.fonts.display).toBe('fraunces')
    expect(fp.fonts.body).toBe('karla')
    expect(fp.skeleton).toEqual(['hero', 'grid3', 'split', 'band'])
    expect(fp.shape).toBe('r2-b1-s1')
    expect(fp.motifs).toContain('sticky-header')
    expect(fp.motifs).toContain('hairline-grid')
  })

  it('caps the skeleton at twelve sections', () => {
    const fp = extractCustomDesignFingerprint(config(CSS_A, Array(20).fill(PROSE)))
    expect(fp.skeleton).toHaveLength(12)
  })

  it('falls back to frequent hexes when no roles are named', () => {
    const fp = extractCustomDesignFingerprint(
      config('.a{color:#2f5d50}.b{color:#2f5d50}.c{background:#f7f4ef}', [HERO])
    )
    expect(fp.paletteBuckets.length).toBeGreaterThan(0)
    expect(fp.paletteBuckets[0]).toMatch(/^c0:/)
  })

  it('classifies a widget mount as the engagement band', () => {
    const fp = extractCustomDesignFingerprint(
      config(CSS_A, [HERO, '<section><!-- CLOSET_WIDGET --></section>'])
    )
    expect(fp.skeleton).toEqual(['hero', 'engage'])
  })

  it('survives an artifact with no home page', () => {
    const fp = extractCustomDesignFingerprint({ mode: 'inline', globalCss: CSS_A, pages: {} })
    expect(fp.skeleton).toEqual([])
    expect(fp.hash).toBeTruthy()
  })
})

describe('skeletonSimilarity', () => {
  const base = extractCustomDesignFingerprint(config(CSS_A, [HERO, GRID, SPLIT, GALLERY, BAND]))

  it('scores an identical rhythm as 1 even with a different palette and type', () => {
    const recolored = extractCustomDesignFingerprint(
      config(CSS_B, [HERO, GRID, SPLIT, GALLERY, BAND])
    )
    expect(skeletonSimilarity(base, recolored)).toBe(1)
    expect(isSkeletonCollision(base, recolored)).toBe(true)
  })

  it('still collides when one section is inserted', () => {
    const inserted = extractCustomDesignFingerprint(
      config(CSS_A, [HERO, GRID, SPLIT, PROSE, GALLERY, BAND])
    )
    // 5 of 6 in common: reordering or padding is not an escape hatch.
    expect(skeletonSimilarity(base, inserted)).toBeCloseTo(5 / 6)
    expect(isSkeletonCollision(base, inserted, 0.8)).toBe(true)
  })

  it('does not collide with a genuinely different rhythm', () => {
    const other = extractCustomDesignFingerprint(config(CSS_A, [HERO, PROSE, BAND]))
    expect(skeletonSimilarity(base, other)).toBeLessThan(0.7)
    expect(isSkeletonCollision(base, other)).toBe(false)
  })

  it('scores zero across fingerprint versions', () => {
    const stale = { ...base, version: base.version + 1 }
    expect(skeletonSimilarity(base, stale)).toBe(0)
    expect(isSkeletonCollision(base, stale)).toBe(false)
  })

  it('scores zero when either skeleton could not be read', () => {
    const empty = extractCustomDesignFingerprint({ mode: 'inline', pages: {} })
    expect(skeletonSimilarity(base, empty)).toBe(0)
  })
})

describe('axisSimilarities', () => {
  it('separates palette and type from skeleton', () => {
    const a = extractCustomDesignFingerprint(config(CSS_A, [HERO, GRID, BAND]))
    const b = extractCustomDesignFingerprint(config(CSS_B, [HERO, GRID, BAND]))
    const scores = axisSimilarities(a, b)
    expect(scores.skeleton).toBe(1)
    expect(scores.fonts).toBe(0)
    expect(scores.palette).toBeLessThan(0.5)
  })

  it('reports full agreement for an identical artifact', () => {
    const fp = extractCustomDesignFingerprint(config(CSS_A, [HERO, GRID, BAND]))
    const scores = axisSimilarities(fp, fp)
    expect(scores).toEqual({ palette: 1, fonts: 1, skeleton: 1, shape: 1, motifs: 1 })
  })
})

describe('visual uniqueness', () => {
  it('rejects the same visual system even when sections are reordered', () => {
    const a = extractCustomDesignFingerprint(config(CSS_A, [HERO, GRID, SPLIT, BAND]))
    const b = extractCustomDesignFingerprint(config(CSS_A, [HERO, SPLIT, PROSE, GRID]))
    expect(skeletonSimilarity(a, b)).toBeLessThan(0.85)
    expect(visualSimilarity(a, b)).toBeGreaterThanOrEqual(0.6)
    expect(isDesignCollision(a, b)).toBe(true)
  })

  it('accepts a genuinely different visual system and composition', () => {
    const a = extractCustomDesignFingerprint(config(CSS_A, [HERO, GRID, SPLIT, BAND]))
    const b = extractCustomDesignFingerprint(config(CSS_B, [HERO, PROSE, BAND]))
    expect(visualSimilarity(a, b)).toBeLessThan(0.6)
    expect(isDesignCollision(a, b)).toBe(false)
  })
})

describe('keys and descriptions', () => {
  it('builds stable index keys', () => {
    const fp = extractCustomDesignFingerprint(config(CSS_A, [HERO, GRID, BAND]))
    const keys = fingerprintKeys(fp)
    expect(keys.skeletonKey).toBe('hero>grid3>band')
    expect(keys.fontKey).toBe('fraunces+karla')
    expect(keys.shapeKey).toBe(fp.shape)
  })

  it('describes a design in one readable line', () => {
    const fp = extractCustomDesignFingerprint(config(CSS_A, [HERO, GRID, BAND]))
    const line = describeFingerprintForAvoidList(fp)
    expect(line).toContain('hero→grid3→band')
    expect(line).toContain('fraunces + karla')
  })
})
