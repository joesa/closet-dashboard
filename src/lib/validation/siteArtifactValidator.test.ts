import { describe, expect, it } from 'vitest'
import type { CustomSiteConfig } from '@/lib/customSite'
import { validateCustomSiteArtifact, validateEngineSiteDraft } from './siteArtifactValidator'

function artifact(home: string, about: string): CustomSiteConfig {
  return {
    mode: 'inline',
    pages: {
      '/': { html: `${home}<!-- CLOSET_WIDGET -->` },
      '/about': { html: about },
    },
  }
}

describe('validateCustomSiteArtifact', () => {
  it('blocks a prohibited phrase on any page and identifies that page', () => {
    const report = validateCustomSiteArtifact(
      artifact(
        '<h1>Roof repairs measured before we quote</h1><p>Call for a written scope.</p>',
        '<h2>Elevate your property</h2><p>Our crew handles every detail for you.</p>'
      )
    )
    expect(report.status).toBe('failed')
    expect(report.issues).toContainEqual(
      expect.objectContaining({ code: 'copy_ai_tell_phrase', meta: expect.objectContaining({ path: '/about' }) })
    )
  })

  it('blocks spec-sheet CTAs and decorative service numbering', () => {
    const report = validateCustomSiteArtifact(
      artifact(
        '<span>01</span><span>02</span><span>03</span><a href="/services">View Protocol</a>',
        '<h2>Our pediatric services</h2>'
      )
    )
    expect(report.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['spec_sheet_cta', 'decorative_numbered_list'])
    )
  })

  it('hashes the exact artifact deterministically', () => {
    const config = artifact(
      '<h1>6–8 week cabinet builds</h1><p>Every drawing names the Blum runners we install.</p>',
      '<p>We only schedule twenty installs each year. Out-of-square walls get measured before cutting.</p>'
    )
    expect(validateCustomSiteArtifact(config).artifactHash).toBe(
      validateCustomSiteArtifact(config).artifactHash
    )
  })
})

describe('validateEngineSiteDraft', () => {
  it('checks all active page copy and nav referential integrity', () => {
    const report = validateEngineSiteDraft({
      pagesConfig: [
        {
          slug: '/about',
          title: 'About',
          hero: { headline: 'Elevate your property' },
          content_blocks: [],
        },
      ],
      navLinks: [
        { label: 'Home', slug: '/' },
        { label: 'Missing', slug: '/missing' },
      ],
    })
    expect(report.status).toBe('failed')
    expect(report.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['copy_ai_tell_phrase', 'nav_link_missing_page'])
    )
  })

  it('ignores inactive page copy', () => {
    const report = validateEngineSiteDraft({
      pagesConfig: [
        {
          slug: '/hidden',
          title: 'Elevate everything',
          is_active: false,
          content_blocks: [],
        },
      ],
      navLinks: [{ label: 'Home', slug: '/' }],
    })
    expect(report.status).toBe('passed')
  })
})