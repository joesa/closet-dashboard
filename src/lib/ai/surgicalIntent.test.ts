import { describe, expect, it } from 'vitest'
import {
  classifySurgicalIntent,
  looksLikeSurgicalOpsRequest,
} from './surgicalIntent'

describe('classifySurgicalIntent', () => {
  it('prioritizes video over open-ended', () => {
    expect(
      classifySurgicalIntent('Add the uploaded mp4 video after the hero').kind
    ).toBe('video')
  })

  it('skips video when hasImages (legacy)', () => {
    expect(
      classifySurgicalIntent('Add the video', { hasImages: true }).kind
    ).not.toBe('video')
  })

  it('prioritizes hero image', () => {
    expect(
      classifySurgicalIntent('Use this image as the hero background').kind
    ).toBe('hero_image')
  })

  it('prioritizes contact over ops-style wording', () => {
    expect(
      classifySurgicalIntent('Change the phone number to 931-555-1212').kind
    ).toBe('contact')
    expect(
      classifySurgicalIntent('Update email from a@b.com to c@d.com').kind
    ).toBe('contact')
  })

  it('prioritizes service drawer over clickable cards', () => {
    expect(
      classifySurgicalIntent(
        'Make service cards open a side drawer with details'
      ).kind
    ).toBe('service_drawer')
  })

  it('routes clickable cards when no drawer asked', () => {
    expect(
      classifySurgicalIntent('Make the service cards clickable').kind
    ).toBe('clickable_cards')
  })

  it('routes mid-tier rename / replace to ops', () => {
    expect(classifySurgicalIntent('Rename Acme to Acme Pros everywhere').kind).toBe(
      'ops'
    )
    expect(
      classifySurgicalIntent('Change the heading to Welcome Home').kind
    ).toBe('ops')
    expect(
      classifySurgicalIntent('Make the CTA link to /contact').kind
    ).toBe('ops')
    expect(looksLikeSurgicalOpsRequest('find and replace Foo with Bar')).toBe(
      true
    )
  })

  it('falls through to open_ended for free-form copy/layout', () => {
    expect(
      classifySurgicalIntent('Tighten the about section copy and make it warmer')
        .kind
    ).toBe('open_ended')
    expect(classifySurgicalIntent('Make it nicer').kind).toBe('open_ended')
  })
})
