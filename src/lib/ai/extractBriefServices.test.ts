import { describe, expect, it } from 'vitest'
import {
  extractServicesNamedInBrief,
  htmlMentionsService,
  injectMissingServicesIntoHtml,
} from './extractBriefServices'

describe('extractServicesNamedInBrief', () => {
  it('pulls wrapping + maintenance from a meta-style redesign seed', () => {
    const brief =
      'Provide a detail prompt for a build a bespoke website for a car wrapping and other car maintenance services such as changing brakes, rotters, oil, filters, engine fixes, etc.'
    const intake = [
      'Mobile Auto Detailing',
      'Ceramic Coating',
      'Oil Change & Maintenance',
      'Mobile Vehicle Inspection',
    ]
    const out = extractServicesNamedInBrief(brief, intake)
    const titles = out.map((s) => s.title)
    expect(titles).toContain('Vehicle Wrapping')
    expect(titles).toContain('Brake Service')
    expect(titles).toContain('Rotor Service')
    expect(titles).toContain('Engine Repair')
    // Oil already covered by intake
    expect(titles).not.toContain('Oil Change')
  })

  it('returns empty when brief names nothing new', () => {
    expect(
      extractServicesNamedInBrief('Make it cleaner and more premium', [
        'Detailing',
        'Wrapping',
      ])
    ).toEqual([])
  })
})

describe('htmlMentionsService / injectMissingServicesIntoHtml', () => {
  it('detects wrap synonyms and injects before footer', () => {
    expect(htmlMentionsService('<h3>Vinyl Wraps</h3>', 'Vehicle Wrapping')).toBe(
      true
    )
    expect(htmlMentionsService('<h3>Oil Change</h3>', 'Vehicle Wrapping')).toBe(
      false
    )
    const html = '<main><section>services</section></main><footer>x</footer>'
    const next = injectMissingServicesIntoHtml(html, [
      {
        title: 'Vehicle Wrapping',
        description: 'Custom vinyl wraps.',
      },
    ])
    expect(next).toContain('Vehicle Wrapping')
    expect(next).toContain('data-brief-added')
    expect(next.indexOf('Vehicle Wrapping')).toBeLessThan(next.indexOf('<footer'))
  })
})
