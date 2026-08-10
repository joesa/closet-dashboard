import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SpecBuildRow } from '@/lib/spec/types'

const mocks = vi.hoisted(() => ({
  extractFactsFromPage: vi.fn(),
  fetchPageText: vi.fn(),
  firecrawlConfigured: vi.fn(() => false),
  update: vi.fn(),
  idEq: vi.fn(),
  statusEq: vi.fn(),
  select: vi.fn(),
}))

vi.mock('@/lib/spec/research/extractFacts', () => ({
  extractFactsFromPage: mocks.extractFactsFromPage,
}))

vi.mock('@/lib/spec/research/fetchPage', () => ({
  fetchPageText: mocks.fetchPageText,
  firecrawlConfigured: mocks.firecrawlConfigured,
}))

vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: () => ({
    from: () => ({ update: mocks.update }),
  }),
}))

import { runSpecResearch, saveSpecResearch } from '@/lib/spec/research/runSpecResearch'

const SOURCE_URL = 'https://www.facebook.com/peerless/'
const EVIDENCE = 'We use soft washing for siding affected by algae and mildew.'
const CAPTURED_TEXT = `${EVIDENCE}\nProfessional exterior cleaning for homes, driveways, sidewalks, fences, and patios throughout Clarksville.`

const build = {
  id: 'build-1',
  business_name: 'Peerless Pressure & SoftWash',
  city: 'Clarksville',
  lead_input: {
    businessName: 'Peerless Pressure & SoftWash',
    phone: '+19315550199',
    services: ['Pressure washing'],
    socialProfileUrl: SOURCE_URL,
    publicProfileResearch: {
      sourceUrl: SOURCE_URL,
      text: CAPTURED_TEXT,
      capturedAt: '2026-08-09T00:00:00.000Z',
      captureMethod: 'public_browser',
    },
  },
} as SpecBuildRow

beforeEach(() => {
  vi.clearAllMocks()
  mocks.firecrawlConfigured.mockReturnValue(false)
  mocks.select.mockResolvedValue({ data: [{ id: 'build-1' }], error: null })
  mocks.statusEq.mockReturnValue({ select: mocks.select })
  mocks.idEq.mockReturnValue({ eq: mocks.statusEq })
  mocks.update.mockReturnValue({ eq: mocks.idEq })
  mocks.fetchPageText.mockImplementation(async (url: string, sourceKind: string) => ({
    url,
    sourceKind,
    text: `${EVIDENCE} ${'Yelp customers describe the crew as prompt, careful, and thorough. '.repeat(8)}`,
  }))
  mocks.extractFactsFromPage.mockImplementation(async (page: { url: string; sourceKind: string }) => ({
    candidates: [{
      field: 'shop_rule',
      value: EVIDENCE,
      evidence: EVIDENCE,
      sourceUrl: page.url,
      sourceKind: page.sourceKind,
      capturedAt: '2026-08-09T00:00:00.000Z',
    }],
  }))
})

describe('scraper-captured public profile research lifecycle', () => {
  it('verifies captured evidence without a second network fetch', async () => {
    const outcome = await runSpecResearch(build)

    expect(mocks.fetchPageText).not.toHaveBeenCalled()
    expect(outcome.blockedReason).toBeUndefined()
    expect(outcome.facts).toHaveLength(1)
    expect(outcome.facts[0]).toMatchObject({
      field: 'shop_rule',
      evidence: EVIDENCE,
      sourceUrl: SOURCE_URL,
    })
  })

  it('erases the complete temporary body when research is persisted', async () => {
    const outcome = await runSpecResearch(build)
    await saveSpecResearch(build, outcome)

    const update = mocks.update.mock.calls[0][0] as Record<string, unknown>
    expect(JSON.stringify(update)).not.toContain(CAPTURED_TEXT)
    expect(update.lead_input).not.toHaveProperty('publicProfileResearch')
    expect(update.research).toMatchObject({ facts: outcome.facts })
  })

  it('does not persist stale research after another actor changes the build state', async () => {
    mocks.select.mockResolvedValue({ data: [], error: null })

    await expect(saveSpecResearch(build, { facts: [], fetched: [], rejected: [] })).resolves.toBe(false)
    expect(mocks.statusEq).toHaveBeenCalledWith('status', 'researching')
  })

  it('labels captured Yelp evidence correctly and fetches the Yelp review source once', async () => {
    const yelpUrl = 'https://www.yelp.com/biz/peerless-pressure-softwash-clarksville'
    const yelpBuild = {
      ...build,
      lead_input: {
        ...build.lead_input,
        socialProfileUrl: null,
        yelpUrl,
        publicProfileResearch: {
          ...build.lead_input.publicProfileResearch!,
          sourceUrl: yelpUrl,
        },
      },
    } as SpecBuildRow

    const outcome = await runSpecResearch(yelpBuild)

    expect(mocks.fetchPageText).toHaveBeenCalledTimes(1)
    expect(outcome.facts[0]).toMatchObject({
      sourceKind: 'yelp_business',
      sourceUrl: yelpUrl,
    })
  })

  it('rejects captured evidence whose identity no longer matches the configured source', async () => {
    const changedBuild = {
      ...build,
      lead_input: {
        ...build.lead_input,
        socialProfileUrl: 'https://www.facebook.com/a-different-business',
      },
    } as SpecBuildRow

    const outcome = await runSpecResearch(changedBuild)

    expect(mocks.extractFactsFromPage).not.toHaveBeenCalled()
    expect(outcome.blockedReason).toContain('FIRECRAWL_API_KEY')
  })
})

describe('manual fact research fallback', () => {
  it('preserves manual facts and does not block when every public source fails', async () => {
    const manualFact = {
      field: 'client_artifact',
      value: 'Every customer receives a written grooming report.',
      evidence: 'Every customer receives a written grooming report.',
      sourceUrl: 'admin://manual',
      sourceKind: 'admin_manual',
      capturedAt: '2026-08-09T00:00:00.000Z',
      verbatim: true,
      note: 'Owner told the admin during a call.',
      addedBy: 'admin@example.com',
    } as const
    const manualBuild = {
      ...build,
      lead_input: {
        ...build.lead_input,
        publicProfileResearch: null,
      },
      research: { facts: [manualFact] },
    } as SpecBuildRow
    mocks.firecrawlConfigured.mockReturnValue(true)
    mocks.fetchPageText.mockResolvedValue({
      url: SOURCE_URL,
      sourceKind: 'facebook_about',
      text: '',
      error: 'Facebook returned no indexed prose',
    })

    const outcome = await runSpecResearch(manualBuild)

    expect(outcome.blockedReason).toBeUndefined()
    expect(outcome.facts).toEqual([manualFact])
  })
})