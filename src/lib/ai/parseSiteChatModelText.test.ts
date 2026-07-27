import { describe, expect, it } from 'vitest'
import {
  extractReplyFromBrokenJson,
  parseSiteChatModelText,
} from './adminSiteChat'

describe('parseSiteChatModelText', () => {
  it('parses clean JSON', () => {
    expect(parseSiteChatModelText('{"reply":"ok","changes":{}}')).toEqual({
      ok: true,
      reply: 'ok',
      changes: {},
    })
  })

  it('recovers reply from truncated changes', () => {
    const out = parseSiteChatModelText(
      '{"reply":"Updated gallery","changes":{"pages_config":[{"slug":"portfolio","images":["https://x.com/a.jpg"'
    )
    expect(out.ok).toBe(true)
    if (out.ok) expect(out.reply).toBe('Updated gallery')
  })

  it('returns ok:false for empty prose without reply field', () => {
    expect(parseSiteChatModelText('sorry I cannot')).toEqual({ ok: false })
  })
})

describe('extractReplyFromBrokenJson', () => {
  it('pulls reply string', () => {
    expect(extractReplyFromBrokenJson('{"reply":"hi there","changes":{')).toBe('hi there')
  })
})
