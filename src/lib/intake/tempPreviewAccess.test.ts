import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

const mocks = vi.hoisted(() => ({
  admin: null as unknown as SupabaseClient,
  canEnqueue: vi.fn(() => true),
  enqueueJob: vi.fn(async () => ({ id: 'job-1' })),
  revalidate: vi.fn(async () => true),
}))

vi.mock('@/lib/supabase-admin', () => ({ getSupabaseAdmin: () => mocks.admin }))
vi.mock('@/lib/jobs/enqueueJob', () => ({
  canEnqueueBackgroundJobs: mocks.canEnqueue,
  enqueueJob: mocks.enqueueJob,
}))
vi.mock('@/lib/tenants/revalidateTenantSite', () => ({
  revalidateTenantSiteCache: mocks.revalidate,
}))

import {
  grantTempPreview,
  isTempPreviewActive,
  revertTempPreviewIfDue,
  revertTempPreviewNow,
} from './tempPreviewAccess'

type Row = Record<string, unknown>

/** Minimal PostgREST query-builder stub, keyed by table name. */
function stubSupabase(tables: Record<string, { data?: Row | Row[] | null; error?: { message: string } | null }>) {
  const updates: Record<string, Row[]> = {}
  const from = vi.fn((table: string) => {
    const result = tables[table] ?? { data: null }
    const builder: Record<string, unknown> = {}
    for (const method of ['select', 'eq', 'update']) {
      builder[method] = vi.fn((...args: unknown[]) => {
        if (method === 'update') {
          updates[table] = updates[table] || []
          updates[table].push(args[0] as Row)
        }
        return builder
      })
    }
    builder.maybeSingle = vi.fn(() =>
      Promise.resolve({ data: result.data ?? null, error: result.error ?? null })
    )
    builder.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: result.data ?? null, error: result.error ?? null }).then(resolve)
    return builder
  })
  return { client: { from } as unknown as SupabaseClient, updates }
}

beforeEach(() => {
  mocks.canEnqueue.mockReturnValue(true)
  mocks.enqueueJob.mockClear()
  mocks.revalidate.mockClear()
})

describe('grantTempPreview', () => {
  it('sets the expiring override and schedules the auto-revert job', async () => {
    const { client, updates } = stubSupabase({ tenants: { data: {} } })
    mocks.admin = client

    const { expiresAt } = await grantTempPreview({ tenantId: 't1', intakeId: 'i1', hours: 4 })

    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now())
    expect(updates.tenants[0]).toMatchObject({ temp_preview_expires_at: expiresAt })
    expect(updates.tenants[0]).not.toHaveProperty('site_status')
    expect(updates.site_configs).toBeUndefined()
    expect(mocks.enqueueJob).toHaveBeenCalledWith(
      'temp_preview_revert',
      { tenantId: 't1' },
      expect.objectContaining({ jobKey: 'temp_preview_revert:t1', jobKeyMode: 'replace' })
    )
    expect(mocks.revalidate).toHaveBeenCalledWith('t1')
  })

  it('rejects a non-positive duration', async () => {
    mocks.admin = stubSupabase({}).client
    await expect(grantTempPreview({ tenantId: 't1', intakeId: 'i1', hours: 0 })).rejects.toThrow(
      'hours must be a positive number'
    )
    expect(mocks.enqueueJob).not.toHaveBeenCalled()
  })

  it('fails closed when the auto-revert job cannot be scheduled, without writing anything', async () => {
    mocks.canEnqueue.mockReturnValue(false)
    const { client, updates } = stubSupabase({ tenants: { data: {} }, site_configs: { data: {} } })
    mocks.admin = client

    await expect(grantTempPreview({ tenantId: 't1', intakeId: 'i1', hours: 4 })).rejects.toThrow(
      /cannot schedule the auto-revert job/
    )
    expect(updates.tenants).toBeUndefined()
  })

  it('does not grant access when scheduling the revert fails', async () => {
    mocks.enqueueJob.mockRejectedValueOnce(new Error('queue unavailable'))
    const { client, updates } = stubSupabase({ tenants: { data: {} } })
    mocks.admin = client

    await expect(grantTempPreview({ tenantId: 't1', intakeId: 'i1', hours: 4 })).rejects.toThrow(
      'queue unavailable'
    )
    expect(updates.tenants).toBeUndefined()
  })
})

