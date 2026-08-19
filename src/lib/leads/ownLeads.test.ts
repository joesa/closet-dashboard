import { describe, expect, it } from 'vitest'
import { leadName, type LeadRow } from '@/lib/leads/ownLeads'

/**
 * The lead inbox is the first screen to show one contractor's customer data,
 * scoped by a row-level policy that had never been exercised — it was written
 * for a screen nobody built. The isolation itself is enforced by Postgres and
 * verified against the live database (see the RLS check in the deploy notes);
 * these cover the presentation decisions that would otherwise misattribute a
 * lead in the list.
 */
function lead(overrides: Partial<LeadRow> = {}): LeadRow {
  return {
    id: 'l1',
    first_name: null,
    last_name: null,
    email: null,
    phone: null,
    message: null,
    room_type: null,
    finish_type: null,
    linear_feet: null,
    estimated_total: null,
    range_low: null,
    range_high: null,
    add_ons: [],
    source_origin: null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('leadName', () => {
  it('prefers the name they gave', () => {
    expect(leadName(lead({ first_name: 'Dana', last_name: 'Reyes' }))).toBe('Dana Reyes')
  })

  it('handles a first name alone without a trailing space', () => {
    expect(leadName(lead({ first_name: 'Dana' }))).toBe('Dana')
  })

  it('falls back to the email local-part rather than showing a blank row', () => {
    expect(leadName(lead({ email: 'dana@example.com' }))).toBe('dana')
  })

  it('never renders an empty label', () => {
    expect(leadName(lead())).toBe('Unnamed lead')
    expect(leadName(lead({ first_name: '  ' }))).toBe('Unnamed lead')
  })
})
