import { describe, expect, it } from 'vitest'
import { resolveLaunchAccess } from './syncTenantLaunchAccess'
import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'

function baseRow(overrides: Partial<ProspectIntakeRow> = {}): ProspectIntakeRow {
  return {
    id: 'int-1',
    token: 'tok',
    intake_tier: 'ai_premium',
    build_paid_at: null,
    balance_paid_at: null,
    preview_approved_at: null,
    ...overrides,
  } as ProspectIntakeRow
}

describe('resolveLaunchAccess', () => {
  it('keeps site pending before preview approval', () => {
    const r = resolveLaunchAccess(baseRow())
    expect(r.siteStatus).toBe('pending_approval')
    expect(r.launchPayUrl).toBeNull()
  })

  it('locks site with pay URL after preview, before balance', () => {
    const r = resolveLaunchAccess(
      baseRow({ preview_approved_at: '2026-01-01T00:00:00Z' })
    )
    expect(r.siteStatus).toBe('awaiting_launch_payment')
    expect(r.launchPayUrl).toContain('/intake/tok?pay=balance')
  })

  it('activates after AI premium balance paid', () => {
    const r = resolveLaunchAccess(
      baseRow({
        preview_approved_at: '2026-01-01T00:00:00Z',
        balance_paid_at: '2026-01-02T00:00:00Z',
      })
    )
    expect(r.siteStatus).toBe('active')
    expect(r.launchPayUrl).toBeNull()
  })

  it('uses standard_build pay link for standard tier', () => {
    const r = resolveLaunchAccess(
      baseRow({
        intake_tier: 'standard',
        preview_approved_at: '2026-01-01T00:00:00Z',
      })
    )
    expect(r.launchPayUrl).toContain('pay=standard_build')
  })
})
