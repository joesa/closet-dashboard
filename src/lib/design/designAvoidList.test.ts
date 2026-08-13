import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CustomSiteConfig } from '@/lib/customSite'
import {
  buildAvoidPromptBlock,
  describeTakenSkeletons,
  findDesignCollisions,
  findFamilyConvergence,
  findFleetConvergence,
  loadDesignAvoidList,
  recordCustomDesignFingerprint,
  type TakenDesign,
} from './designAvoidList'
import {
  CUSTOM_FINGERPRINT_VERSION,
  extractCustomDesignFingerprint,
} from './customDesignFingerprint'
import { AVOID_LIST_MAX_CHARS } from '@/lib/validation/designGuardPolicy'

const CSS = `:root{--bg:#eef2f1;--ink:#1a1f1e;--muted:#5a6562;--line:#c5d0cc;--acc:#2f5d50;--df:"Fraunces";--bf:"Karla"}`

function artifact(sections: string[]): CustomSiteConfig {
  return { mode: 'inline', globalCss: CSS, pages: { '/': { html: sections.join('') } } }
}

const HERO = '<section><h1>Closets in Green Hills</h1><a href="/q">Quote</a></section>'
const GRID = '<section><h3>A</h3><h3>B</h3><h3>C</h3></section>'
const BAND = '<section><a href="/q">Book</a></section>'
const PROSE = '<section><p>Words about the work.</p></section>'

function taken(tenantId: string, sections: string[], concept?: string): TakenDesign {
  return {
    tenantId,
    fingerprint: extractCustomDesignFingerprint(artifact(sections)),
    signatureConcept: concept ?? null,
    industryKey: null,
    marketKey: null,
    updatedAt: null,
  }
}

/** Minimal PostgREST query-builder stub: every method chains, then resolves. */
function stubSupabase(result: { data?: unknown; error?: { message: string } | null }) {
  const builder: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'order', 'limit', 'upsert']) {
    builder[method] = vi.fn(() => builder)
  }
  builder.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: result.data ?? null, error: result.error ?? null }).then(resolve)
  const from = vi.fn(() => builder)
  return { client: { from } as unknown as SupabaseClient, from, builder }
}

describe('loadDesignAvoidList', () => {
  it('includes the tenant own redesign history', async () => {
    const fp = extractCustomDesignFingerprint(artifact([HERO, GRID, BAND]))
    const otherFp = extractCustomDesignFingerprint(artifact([HERO, PROSE, BAND]))
    const { client } = stubSupabase({
      data: [
        { tenant_id: 'me', fingerprint: fp, signature_concept: 'mine', status: 'published' },
        { tenant_id: 'other', fingerprint: otherFp, signature_concept: 'theirs', status: 'published' },
      ],
    })
    const avoid = await loadDesignAvoidList({ supabase: client, tenantId: 'me' })
    expect(avoid.taken.map((t) => t.tenantId)).toEqual(['me', 'other'])
  })

  it('can exclude the exact candidate already recorded as a draft', async () => {
    const fp = extractCustomDesignFingerprint(artifact([HERO, GRID, BAND]))
    const { client } = stubSupabase({
      data: [
        { tenant_id: 'me', fingerprint: fp, signature_concept: 'current', status: 'draft' },
        { tenant_id: 'other', fingerprint: fp, signature_concept: 'duplicate', status: 'draft' },
      ],
    })
    const avoid = await loadDesignAvoidList({
      supabase: client,
      tenantId: 'me',
      excludeFingerprintHash: fp.hash,
    })
    expect(avoid.taken.map((row) => row.tenantId)).toEqual(['other'])
  })

  it('counts an identical draft and published artifact as one prior design', async () => {
    const fp = extractCustomDesignFingerprint(artifact([HERO, GRID, BAND]))
    const { client } = stubSupabase({
      data: [
        { tenant_id: 'other', fingerprint: fp, signature_concept: 'published', status: 'published' },
        { tenant_id: 'other', fingerprint: fp, signature_concept: 'draft', status: 'draft' },
      ],
    })
    const avoid = await loadDesignAvoidList({ supabase: client, tenantId: 'me' })
    expect(avoid.taken).toHaveLength(1)
    expect(avoid.taken[0].signatureConcept).toBe('published')
  })

  it('returns an empty list when the query errors, instead of throwing', async () => {
    const { client } = stubSupabase({
      error: { message: 'relation "custom_design_fingerprints" does not exist' },
    })
    await expect(
      loadDesignAvoidList({ supabase: client, tenantId: 'me' })
    ).resolves.toMatchObject({ taken: [], promptBlock: '' })
  })

  it('returns an empty list when the client throws outright', async () => {
    const client = {
      from: () => {
        throw new Error('network down')
      },
    } as unknown as SupabaseClient
    await expect(
      loadDesignAvoidList({ supabase: client, tenantId: 'me' })
    ).resolves.toMatchObject({ taken: [] })
  })

  it('skips rows whose fingerprint payload is unreadable', async () => {
    const { client } = stubSupabase({
      data: [
        { tenant_id: 'a', fingerprint: null, signature_concept: null, status: 'draft' },
        { tenant_id: 'b', fingerprint: { nonsense: true }, signature_concept: null, status: 'draft' },
      ],
    })
    const avoid = await loadDesignAvoidList({ supabase: client, tenantId: 'me' })
    expect(avoid.taken).toEqual([])
  })

  it('only asks for rows written by the current extractor version', async () => {
    const { client, builder } = stubSupabase({ data: [] })
    await loadDesignAvoidList({ supabase: client, tenantId: 'me' })
    expect(builder.eq).toHaveBeenCalledWith('version', CUSTOM_FINGERPRINT_VERSION)
  })

  it('classifies font usage by the target industry and market', async () => {
    const fp = extractCustomDesignFingerprint(artifact([HERO, GRID, BAND]))
    const { client } = stubSupabase({
      data: [{
        tenant_id: 'other',
        fingerprint: fp,
        signature_concept: null,
        status: 'published',
        industry_key: 'plumbing',
        market_key: 'nashville|tn',
        updated_at: '2026-08-08T00:00:00.000Z',
      }],
    })
    const avoid = await loadDesignAvoidList({
      supabase: client,
      tenantId: 'me',
      industryKey: 'plumbing',
      marketKey: 'nashville|tn',
    })
    expect(avoid.fontUsage).toEqual([expect.objectContaining({
      fontKey: 'fraunces+karla',
      sameIndustry: true,
      sameMarket: true,
    })])
  })
})

