import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'

const mocks = vi.hoisted(() => ({
  admin: null as unknown as SupabaseClient,
  syncTenantLaunchAccess: vi.fn(async () => ({ siteStatus: 'active', launchPayUrl: null })),
  retrieve: vi.fn(async () => ({ status: 'open' })),
  expire: vi.fn(async () => ({})),
  stripeThrows: false,
}))

vi.mock('@/lib/supabase-admin', () => ({ getSupabaseAdmin: () => mocks.admin }))
vi.mock('@/lib/intake/syncTenantLaunchAccess', () => ({
  syncTenantLaunchAccess: mocks.syncTenantLaunchAccess,
}))
vi.mock('@/lib/stripe', () => ({
  getStripe: () => {
    if (mocks.stripeThrows) throw new Error('STRIPE_SECRET_KEY missing')
    return { checkout: { sessions: { retrieve: mocks.retrieve, expire: mocks.expire } } }
  },
}))

import { markIntakePaidInFull } from './markPaidInFull'

type Row = Record<string, unknown>

/** Minimal PostgREST query-builder stub, keyed by table name. */
function stubSupabase(tables: Record<string, { data?: Row | Row[] | null }>) {
  const updates: Record<string, Row[]> = {}
  const inserts: Record<string, Row[]> = {}
  const from = vi.fn((table: string) => {
    const result = tables[table] ?? { data: null }
    const builder: Record<string, unknown> = {}
    for (const method of ['select', 'eq', 'update', 'insert']) {
      builder[method] = vi.fn((...args: unknown[]) => {
        if (method === 'update') (updates[table] ||= []).push(args[0] as Row)
        if (method === 'insert') (inserts[table] ||= []).push(args[0] as Row)
        return builder
      })
    }
    builder.maybeSingle = vi.fn(() => Promise.resolve({ data: result.data ?? null, error: null }))
    builder.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: result.data ?? null, error: null }).then(resolve)
    return builder
  })
  return { client: { from } as unknown as SupabaseClient, updates, inserts }
}

function intake(overrides: Partial<ProspectIntakeRow> = {}): ProspectIntakeRow {
  return {
    id: 'i1',
    token: 'tok',
    status: 'submitted',
    intake_tier: 'standard',
    tier_total_cents: 129900,
    deposit_required_cents: 0,
    deposit_paid_cents: 0,
    deposit_status: 'not_required',
    build_paid_at: null,
    balance_paid_at: null,
    preview_approved_at: null,
    site_live_at: null,
    maintenance_plan: null,
    maintenance_started_at: null,
    provisioned_contractor_id: 'tenant-1',
    ...overrides,
  } as unknown as ProspectIntakeRow
}

beforeEach(() => {
  mocks.syncTenantLaunchAccess.mockClear()
  mocks.retrieve.mockClear()
  mocks.expire.mockClear()
  mocks.retrieve.mockResolvedValue({ status: 'open' })
  mocks.stripeThrows = false
})

describe('markIntakePaidInFull', () => {
  it('settles a standard build and takes the site live', async () => {
    const { client, updates, inserts } = stubSupabase({ prospect_intakes: { data: {} } })
    mocks.admin = client

    const result = await markIntakePaidInFull({ intakeId: 'i1', row: intake() })

    expect(result.launchKind).toBe('standard_build')
    expect(result.alreadyPaid).toBe(false)
    expect(updates.prospect_intakes[0]).toMatchObject({
      build_paid_at: expect.any(String),
      preview_approved_at: expect.any(String),
    })
    expect(updates.prospect_intakes[0]).not.toHaveProperty('balance_paid_at')
    expect(inserts.intake_payments[0]).toMatchObject({
      intake_id: 'i1',
      kind: 'standard_build',
      status: 'paid',
      amount_cents: 0,
      stripe_session_id: 'comp:i1:standard_build',
    })
    expect(mocks.syncTenantLaunchAccess).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      intakeId: 'i1',
    })
  })

  it('settles the balance (not build) for an ai_premium tier and waives an outstanding deposit', async () => {
    const { client, updates, inserts } = stubSupabase({ prospect_intakes: { data: {} } })
    mocks.admin = client

    const result = await markIntakePaidInFull({
      intakeId: 'i1',
      row: intake({
        intake_tier: 'ai_premium',
        deposit_required_cents: 50000,
        deposit_status: 'pending',
      }),
    })

    expect(result.launchKind).toBe('balance')
    expect(result.depositWaived).toBe(true)
    expect(updates.prospect_intakes[0]).toMatchObject({
      balance_paid_at: expect.any(String),
      deposit_status: 'waived',
    })
    expect(updates.prospect_intakes[0]).not.toHaveProperty('build_paid_at')
    expect(inserts.intake_payments.map((row) => row.kind)).toEqual(['balance', 'deposit'])
  })

  it('clears the temp-preview window so the revert job cannot re-gate a comped site', async () => {
    const { client, updates } = stubSupabase({ prospect_intakes: { data: {} } })
    mocks.admin = client

    await markIntakePaidInFull({ intakeId: 'i1', row: intake() })

    expect(updates.tenants[0]).toMatchObject({ temp_preview_expires_at: null })
  })

  it('expires an open Stripe session so a comped customer can never be charged', async () => {
    const { client } = stubSupabase({
      prospect_intakes: { data: {} },
      intake_payments: { data: [{ stripe_session_id: 'cs_pending' }] },
    })
    mocks.admin = client

    const result = await markIntakePaidInFull({
      intakeId: 'i1',
      row: { ...intake(), stripe_checkout_session_id: 'cs_live_1' },
    })

    expect(mocks.expire).toHaveBeenCalledWith('cs_live_1')
    expect(result.expiredSessionIds).toContain('cs_live_1')
    expect(result.stripeWarnings).toEqual([])
  })

  it('leaves an already-completed Stripe session alone', async () => {
    mocks.retrieve.mockResolvedValue({ status: 'complete' })
    const { client } = stubSupabase({ prospect_intakes: { data: {} } })
    mocks.admin = client

    const result = await markIntakePaidInFull({
      intakeId: 'i1',
      row: { ...intake(), stripe_checkout_session_id: 'cs_done' },
    })

    expect(mocks.expire).not.toHaveBeenCalled()
    expect(result.expiredSessionIds).toEqual([])
  })

  it('still comps the build when Stripe is unreachable', async () => {
    mocks.stripeThrows = true
    const { client, updates } = stubSupabase({ prospect_intakes: { data: {} } })
    mocks.admin = client

    const result = await markIntakePaidInFull({
      intakeId: 'i1',
      row: { ...intake(), stripe_checkout_session_id: 'cs_live_1' },
    })

    expect(updates.prospect_intakes[0]).toHaveProperty('build_paid_at')
    expect(result.stripeWarnings[0]).toMatch(/Stripe not configured/)
    expect(mocks.syncTenantLaunchAccess).toHaveBeenCalled()
  })

  it('is idempotent: re-running does not double-write the ledger', async () => {
    const { client, inserts } = stubSupabase({
      prospect_intakes: { data: {} },
      intake_payments: { data: { id: 'existing' } },
    })
    mocks.admin = client

    const result = await markIntakePaidInFull({
      intakeId: 'i1',
      row: intake({ build_paid_at: '2026-01-01T00:00:00.000Z' }),
    })

    expect(result.alreadyPaid).toBe(true)
    expect(inserts.intake_payments).toBeUndefined()
  })
})
