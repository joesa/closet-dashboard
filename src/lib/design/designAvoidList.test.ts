import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CustomSiteConfig } from '@/lib/customSite'
import {
  buildAvoidPromptBlock,
  describeTakenSkeletons,
  findSkeletonCollisions,
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
  it('excludes the tenant from its own avoid list', async () => {
    const fp = extractCustomDesignFingerprint(artifact([HERO, GRID, BAND]))
    const { client } = stubSupabase({
      data: [
        { tenant_id: 'me', fingerprint: fp, signature_concept: 'mine', status: 'published' },
        { tenant_id: 'other', fingerprint: fp, signature_concept: 'theirs', status: 'published' },
      ],
    })
    const avoid = await loadDesignAvoidList({ supabase: client, tenantId: 'me' })
    expect(avoid.taken.map((t) => t.tenantId)).toEqual(['other'])
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
    expect(block).toMatch(/MUST NOT match any rhythm above/)
  })

  it('stays inside the character budget with many taken designs', () => {
    const many = Array.from({ length: 60 }, (_i, n) =>
      taken(`t${n}`, [HERO, ...Array(n % 8).fill(PROSE), BAND], `concept number ${n}`)
    )
    expect(buildAvoidPromptBlock(many).length).toBeLessThanOrEqual(AVOID_LIST_MAX_CHARS)
  })
})

describe('findSkeletonCollisions', () => {
  const candidate = extractCustomDesignFingerprint(artifact([HERO, GRID, BAND]))

  it('finds a tenant with the same rhythm', () => {
    const hits = findSkeletonCollisions(candidate, [taken('other', [HERO, GRID, BAND], 'theirs')])
    expect(hits).toHaveLength(1)
    expect(hits[0]).toMatchObject({ tenantId: 'other', score: 1, signatureConcept: 'theirs' })
  })

  it('ignores a genuinely different rhythm', () => {
    expect(findSkeletonCollisions(candidate, [taken('other', [HERO, PROSE])])).toEqual([])
  })

  it('sorts the closest match first', () => {
    const hits = findSkeletonCollisions(
      candidate,
      [taken('near', [HERO, GRID, PROSE, BAND]), taken('exact', [HERO, GRID, BAND])],
      0.5
    )
    expect(hits.map((h) => h.tenantId)).toEqual(['exact', 'near'])
  })
})

describe('recordCustomDesignFingerprint', () => {
  it('upserts one row per tenant with the derived keys', async () => {
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
        signature_concept: 'shop-ticket ledger',
      }),
      { onConflict: 'tenant_id' }
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
      promptBlock: '',
    }
    expect(describeTakenSkeletons(avoid)).toBe('hero→grid3 · hero→band')
  })
})
