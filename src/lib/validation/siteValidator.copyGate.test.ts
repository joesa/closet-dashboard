import { describe, expect, it } from 'vitest'
import { copyGateEnforcedFor } from '@/lib/validation/siteValidator'

/**
 * Phase 4 of plan-eliminateAiTells: copy findings escalate from 'warning' to
 * 'error' only for tenants provisioned after the enforcement cutoff, so legacy
 * sites are never broken retroactively.
 */
describe('copyGateEnforcedFor', () => {
  it('enforces for tenants created after the cutoff', () => {
    expect(copyGateEnforcedFor('2026-09-01T00:00:00Z')).toBe(true)
  })

  it('does not enforce for tenants created before the cutoff', () => {
    expect(copyGateEnforcedFor('2026-01-01T00:00:00Z')).toBe(false)
  })

  it('does not enforce when created_at is missing or unparseable', () => {
    expect(copyGateEnforcedFor(null)).toBe(false)
    expect(copyGateEnforcedFor(undefined)).toBe(false)
    expect(copyGateEnforcedFor('not-a-date')).toBe(false)
  })
})
