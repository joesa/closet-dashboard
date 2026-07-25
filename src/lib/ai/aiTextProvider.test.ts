import { afterEach, describe, expect, it } from 'vitest'
import {
  CLAUDE_FABLE_MODEL,
  CLAUDE_SONNET_MODEL,
  resolveClaudeModel,
} from './aiTextProvider'

describe('resolveClaudeModel', () => {
  const prev = process.env.CUSTOM_SITE_CLAUDE_MODEL

  afterEach(() => {
    if (prev === undefined) delete process.env.CUSTOM_SITE_CLAUDE_MODEL
    else process.env.CUSTOM_SITE_CLAUDE_MODEL = prev
  })

  it('defaults to Sonnet 5 for Full redesign speed', () => {
    delete process.env.CUSTOM_SITE_CLAUDE_MODEL
    expect(resolveClaudeModel()).toBe(CLAUDE_SONNET_MODEL)
  })

  it('honors explicit override then env', () => {
    process.env.CUSTOM_SITE_CLAUDE_MODEL = CLAUDE_FABLE_MODEL
    expect(resolveClaudeModel()).toBe(CLAUDE_FABLE_MODEL)
    expect(resolveClaudeModel('claude-sonnet-5')).toBe('claude-sonnet-5')
  })
})
