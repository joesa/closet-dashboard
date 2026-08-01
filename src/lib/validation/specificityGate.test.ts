import { describe, expect, it } from 'vitest'
import { analyzeSpecificity, analyzeToneBalance, stripToText } from './specificityGate'

/**
 * Both fixtures are real copy from lumina.ditchtheform.com — the same business,
 * the same brief, before and after it was hand-tuned. The gate exists to tell
 * these two apart, so they make the honest regression test.
 */
const GENERIC = `
  Refined Storage For Elevated Living. Architectural closets with gallery lighting,
  quiet hardware, and a live quote in under a minute. Lumina Custom Closets brings
  architectural precision to the most personal spaces in your home. We specialize in
  high-end, bespoke storage systems that blend seamless functionality with gallery-like
  restraint. Every project is an exercise in quiet luxury. From Vision to Flawless
  Reality. We collaborate closely to capture your storage needs, wardrobing habits, and
  stylistic preferences. Visualize your exact space with high-fidelity digital mockups
  detailing materials, lighting, and finishes. Our veteran craftsmen handle the full
  build with absolute structural integrity and millimeter accuracy.
`

const BESPOKE = `
  Every closet we build starts as a drawing. We survey your walls to the quarter-inch,
  draw the elevation by hand, and build to that sheet — nothing off a shelf, nothing cut
  before you have signed the drawing. Job 24-0619 came to us with a single bare bulb, a
  water stain we had to chase to a flashing leak, and one sagging wire shelf. The left
  sheet is our field survey from the first visit. Drag the divider to see the sheet the
  client signed — double-hang rails, a six-drawer stack on soft-close runners, and 2700K
  strips wired to a dimmer. Both sheets stay in the job folder. If a rail is a half-inch
  off the drawing at install, it comes back to the shop. That has happened twice in nine
  years; both times it came back. One of our two senior fitters lasers every wall, floor
  slope, and out-of-square corner. Old houses in Richland–West End rarely give us a true
  wall; we draw what is actually there. 6–8 wks survey to install.
`

const OWN = { businessName: 'Lumina Custom Closets', locality: 'Nashville' }

function codes(text: string, extra: Record<string, unknown> = {}) {
  return analyzeSpecificity({ text, ...OWN, ...extra }).map((f) => f.code)
}

describe('analyzeSpecificity', () => {
  it('passes the hand-tuned copy it was built to reward', () => {
    expect(analyzeSpecificity({ text: BESPOKE, ...OWN })).toEqual([])
  })

  it('flags the generic copy as formulaic', () => {
    expect(codes(GENERIC)).toContain('copy_ai_tell_phrase')
  })

  it('reports which banned phrases were used', () => {
    const finding = analyzeSpecificity({ text: GENERIC, ...OWN }).find(
      (f) => f.code === 'copy_ai_tell_phrase'
    )
    const samples = finding?.samples.map((s) => s.toLowerCase()) ?? []
    expect(samples).toContain('seamless')
    expect(samples).toContain('quiet luxury')
  })

  it('does not credit the business name or city as proprietary detail', () => {
    const text = `
      ${OWN.businessName} is a trusted provider serving ${OWN.locality} and the
      surrounding area. Our team is dedicated to quality workmanship on every project we
      take on, large or small. We pride ourselves on service and we treat your home as if
      it were our own. Contact ${OWN.businessName} today to find out how our team can
      help you with your next project anywhere in ${OWN.locality}.
    `
    expect(codes(text)).toContain('copy_no_proprietary_detail')
  })

  it('treats "elevation" as the architectural noun, not the banned verb', () => {
    // Real risk: the ban list contains "elevate"/"elevated", and an elevation
    // drawing is exactly the kind of concrete artifact the gate should reward.
    const finding = analyzeSpecificity({ text: BESPOKE, ...OWN })
    expect(finding.map((f) => f.code)).not.toContain('copy_ai_tell_phrase')
  })

  it('flags round marketing figures but not odd-shaped measurements', () => {
    const decorative = `
      We deliver 100% satisfaction on every job, we are available 24/7 for our
      customers, and we are proud to be the #1 rated choice in the region. Our team
      has the experience to handle any project you can think of, from the smallest
      repair through to a complete replacement, and we always stand behind our work
      because that is simply how we prefer to do business with the people we serve.
    `
    expect(codes(decorative)).toContain('copy_decorative_stat')
    expect(codes(BESPOKE)).not.toContain('copy_decorative_stat')
  })

  it('ignores pages too short to judge', () => {
    expect(analyzeSpecificity({ text: 'Call us on 615-555-0188 for a quote.', ...OWN })).toEqual([])
  })

  it('still scans short headlines for banned marketing tells', () => {
    expect(codes('Elevate your home with storage made for you.')).toContain('copy_ai_tell_phrase')
  })

  it('allows literal trade terminology and verbatim owner language', () => {
    expect(codes('We install seamless aluminum gutters in Clarksville.')).not.toContain(
      'copy_ai_tell_phrase'
    )
    expect(
      analyzeSpecificity({
        text: 'Quiet luxury, built around your wardrobe.',
        sourceText: 'Our preferred phrase is quiet luxury.',
        ...OWN,
      }).map((finding) => finding.code)
    ).not.toContain('copy_ai_tell_phrase')
  })

  it('reads copy out of markup', () => {
    expect(stripToText('<h1>Hello</h1><script>ignore()</script><p>there &amp; back</p>')).toBe(
      'Hello there & back'
    )
  })
})

describe('analyzeToneBalance', () => {
  it('accepts a site that concedes a limit somewhere', () => {
    expect(analyzeToneBalance([BESPOKE])).toEqual([])
  })

  it('flags a site where nothing is ever conceded', () => {
    expect(analyzeToneBalance([GENERIC]).map((f) => f.code)).toEqual(['copy_uniform_positivity'])
  })

  it('credits a caveat on any page, not just the one being checked', () => {
    // The whole reason this check is site-wide: the candid passage usually lives
    // on About, and flagging the home page for that would be noise.
    const home = GENERIC
    const about = `
      We only take on about twenty installs a year, so we cannot promise a slot inside a
      month during spring. If your walls are out of square beyond an inch we will tell you
      before quoting rather than shim it on site and hope for the best afterwards.
    `
    expect(analyzeToneBalance([home, about])).toEqual([])
  })

  it('stays quiet on a site with almost no copy', () => {
    expect(analyzeToneBalance(['Call for a quote.'])).toEqual([])
  })
})
