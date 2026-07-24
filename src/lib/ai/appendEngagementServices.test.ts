import { describe, expect, it, vi } from 'vitest'
import { appendEngagementServices } from './appendEngagementServices'

function mockSupabase(opts: {
  table: string
  existing: Record<string, unknown>[]
  insertError?: { message: string } | null
}) {
  const insert = vi.fn(async () => ({ error: opts.insertError || null }))
  const eq = vi.fn(() =>
    Promise.resolve({ data: opts.existing, error: null })
  )
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn((name: string) => {
    if (name === opts.table) {
      return { select, insert }
    }
    return {
      select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }),
      insert,
    }
  })
  return { from, insert, select, eq }
}

describe('appendEngagementServices', () => {
  it('appends missing quote rooms and skips existing names', async () => {
    const sb = mockSupabase({
      table: 'contractor_rooms',
      existing: [
        {
          name: 'Exterior Detail',
          price_basic: 40,
          price_standard: 60,
          price_premium: 90,
        },
      ],
    })
    const result = await appendEngagementServices({
      supabase: sb as never,
      tenantId: 't1',
      contractorId: 'c1',
      engagementModel: 'quote',
      services: [
        { title: 'Exterior Detail' },
        { title: 'Ceramic Coating' },
      ],
    })
    expect(result.skipped).toEqual(['Exterior Detail'])
    expect(result.appended).toEqual(['Ceramic Coating'])
    expect(sb.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        contractor_id: 'c1',
        name: 'Ceramic Coating',
        price_basic: 40,
        price_standard: 60,
        price_premium: 90,
      }),
    ])
  })

  it('returns empty when no services', async () => {
    const sb = mockSupabase({ table: 'contractor_rooms', existing: [] })
    const result = await appendEngagementServices({
      supabase: sb as never,
      tenantId: 't1',
      contractorId: 'c1',
      services: [],
    })
    expect(result).toEqual({ appended: [], skipped: [], warnings: [] })
    expect(sb.from).not.toHaveBeenCalled()
  })
})
