import { describe, it, expect, vi, beforeEach } from 'vitest'
import { findEmailsByPhone, findPhonesByEmail } from './outreach-leads'

function mockAdmin(tables: Record<string, { data: unknown[] }>) {
  const from = vi.fn((table: string) => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockResolvedValue({ data: tables[table]?.data ?? [] }),
    }
    return chain
  })
  return { from } as unknown as Parameters<typeof findEmailsByPhone>[0]
}

describe('outreach-leads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('merges emails from widget and scraper leads by phone', async () => {
    const admin = mockAdmin({
      leads: { data: [{ email: 'widget@example.com' }] },
      scraper_leads: { data: [{ email: 'scraper@example.com' }] },
    })

    const emails = await findEmailsByPhone(admin, '+15551234567')
    expect(emails).toContain('widget@example.com')
    expect(emails).toContain('scraper@example.com')
    expect(emails).toHaveLength(2)
  })

  it('merges phones from both tables by email', async () => {
    const admin = mockAdmin({
      leads: { data: [{ phone: '+1111' }] },
      scraper_leads: { data: [{ phone: '+2222' }] },
    })

    const phones = await findPhonesByEmail(admin, 'test@example.com')
    expect(phones).toContain('+1111')
    expect(phones).toContain('+2222')
  })
})
