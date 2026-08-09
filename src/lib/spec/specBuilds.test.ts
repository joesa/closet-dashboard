import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SPEC_BUILD_IN_FLIGHT_STATUSES } from './types'
import type { SpecBuildRow } from './types'
import {
  deleteSpecBuild,
  specBuildDeletionBlockReason,
  specBuildMaxInFlight,
} from './specBuilds'

const mocks = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }))
vi.mock('@/lib/supabase-admin', () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }))

const build = (overrides: Partial<SpecBuildRow> = {}): SpecBuildRow =>
  ({
    id: 'build-1',
    status: 'needs_attention',
    lead_source: 'manual',
    scraper_lead_id: null,
    scraper_run_id: null,
    lead_input: { businessName: 'Acme', phone: '+19315550100' },
    business_name: 'Acme',
    phone_e164: '+19315550100',
    city: 'Clarksville',
    intake_id: 'intake-1',
    tenant_id: null,
    placeholder_owner_email: null,
    research: {},
    research_at: null,
    offer_token: null,
    offer_total_cents: null,
    offer_discount_bps: 5000,
    offer_deadline_at: null,
    offer_sent_at: null,
    offer_reminded_at: null,
    responded_at: null,
    purge_after: null,
    attempts: 1,
    last_error: null,
    status_reason: null,
    approved_by: null,
    approved_at: null,
    created_at: '2026-08-09T00:00:00.000Z',
    updated_at: '2026-08-09T00:00:00.000Z',
    ...overrides,
  }) as SpecBuildRow

beforeEach(() => mocks.getSupabaseAdmin.mockReset())

describe('specBuildDeletionBlockReason', () => {
  it.each(SPEC_BUILD_IN_FLIGHT_STATUSES)('blocks active status %s', (status) => {
    expect(specBuildDeletionBlockReason({ status, tenant_id: null })).toBe('in_flight')
  })

  it('blocks builds that already own a tenant', () => {
    expect(
      specBuildDeletionBlockReason({ status: 'ready_for_review', tenant_id: 'tenant-1' })
    ).toBe('tenant_exists')
  })

  it.each(['queued', 'needs_attention', 'rejected'] as const)(
    'allows non-provisioned status %s',
    (status) => {
      expect(specBuildDeletionBlockReason({ status, tenant_id: null })).toBeNull()
    }
  )
})

describe('deleteSpecBuild', () => {
  it('deletes only a spec intake before deleting the queue row', async () => {
    const calls: string[] = []
    const intakeEq = vi.fn((column: string, value: string) => {
      calls.push(`intake:${column}=${value}`)
      return column === 'id'
        ? { eq: intakeEq }
        : { select: async () => ({ data: [{ id: 'intake-1' }], error: null }) }
    })
    const from = vi.fn((table: string) => {
      calls.push(`from:${table}`)
      if (table === 'prospect_intakes') {
        return { delete: () => ({ eq: intakeEq }) }
      }
      if (calls.filter((entry) => entry === 'from:spec_builds').length === 1) {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: build(), error: null }) }),
          }),
        }
      }
      return {
        delete: () => ({
          eq: () => ({ select: async () => ({ data: [{ id: 'build-1' }], error: null }) }),
        }),
      }
    })
    mocks.getSupabaseAdmin.mockReturnValue({ from })

    await expect(deleteSpecBuild('build-1')).resolves.toEqual({
      deleted: true,
      intakeDeleted: true,
    })
    expect(calls).toContain('intake:source=spec')
    expect(calls.indexOf('from:prospect_intakes')).toBeLessThan(
      calls.lastIndexOf('from:spec_builds')
    )
  })

  it('does not issue delete queries for a provisioned build', async () => {
    const from = vi.fn(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: build({ tenant_id: 'tenant-1' }), error: null }),
        }),
      }),
    }))
    mocks.getSupabaseAdmin.mockReturnValue({ from })

    await expect(deleteSpecBuild('build-1')).resolves.toEqual({
      deleted: false,
      reason: 'tenant_exists',
    })
    expect(from).toHaveBeenCalledTimes(1)
  })
})
describe('specBuildMaxInFlight', () => {
  afterEach(() => {
    delete process.env.SPEC_BUILD_MAX_IN_FLIGHT
  })

  it('defaults to a conservative 2', () => {
    expect(specBuildMaxInFlight()).toBe(2)
  })

  it('honours the env override', () => {
    process.env.SPEC_BUILD_MAX_IN_FLIGHT = '5'
    expect(specBuildMaxInFlight()).toBe(5)
  })

  it('refuses values that would remove the limit', () => {
    // A cap of 0 or a typo must not read as "unlimited" — that is the failure
    // mode where a backlog drains all at once and spends the month's budget.
    for (const bad of ['0', '-3', 'lots', '']) {
      process.env.SPEC_BUILD_MAX_IN_FLIGHT = bad
      expect.soft(specBuildMaxInFlight(), bad).toBe(2)
    }
  })
})
