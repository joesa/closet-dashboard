import { describe, expect, it } from 'vitest'
import { digestSubject, renderDigest, summarizeWeek, type DigestLead } from './leadDigest'
import { isoWeekKey, weekLabel } from '@/app/api/cron/lead-digest/route'

function lead(over: Partial<DigestLead> = {}): DigestLead {
  return {
    first_name: null,
    last_name: null,
    email: null,
    estimated_total: null,
    created_at: '2026-08-17T10:00:00Z',
    ...over,
  }
}

describe('summarizeWeek', () => {
  it('is all zeros for an empty week rather than NaN', () => {
    expect(summarizeWeek([])).toEqual({ newLeads: 0, followUps: 0, quotedValue: 0, topLeads: [] })
  })

  it('does not count a follow-up as a new customer', () => {
    const summary = summarizeWeek([
      lead({ first_name: 'Ada', estimated_total: 5000 }),
      lead({ first_name: 'Ada', estimated_total: 6000, duplicate_of: 'l1' }),
    ])
    expect(summary.newLeads).toBe(1)
    expect(summary.followUps).toBe(1)
    // The repeat's value must not be added twice.
    expect(summary.quotedValue).toBe(5000)
  })

  it('ranks the top leads by value, highest first', () => {
    const summary = summarizeWeek([
      lead({ first_name: 'Small', estimated_total: 100 }),
      lead({ first_name: 'Big', estimated_total: 9000 }),
      lead({ first_name: 'Mid', estimated_total: 500 }),
    ])
    expect(summary.topLeads.map((l) => l.name)).toEqual(['Big', 'Mid', 'Small'])
  })

  it('caps the list at five', () => {
    const leads = Array.from({ length: 9 }, (_, i) =>
      lead({ first_name: `L${i}`, estimated_total: i * 100 })
    )
    expect(summarizeWeek(leads).topLeads).toHaveLength(5)
  })

  it('falls back to the email local-part, then to a placeholder', () => {
    const summary = summarizeWeek([lead({ email: 'jo@example.com' }), lead()])
    expect(summary.topLeads.map((l) => l.name)).toEqual(['jo', 'Someone'])
  })

  it('treats an unpriced enquiry as zero value but still a lead', () => {
    const summary = summarizeWeek([lead({ first_name: 'Nia', estimated_total: null })])
    expect(summary).toMatchObject({ newLeads: 1, quotedValue: 0 })
    expect(summary.topLeads[0]).toEqual({ name: 'Nia', value: null })
  })
})

describe('digestSubject', () => {
  it.each([
    [0, 'No new leads last week'],
    [1, '1 new lead last week'],
    [4, '4 new leads last week'],
  ])('reads naturally for %i leads', (n, expected) => {
    const leads = Array.from({ length: n }, () => lead({ estimated_total: 1 }))
    expect(digestSubject(summarizeWeek(leads))).toBe(expected)
  })
})

describe('renderDigest', () => {
  it('sends a real message for a quiet week instead of pretending', () => {
    const html = renderDigest({
      companyName: 'Acme Closets',
      summary: summarizeWeek([]),
      weekLabel: '12–18 August',
    })
    expect(html).toContain('No new leads last week')
    expect(html).toContain('Acme Closets')
  })

  it('escapes a company name containing HTML', () => {
    const html = renderDigest({
      companyName: '<script>alert(1)</script>',
      summary: summarizeWeek([lead({ first_name: 'Ada', estimated_total: 100 })]),
      weekLabel: '12–18 August',
    })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('shows the totals and the named leads', () => {
    const html = renderDigest({
      companyName: null,
      summary: summarizeWeek([
        lead({ first_name: 'Ada', estimated_total: 4000 }),
        lead({ first_name: 'Bo', estimated_total: 2000 }),
      ]),
      weekLabel: '12–18 August',
    })
    expect(html).toContain('$6,000')
    expect(html).toContain('Ada')
    expect(html).toContain('Bo')
  })
})

describe('week identifiers', () => {
  it('is stable for every day within one ISO week', () => {
    const keys = ['2026-08-17', '2026-08-19', '2026-08-23'].map((d) => isoWeekKey(new Date(`${d}T00:00:00Z`)))
    expect(new Set(keys).size).toBe(1)
  })

  it('changes when the week does', () => {
    expect(isoWeekKey(new Date('2026-08-23T00:00:00Z'))).not.toBe(
      isoWeekKey(new Date('2026-08-24T00:00:00Z'))
    )
  })

  it('formats a label inside one month and across two', () => {
    expect(weekLabel(new Date('2026-08-12T00:00:00Z'), new Date('2026-08-18T00:00:00Z'))).toBe(
      '12–18 August'
    )
    expect(weekLabel(new Date('2026-07-30T00:00:00Z'), new Date('2026-08-05T00:00:00Z'))).toBe(
      '30 July – 5 August'
    )
  })
})
