import { describe, expect, it } from 'vitest'
import { parseAiSiteJson } from './generateSiteConfig'

describe('parseAiSiteJson', () => {
  it('parses clean JSON', () => {
    expect(parseAiSiteJson('{"hero": {"headline": "Hi"}}')).toEqual({
      hero: { headline: 'Hi' },
    })
  })

  it('parses JSON wrapped in markdown fences and prose', () => {
    const raw =
      'Here is the site config you asked for:\n```json\n{"theme": "slate", "pagesConfig": []}\n```\nLet me know if you need changes.'
    expect(parseAiSiteJson(raw)).toEqual({ theme: 'slate', pagesConfig: [] })
  })

  it('recovers JSON truncated mid-string (max_tokens cutoff)', () => {
    const raw =
      '{"hero": {"headline": "Sealcoating Done Right"}, "about": {"description": "We serve the grea'
    expect(parseAiSiteJson(raw)).toEqual({
      hero: { headline: 'Sealcoating Done Right' },
      about: {},
    })
  })

  it('recovers truncated JSON inside a fence with leading prose', () => {
    const raw =
      'Sure!\n```json\n{"products": [{"title": "Crack Filling", "description": "We fill'
    expect(parseAiSiteJson(raw)).toEqual({ products: [{ title: 'Crack Filling' }] })
  })

  it('escapes raw control characters inside strings', () => {
    const raw = '{"hero": {"subheadline": "Line one\nLine two"}}'
    expect(parseAiSiteJson(raw)).toEqual({
      hero: { subheadline: 'Line one\nLine two' },
    })
  })

  it('returns null for unrecoverable garbage', () => {
    expect(parseAiSiteJson('I could not generate the config, sorry.')).toBeNull()
  })

  it('returns null for empty input', () => {
    expect(parseAiSiteJson('')).toBeNull()
  })

  it('returns null when the payload is an array, not an object', () => {
    expect(parseAiSiteJson('[1, 2, 3]')).toBeNull()
  })
})