describe('buildAvoidPromptBlock', () => {
  it('is empty when nothing has shipped yet', () => {
    expect(buildAvoidPromptBlock([])).toBe('')
  })

  it('lists rhythms, palettes, type and concepts, and states the hard rule', () => {
    const block = buildAvoidPromptBlock([
      taken('a', [HERO, GRID, BAND], 'shop-ticket ledger'),
      taken('b', [HERO, PROSE, BAND], 'survey elevation margin'),
    ])
    expect(block).toContain('ALREADY USED ON THIS PLATFORM')
    expect(block).toContain('hero→grid3→band')
    expect(block).toContain('fraunces + karla')
    expect(block).toContain('"shop-ticket ledger"')
    expect(block).toMatch(/complete visual system MUST differ/)
    expect(block).toContain('Recoloring or reordering the same template is not sufficient.')
  })

  it('stays inside the character budget with many taken designs', () => {
    const many = Array.from({ length: 60 }, (_i, n) =>
      taken(`t${n}`, [HERO, ...Array(n % 8).fill(PROSE), BAND], `concept number ${n}`)
    )
    expect(buildAvoidPromptBlock(many).length).toBeLessThanOrEqual(AVOID_LIST_MAX_CHARS)
  })
})

describe('findDesignCollisions', () => {
  const candidate = extractCustomDesignFingerprint(artifact([HERO, GRID, BAND]))

  it('finds a tenant with the same rhythm', () => {
    const hits = findDesignCollisions(candidate, [taken('other', [HERO, GRID, BAND], 'theirs')])
    expect(hits).toHaveLength(1)
    expect(hits[0]).toMatchObject({ tenantId: 'other', score: 1, signatureConcept: 'theirs' })
  })

  it('ignores a genuinely different rhythm', () => {
    const visuallyDifferent = {
      ...taken('other', [HERO, PROSE]),
      fingerprint: extractCustomDesignFingerprint({
        mode: 'inline',
        globalCss: ':root{--bg:#090909;--ink:#fff;--acc:#e21;--df:"Bitter";--bf:"Public Sans"}',
        pages: { '/': { html: [HERO, PROSE].join('') } },
      }),
    }
    expect(findDesignCollisions(candidate, [visuallyDifferent])).toEqual([])
  })

  it('sorts the closest match first', () => {
    const hits = findDesignCollisions(
      candidate,
      [taken('near', [HERO, GRID, PROSE, BAND]), taken('exact', [HERO, GRID, BAND])],
      0.4
    )
    expect(hits.map((h) => h.tenantId)).toEqual(['exact', 'near'])
  })
})

describe('recordCustomDesignFingerprint', () => {
  it('upserts one row per tenant, status, and artifact hash', async () => {
    const { client, builder } = stubSupabase({ data: null })
    const fp = await recordCustomDesignFingerprint({
      supabase: client,
      tenantId: 'me',
      status: 'published',
      config: artifact([HERO, GRID, BAND]),
      signatureConcept: 'shop-ticket ledger',
    })
    expect(fp.skeleton).toEqual(['hero', 'grid3', 'band'])
    expect(builder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'me',
        status: 'published',
        skeleton_key: 'hero>grid3>band',
        font_key: 'fraunces+karla',
        artifact_hash: fp.hash,
        signature_concept: 'shop-ticket ledger',
      }),
      { onConflict: 'tenant_id,status,artifact_hash' }
    )
  })

  it('still returns the fingerprint when the write fails', async () => {
    const { client } = stubSupabase({ error: { message: 'permission denied' } })
    await expect(
      recordCustomDesignFingerprint({
        supabase: client,
        tenantId: 'me',
        status: 'draft',
        config: artifact([HERO, BAND]),
      })
    ).resolves.toMatchObject({ skeleton: ['hero', 'band'] })
  })
})

