import { describe, expect, it } from 'vitest'
import { repairTruncatedJson } from './generateSiteConfig'

describe('repairTruncatedJson', () => {
  it('leaves already-valid JSON parseable', () => {
    const input = '{"a": 1, "b": ["x", "y"]}'
    expect(JSON.parse(repairTruncatedJson(input))).toEqual({ a: 1, b: ['x', 'y'] })
  })

  it('closes open brackets when output is cut off after a complete value', () => {
    const input = '{"pages": {"/": {"html": "<h1>Hi</h1>"'
    expect(JSON.parse(repairTruncatedJson(input))).toEqual({
      pages: { '/': { html: '<h1>Hi</h1>' } },
    })
  })

  it('drops a string value truncated mid-way', () => {
    const input = '{"reply": "done", "globalCss": "body{color:#111'
    expect(JSON.parse(repairTruncatedJson(input))).toEqual({ reply: 'done' })
  })

  it('drops a dangling key with no value', () => {
    const input = '{"reply": "done", "pages":'
    expect(JSON.parse(repairTruncatedJson(input))).toEqual({ reply: 'done' })
  })

  it('drops a trailing comma before closing', () => {
    const input = '{"a": 1,'
    expect(JSON.parse(repairTruncatedJson(input))).toEqual({ a: 1 })
  })

  it('handles truncation inside a nested pages object with escapes', () => {
    const input =
      '{"mode": "inline", "pages": {"/": {"html": "<a href=\\"/about\\">About</a>", "title": "Home"}, "/about": {"html": "<p>We are'
    expect(JSON.parse(repairTruncatedJson(input))).toEqual({
      mode: 'inline',
      pages: {
        '/': { html: '<a href="/about">About</a>', title: 'Home' },
        '/about': {},
      },
    })
  })

  it('strips prose before the first brace', () => {
    const input = 'Here is your JSON:\n{"a": 1}'
    expect(JSON.parse(repairTruncatedJson(input))).toEqual({ a: 1 })
  })
})
