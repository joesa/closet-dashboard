import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { priceSpecOffer } from '@/lib/spec/specOffer'
import { derivePreviewPassword, hashPreviewPassword } from '@/lib/spec/specPreviewPassword'
import { specSmsAllowed, specSmsAllowlist } from '@/lib/spec/specSmsAllowlist'
import { SPEC_OFFER_SMS_TEMPLATES } from '@/lib/twilio-sms'

afterEach(() => {
  delete process.env.SPEC_BUILD_SMS_ALLOWLIST
})

/**
 * The allowlist is the last thing between this pipeline and an unsolicited text
 * to a real business. It is checked before suppression, cap and send window,
 * because those answer "should we send now" and this answers "may we contact
 * this person at all".
 */
describe('spec SMS allowlist', () => {
  it('blocks every number except the ones listed', () => {
    process.env.SPEC_BUILD_SMS_ALLOWLIST = '+19315550100'
    expect(specSmsAllowed('+19315550100')).toBe(true)
    expect(specSmsAllowed('+19314367322')).toBe(false)
  })

  it('matches regardless of how the number is written', () => {
    // The list is typed by a human; the pipeline holds E.164. A formatting
    // mismatch that silently blocked everything would look like a broken cron.
    process.env.SPEC_BUILD_SMS_ALLOWLIST = '(931) 555-0100, 931-555-0101'
    expect(specSmsAllowed('+19315550100')).toBe(true)
    expect(specSmsAllowed('+19315550101')).toBe(true)
    expect(specSmsAllowed('+19315550102')).toBe(false)
  })

  it('is inert when unset — which is why it must be set deliberately', () => {
    expect(specSmsAllowlist()).toEqual([])
    expect(specSmsAllowed('+19314367322')).toBe(true)
  })

  it('ignores blank entries rather than treating them as a match', () => {
    process.env.SPEC_BUILD_SMS_ALLOWLIST = ' , ,+19315550100, '
    expect(specSmsAllowlist()).toEqual(['+19315550100'])
    expect(specSmsAllowed('+19314367322')).toBe(false)
  })
})

describe('offer pricing', () => {
  it('halves the list price by default', () => {
    const pricing = priceSpecOffer()
    expect(pricing.percentOff).toBe(50)
    expect(pricing.offerCents).toBe(Math.round(pricing.listCents / 2))
    expect(pricing.offerCents).toBeLessThan(pricing.listCents)
  })

  it('honours a different discount', () => {
    expect(priceSpecOffer(2500).percentOff).toBe(25)
    expect(priceSpecOffer(2500).offerCents).toBe(Math.round(priceSpecOffer().listCents * 0.75))
  })
})

describe('offer SMS templates', () => {
  it('always carry opt-out language', () => {
    // This is an unsolicited message about a site built without asking. The
    // inbound webhook already turns STOP into a suppression; the words are the
    // part that was missing.
    for (const template of SPEC_OFFER_SMS_TEMPLATES) {
      expect.soft(template.body, `step ${template.step}`).toMatch(/reply stop/i)
    }
  })

  it('lead with the offer link, which is the whole payload', () => {
    for (const template of SPEC_OFFER_SMS_TEMPLATES) {
      expect.soft(template.body, `step ${template.step}`).toContain('{offerUrl}')
    }
  })

  it('name the business and the deadline', () => {
    for (const template of SPEC_OFFER_SMS_TEMPLATES) {
      expect.soft(template.body).toContain('{businessName}')
      expect.soft(template.body).toContain('{deadlineLabel}')
    }
  })
})

describe('spec preview password', () => {
  const BUILD_A = '44dc11d4-c5ff-4e36-a368-7d8e0394ab33'
  const BUILD_B = '11111111-2222-3333-4444-555555555555'

  // Derivation is keyed on the shared secret, which CI has no reason to hold.
  beforeEach(() => {
    process.env.SPEC_PREVIEW_SECRET = 'spec-preview-test-secret'
  })
  afterEach(() => {
    delete process.env.SPEC_PREVIEW_SECRET
  })

  it('is readable off a phone screen', () => {
    // It gets read out of a text message and typed by hand, so no characters
    // anybody has to squint at.
    const pw = derivePreviewPassword(BUILD_A)
    expect(pw).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/)
    expect(pw).not.toMatch(/[O0I1S5]/)
  })

  it('is stable for a build, so a resent text still works', () => {
    expect(derivePreviewPassword(BUILD_A)).toBe(derivePreviewPassword(BUILD_A))
  })

  it('differs per build, so one password opens one site', () => {
    expect(derivePreviewPassword(BUILD_A)).not.toBe(derivePreviewPassword(BUILD_B))
    expect(hashPreviewPassword(derivePreviewPassword(BUILD_A))).not.toBe(
      hashPreviewPassword(derivePreviewPassword(BUILD_B))
    )
  })

  it('never stores the password in its own hash', () => {
    const pw = derivePreviewPassword(BUILD_A)
    expect(hashPreviewPassword(pw)).not.toContain(pw.replace('-', ''))
  })

  it('accepts what a human actually types', () => {
    // Lowercase and stray spaces are what you get from a phone keyboard.
    const pw = derivePreviewPassword(BUILD_A)
    const hash = hashPreviewPassword(pw)
    expect(hashPreviewPassword(pw.toLowerCase())).toBe(hash)
    expect(hashPreviewPassword(`  ${pw} `)).toBe(hash)
  })
})

describe('offer SMS carries the password', () => {
  it('includes the password and says the site is private', () => {
    const first = SPEC_OFFER_SMS_TEMPLATES.find((t) => t.step === 1)!
    expect(first.body).toContain('{previewPassword}')
    expect(first.body.toLowerCase()).toMatch(/private/)
  })

  it('repeats the password in the reminder', () => {
    // The reminder may be the only message still in their inbox a week later.
    const second = SPEC_OFFER_SMS_TEMPLATES.find((t) => t.step === 2)!
    expect(second.body).toContain('{previewPassword}')
  })
})
