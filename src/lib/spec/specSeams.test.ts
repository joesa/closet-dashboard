import { describe, expect, it } from 'vitest'
import { buildAiProvisionPayload } from '@/lib/intake/buildAiProvisionPayload'
import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'

/**
 * The seams that keep a spec build from touching a real person.
 *
 * A spec site is built for a business that has not asked for one, seen it, or
 * agreed to buy it. Three things in the shared provisioning path would
 * otherwise reach them anyway: a welcome email with login credentials, a
 * Supabase account created in their name, and — via autoApproveTenantSite — a
 * public site plus a payment link. The first two are decided here.
 *
 * Both halves matter. Getting the spec case right while breaking the paying
 * case would silently stop real customers receiving their credentials, so every
 * assertion below is paired.
 */

const READY_INTAKE = {
  id: 'intake-1',
  token: 'tok',
  business_name: 'Test Co',
  contact_email: 'owner@theirbusiness.example',
  notification_email: null,
  intake_tier: 'ai_premium',
  deposit_status: 'waived',
  deposit_required_cents: 0,
  deposit_paid_cents: 0,
  services: ['Roofing'],
  other_services: null,
  ai_site_config: { siteConfig: { hero: {} }, pagesConfig: [] },
  image_selections: {
    hero: { selectedUrl: 'https://example.test/h.jpg', attemptsUsed: 1, history: [] },
    products: [
      {
        serviceName: 'Roofing',
        selectedUrl: 'https://example.test/p.jpg',
        attemptsUsed: 1,
        history: [],
      },
    ],
  },
  requested_pages: [],
  page_contents: null,
  include_quiz: false,
} as unknown as ProspectIntakeRow

const payloadFor = (source: string) =>
  buildAiProvisionPayload({ ...READY_INTAKE, source } as ProspectIntakeRow, 'http://x', 'sub')

describe('spec build provisioning seams', () => {
  it('sends no welcome email and creates no account for a spec build', async () => {
    const payload = await payloadFor('spec')
    expect(payload.sendWelcomeEmail).toBe(false)
    expect(payload.createAuthUser).toBe(false)
  })

  it.each(['public', 'admin', 'scraper'])(
    'still sends the welcome email and creates the account for a %s intake',
    async (source) => {
      const payload = await payloadFor(source)
      expect(payload.sendWelcomeEmail).toBe(true)
      expect(payload.createAuthUser).toBe(true)
    }
  )

  it('leaves every build gated at pending_approval regardless of source', async () => {
    // Revealing a site is an admin decision for spec builds and a payment gate
    // for customers; neither is provisioning's call to make.
    expect((await payloadFor('spec')).siteStatus).toBe('pending_approval')
    expect((await payloadFor('public')).siteStatus).toBe('pending_approval')
  })
})
