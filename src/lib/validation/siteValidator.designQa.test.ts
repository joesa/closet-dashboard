import { describe, expect, it } from 'vitest'
import { analyzeRenderedDesign } from '@/lib/validation/siteValidator'

const validPage = `
  <main id="main-content">
    <h1>Acme Plumbing</h1>
    <section><h2>Services</h2><img src="pipe.jpg" alt="Copper pipe repair" /></section>
    <section><h2>Request service</h2><label for="name">Name</label><input id="name" /></section>
  </main>
  <footer>© Acme Plumbing</footer>
`

describe('analyzeRenderedDesign', () => {
  it('accepts a structurally complete page', () => {
    expect(analyzeRenderedDesign(validPage)).toEqual([])
  })

  it('finds landmark, hierarchy, identity, label, image, and empty-section defects', () => {
    const findings = analyzeRenderedDesign(`
      <h1>One</h1><h1>Two</h1><h3>Skipped</h3>
      <section></section>
      <img src="x.jpg" />
      <input id="duplicate" /><div id="duplicate"></div>
    `)
    expect(findings.map((finding) => finding.code)).toEqual(expect.arrayContaining([
      'design_multiple_h1',
      'design_missing_main_landmark',
      'design_missing_footer',
      'design_img_missing_alt',
      'design_duplicate_ids',
      'design_heading_order',
      'design_unlabeled_controls',
      'design_empty_sections',
    ]))
  })
})