describe('revertTempPreviewNow', () => {
  it('is a no-op when no temp preview is in effect', async () => {
    const { client, updates } = stubSupabase({ tenants: { data: { temp_preview_expires_at: null, site_status: 'active' } } })
    mocks.admin = client

    const result = await revertTempPreviewNow({ tenantId: 't1' })
    expect(result).toMatchObject({ reverted: false, siteStatus: 'active' })
    expect(updates.tenants).toBeUndefined()
  })

  it('reverts to the real payment-gated status when unpaid', async () => {
    const { client, updates } = stubSupabase({
      tenants: { data: { temp_preview_expires_at: '2026-01-01T00:00:00Z', site_status: 'active' } },
      prospect_intakes: {
        data: {
          id: 'i1',
          token: 'tok',
          intake_tier: 'ai_premium',
          build_paid_at: null,
          balance_paid_at: null,
          preview_approved_at: '2026-01-01T00:00:00Z',
          provisioned_contractor_id: 't1',
        },
      },
      site_configs: { data: {} },
    })
    mocks.admin = client

    const result = await revertTempPreviewNow({ tenantId: 't1', intakeId: 'i1' })
    expect(result.reverted).toBe(true)
    expect(result.siteStatus).toBe('awaiting_launch_payment')
    expect(updates.tenants[0]).toMatchObject({
      site_status: 'awaiting_launch_payment',
      temp_preview_expires_at: null,
    })
  })

  it('leaves the site active when the balance was actually paid in the meantime', async () => {
    const { client, updates } = stubSupabase({
      tenants: { data: { temp_preview_expires_at: '2026-01-01T00:00:00Z', site_status: 'active' } },
      prospect_intakes: {
        data: {
          id: 'i1',
          token: 'tok',
          intake_tier: 'ai_premium',
          build_paid_at: null,
          balance_paid_at: '2026-01-02T00:00:00Z',
          preview_approved_at: '2026-01-01T00:00:00Z',
          provisioned_contractor_id: 't1',
        },
      },
      site_configs: { data: {} },
    })
    mocks.admin = client

    const result = await revertTempPreviewNow({ tenantId: 't1', intakeId: 'i1' })
    expect(result.siteStatus).toBe('active')
    expect(updates.tenants[0]).toMatchObject({ site_status: 'active', temp_preview_expires_at: null })
    expect(mocks.revalidate).toHaveBeenCalledWith('t1')
  })

  it('fails safe (gated) when the intake row cannot be resolved', async () => {
    const { client, updates } = stubSupabase({
      tenants: { data: { temp_preview_expires_at: '2026-01-01T00:00:00Z', site_status: 'active' } },
      prospect_intakes: { data: null },
    })
    mocks.admin = client

    const result = await revertTempPreviewNow({ tenantId: 't1', intakeId: 'i1' })
    expect(result.siteStatus).toBe('awaiting_launch_payment')
    expect(updates.tenants[0]).toMatchObject({ site_status: 'awaiting_launch_payment' })
  })
})

describe('revertTempPreviewIfDue', () => {
  it('declines to act while the window has not elapsed yet', async () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    const { client, updates } = stubSupabase({ tenants: { data: { temp_preview_expires_at: future } } })
    mocks.admin = client

    const result = await revertTempPreviewIfDue('t1')
    expect(result.reverted).toBe(false)
    expect(updates.tenants).toBeUndefined()
  })

  it('reverts once the window has elapsed', async () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    const { client } = stubSupabase({
      tenants: { data: { temp_preview_expires_at: past, site_status: 'active' } },
      prospect_intakes: {
        data: {
          id: 'i1',
          token: 'tok',
          intake_tier: 'standard',
          build_paid_at: null,
          balance_paid_at: null,
          preview_approved_at: '2026-01-01T00:00:00Z',
          provisioned_contractor_id: 't1',
        },
      },
      site_configs: { data: {} },
    })
    mocks.admin = client

    const result = await revertTempPreviewIfDue('t1')
    expect(result.reverted).toBe(true)
  })

  it('is a no-op when the window was already cleared (manually disabled)', async () => {
    const { client } = stubSupabase({ tenants: { data: { temp_preview_expires_at: null } } })
    mocks.admin = client

    const result = await revertTempPreviewIfDue('t1')
    expect(result.reverted).toBe(false)
  })
})

describe('isTempPreviewActive', () => {
  it('is false without a granted window', () => {
    expect(isTempPreviewActive(null)).toBe(false)
    expect(isTempPreviewActive(undefined)).toBe(false)
    expect(isTempPreviewActive('')).toBe(false)
  })

  it('is true before the deadline and false after it', () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    const past = new Date(Date.now() - 60_000).toISOString()
    expect(isTempPreviewActive(future)).toBe(true)
    expect(isTempPreviewActive(past)).toBe(false)
  })
})
