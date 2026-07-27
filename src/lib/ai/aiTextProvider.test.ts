import { afterEach, describe, expect, it } from 'vitest'
import {
  CLAUDE_FABLE_MODEL,
  CLAUDE_SONNET_MODEL,
  GEMINI_SURGICAL_MODEL,
  OPENAI_SURGICAL_MODEL,
  SURGICAL_PROVIDER_CHAIN,
  resolveClaudeModel,
  resolveGeminiModel,
  resolveOpenAiModel,
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

describe('surgical model defaults', () => {
  const prevOpenAi = process.env.CUSTOM_SITE_OPENAI_MODEL
  const prevGemini = process.env.CUSTOM_SITE_GEMINI_MODEL

  afterEach(() => {
    if (prevOpenAi === undefined) delete process.env.CUSTOM_SITE_OPENAI_MODEL
    else process.env.CUSTOM_SITE_OPENAI_MODEL = prevOpenAi
    if (prevGemini === undefined) delete process.env.CUSTOM_SITE_GEMINI_MODEL
    else process.env.CUSTOM_SITE_GEMINI_MODEL = prevGemini
  })

  it('uses Gemini → OpenAI → Anthropic for surgical only', () => {
    expect([...SURGICAL_PROVIDER_CHAIN]).toEqual([
      'gemini',
      'openai',
      'anthropic',
    ])
  })

  it('defaults OpenAI / Gemini surgical models', () => {
    delete process.env.CUSTOM_SITE_OPENAI_MODEL
    delete process.env.CUSTOM_SITE_GEMINI_MODEL
    expect(resolveOpenAiModel()).toBe(OPENAI_SURGICAL_MODEL)
    expect(resolveGeminiModel()).toBe(GEMINI_SURGICAL_MODEL)
  })

  it('honors env overrides for surgical models', () => {
    process.env.CUSTOM_SITE_OPENAI_MODEL = 'gpt-5'
    process.env.CUSTOM_SITE_GEMINI_MODEL = 'gemini-2.5-pro'
    expect(resolveOpenAiModel()).toBe('gpt-5')
    expect(resolveGeminiModel()).toBe('gemini-2.5-pro')
    expect(resolveOpenAiModel('gpt-4.1')).toBe('gpt-4.1')
  })
})
