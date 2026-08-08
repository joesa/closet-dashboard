import { describe, expect, it } from 'vitest'
import {
  analyzeDirectCopyTells,
  copyGateEnforcedFor,
} from '@/lib/validation/siteValidator'

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

describe('analyzeDirectCopyTells', () => {
  it('finds placeholders, short em dashes, and formulaic titles in visible HTML', () => {
    const findings = analyzeDirectCopyTells(`
      <style>.hidden::after { content: 'Jane Doe'; }</style>
      <h2>The Acme Method</h2>
      <button>Book today — get started</button>
      <p>Email jane@example.com</p>
    `)

    expect(findings.map((finding) => finding.code)).toEqual([
      'copy_placeholder',
      'copy_em_dash_short',
      'copy_formulaic_title',
    ])
    expect(findings.flatMap((finding) => finding.samples)).toEqual(
      expect.arrayContaining(['jane@example.com', 'Book today — get started', 'The Acme Method'])
    )
  })

  it('does not flag hidden source or a long prose em dash', () => {
    const prose = 'The crew arrived before eight and finished the framing by lunch — which mattered because the inspector and drywall delivery were already booked for the afternoon.'
    expect(analyzeDirectCopyTells(`<script>const name = 'Jane Doe'</script><p>${prose}</p>`)).toEqual([])
  })

  it('flags fake contact data and luxury boilerplate found in rendered sites', () => {
    const findings = analyzeDirectCopyTells(
      '<footer>Bespoke, unrivaled work. 123-456-7890 · MyCity, MS</footer>'
    )
    expect(findings.map((finding) => finding.code)).toEqual(['copy_placeholder'])
    expect(findings.flatMap((finding) => finding.samples)).toEqual(
      expect.arrayContaining(['123-456-7890', 'MyCity, MS'])
    )
  })
})
