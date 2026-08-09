import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SpecBuildRow } from '@/lib/spec/types'

const mocks = vi.hoisted(() => ({
  extractFactsFromPage: vi.fn(),
  fetchPageText: vi.fn(),
  firecrawlConfigured: vi.fn(() => false),
  update: vi.fn(),
  eq: vi.fn(async () => ({ error: null })),
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
  mocks.update.mockReturnValue({ eq: mocks.eq })
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
})