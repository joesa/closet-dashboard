import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { enqueueProvisionJob } from './enqueueProvisionJob'

vi.mock('@/lib/supabase-admin', () => ({ getSupabaseAdmin: vi.fn() }))

type Row = { id: string; status: string }

const inserts: Record<string, unknown>[] = []
const updates: { id: string; patch: Record<string, unknown> }[] = []

/** Minimal stand-in for the provision_jobs query builder. */
function fakeSupabase(existing: Row[]) {
  return {
    from: () => {
      const builder = {
        select: () => builder,
        eq: (_col: string, value: unknown) => {
          builder.matchedId = String(value)
          return builder
        },
        order: () => builder,
        limit: async () => ({ data: existing, error: null }),
        insert: async (row: Record<string, unknown>) => {
          inserts.push(row)
          return { error: null }
        },
        update: (patch: Record<string, unknown>) => ({
          eq: async (_col: string, id: string) => {
            updates.push({ id, patch })
            return { error: null }
          },
        }),
        matchedId: '',
      }
      return builder
    },
  }
}

beforeEach(() => {
  inserts.length = 0
  updates.length = 0
  vi.clearAllMocks()
})

describe('enqueueProvisionJob', () => {
  it('inserts a pending job when the intake has none', async () => {
    vi.mocked(getSupabaseAdmin).mockReturnValue(
      fakeSupabase([]) as unknown as ReturnType<typeof getSupabaseAdmin>
    )

    const result = await enqueueProvisionJob('intake-1', 'full')

    expect(result).toMatchObject({ queued: true, duplicate: false })
    expect(inserts).toHaveLength(1)
    expect(inserts[0]).toMatchObject({ intake_id: 'intake-1', status: 'pending', mode: 'full' })
  })

  it('leaves an in-flight deploy alone', async () => {
    vi.mocked(getSupabaseAdmin).mockReturnValue(
      fakeSupabase([{ id: 'job-1', status: 'processing' }]) as unknown as ReturnType<
        typeof getSupabaseAdmin
      >
    )

    const result = await enqueueProvisionJob('intake-1', 'full')

    expect(result).toMatchObject({ queued: true, duplicate: true, status: 'processing' })
    expect(inserts).toHaveLength(0)
    expect(updates).toHaveLength(0)
  })

  it('revives a failed job so a resubmit deploys again without an admin', async () => {
    vi.mocked(getSupabaseAdmin).mockReturnValue(
      fakeSupabase([{ id: 'job-1', status: 'failed' }]) as unknown as ReturnType<
        typeof getSupabaseAdmin
      >
    )

    const result = await enqueueProvisionJob('intake-1', 'ai_full')

    expect(result).toMatchObject({ status: 'pending', requeued: true })
    expect(updates).toHaveLength(1)
    expect(updates[0].id).toBe('job-1')
    expect(updates[0].patch).toMatchObject({
      status: 'pending',
      mode: 'ai_full',
      attempts: 0,
      last_error: null,
    })
  })

  it('revives a needs_review job too', async () => {
    vi.mocked(getSupabaseAdmin).mockReturnValue(
      fakeSupabase([{ id: 'job-2', status: 'needs_review' }]) as unknown as ReturnType<
        typeof getSupabaseAdmin
      >
    )

    const result = await enqueueProvisionJob('intake-1', 'full')

    expect(result.requeued).toBe(true)
    expect(updates[0].id).toBe('job-2')
  })

  it('does not redeploy an intake whose site already provisioned', async () => {
    vi.mocked(getSupabaseAdmin).mockReturnValue(
      fakeSupabase([{ id: 'job-3', status: 'succeeded' }]) as unknown as ReturnType<
        typeof getSupabaseAdmin
      >
    )

    const result = await enqueueProvisionJob('intake-1', 'full')

    expect(result).toMatchObject({ duplicate: true, status: 'succeeded' })
    expect(updates).toHaveLength(0)
    expect(inserts).toHaveLength(0)
  })
})