describe('describeTakenSkeletons', () => {
  it('deduplicates and caps the summary', () => {
    const avoid = {
      taken: [taken('a', [HERO, GRID]), taken('b', [HERO, GRID]), taken('c', [HERO, BAND])],
      takenSkeletonKeys: [],
      takenPaletteKeys: [],
      takenFontKeys: [],
      fontUsage: [],
      promptBlock: '',
    }
    expect(describeTakenSkeletons(avoid)).toBe('hero→grid3 · hero→band')
  })
})

describe('fail-closed loading (Full redesign)', () => {
  it('throws on a query error instead of returning an empty list', async () => {
    const { client } = stubSupabase({ error: { message: 'connection refused' } })
    await expect(
      loadDesignAvoidList({ supabase: client, tenantId: 'me', failClosed: true })
    ).rejects.toThrow(/fail closed/i)
  })

  it('throws when the client throws outright', async () => {
    const client = {
      from: () => {
        throw new Error('network down')
      },
    } as unknown as SupabaseClient
    await expect(
      loadDesignAvoidList({ supabase: client, tenantId: 'me', failClosed: true })
    ).rejects.toThrow('network down')
  })
})

const DARK_CSS = `:root{--bg:#232a2e;--ink:#eef1f2;--muted:#9aa5aa;--line:#39434a;--acc:#7d2f3a;--df:"Oswald";--bf:"Lato"}
section{border-radius:20px}`

describe('findFleetConvergence', () => {
  const fleet = Array.from({ length: 12 }, (_v, n) => taken(`t${n}`, [HERO, GRID, BAND]))
  const sameAsFleet = extractCustomDesignFingerprint(artifact([HERO, GRID, BAND]))

  it('is silent below the minimum fleet sample', () => {
    expect(findFleetConvergence(sameAsFleet, fleet.slice(0, 5))).toEqual([])
  })

  it('flags a candidate that reuses values most of the fleet already uses', () => {
    const findings = findFleetConvergence(sameAsFleet, fleet)
    expect(findings.length).toBeGreaterThanOrEqual(3)
    for (const f of findings) {
      expect(f.share).toBeGreaterThanOrEqual(0.8)
      expect(f.sample).toBe(12)
    }
  })

  it('mostly clears a candidate from a genuinely different visual system', () => {
    const different = extractCustomDesignFingerprint({
      mode: 'inline',
      globalCss: DARK_CSS,
      pages: { '/': { html: [HERO, PROSE, PROSE, GRID, BAND, BAND].join('') } },
    })
    const sameFindings = findFleetConvergence(sameAsFleet, fleet)
    const differentFindings = findFleetConvergence(different, fleet)
    expect(differentFindings.length).toBeLessThan(sameFindings.length)
    // The axes that define the fleet's shared skin must all clear.
    expect(differentFindings.some((f) => f.axis === 'shape')).toBe(false)
    expect(differentFindings.some((f) => f.axis === 'fonts')).toBe(false)
    expect(differentFindings.some((f) => f.axis === 'palette')).toBe(false)
  })
})

describe('findFamilyConvergence', () => {
  const fleet = Array.from({ length: 12 }, (_v, n) => taken(`t${n}`, [HERO, GRID, BAND]))

  it('flags a candidate in the family that dominates the recent window', () => {
    const candidate = extractCustomDesignFingerprint(artifact([HERO, PROSE, GRID, BAND]))
    const hit = findFamilyConvergence(candidate, fleet)
    expect(hit).not.toBeNull()
    expect(hit?.axis).toBe('family')
    expect(hit?.share).toBeGreaterThanOrEqual(0.5)
  })

  it('clears a candidate from a different family (tone + geometry change)', () => {
    const candidate = extractCustomDesignFingerprint({
      mode: 'inline',
      globalCss: DARK_CSS,
      pages: { '/': { html: [HERO, PROSE, BAND].join('') } },
    })
    expect(findFamilyConvergence(candidate, fleet)).toBeNull()
  })

  it('is silent below the minimum sample', () => {
    const candidate = extractCustomDesignFingerprint(artifact([HERO, GRID, BAND]))
    expect(findFamilyConvergence(candidate, fleet.slice(0, 4))).toBeNull()
  })
})

describe('saturated guidance in the prompt block', () => {
  it('names saturated motifs and families once the fleet is large enough', () => {
    const many = Array.from({ length: 15 }, (_v, n) => taken(`t${n}`, [HERO, GRID, BAND]))
    const block = buildAvoidPromptBlock(many)
    expect(block).toContain('SATURATED')
  })

  it('omits saturation lines for a small fleet', () => {
    const block = buildAvoidPromptBlock([taken('a', [HERO, GRID, BAND])])
    expect(block).not.toContain('SATURATED')
  })
})
