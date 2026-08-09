import { afterEach, describe, expect, it } from 'vitest'
import {
  CLAUDE_FABLE_MODEL,
  CLAUDE_SONNET_MODEL,
  FULL_REDESIGN_PROVIDER_CHAIN,
  GEMINI_FULL_REDESIGN_MODEL,
  GEMINI_SURGICAL_MODEL,
  OPENAI_FULL_REDESIGN_MODEL,
  OPENAI_SURGICAL_MODEL,
  SURGICAL_PROVIDER_CHAIN,
  resolveClaudeModel,
  resolveFullRedesignGeminiModel,
  resolveFullRedesignOpenAiModel,
  resolveGeminiModel,
  resolveOpenAiModel,
  estimateAiTextCostUsd,
} from './aiTextProvider'

describe('full redesign model defaults', () => {
  const prevOpenAi = process.env.FULL_REDESIGN_OPENAI_MODEL
  const prevGemini = process.env.FULL_REDESIGN_GEMINI_MODEL

  afterEach(() => {
    if (prevOpenAi === undefined) delete process.env.FULL_REDESIGN_OPENAI_MODEL
    else process.env.FULL_REDESIGN_OPENAI_MODEL = prevOpenAi
    if (prevGemini === undefined) delete process.env.FULL_REDESIGN_GEMINI_MODEL
    else process.env.FULL_REDESIGN_GEMINI_MODEL = prevGemini
  })

  it('uses GPT-5.6 Sol, Gemini 3.1 Pro, then Sonnet 5', () => {
    delete process.env.FULL_REDESIGN_OPENAI_MODEL
    delete process.env.FULL_REDESIGN_GEMINI_MODEL
    expect([...FULL_REDESIGN_PROVIDER_CHAIN]).toEqual([
      'openai',
      'gemini',
      'anthropic',
    ])
    expect(resolveFullRedesignOpenAiModel()).toBe(OPENAI_FULL_REDESIGN_MODEL)
    expect(resolveFullRedesignGeminiModel()).toBe(GEMINI_FULL_REDESIGN_MODEL)
    expect(CLAUDE_SONNET_MODEL).toBe('claude-sonnet-5')
  })

  it('honors dedicated model overrides', () => {
    process.env.FULL_REDESIGN_OPENAI_MODEL = 'gpt-full-override'
    process.env.FULL_REDESIGN_GEMINI_MODEL = 'gemini-full-override'
    expect(resolveFullRedesignOpenAiModel()).toBe('gpt-full-override')
    expect(resolveFullRedesignGeminiModel()).toBe('gemini-full-override')
    expect(resolveFullRedesignOpenAiModel('gpt-explicit')).toBe('gpt-explicit')
  })
})

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

describe('estimateAiTextCostUsd', () => {
  it('omits estimates until both current rates are configured', () => {
    delete process.env.AI_COST_ANTHROPIC_INPUT_PER_MILLION_USD
    process.env.AI_COST_ANTHROPIC_OUTPUT_PER_MILLION_USD = ''
    expect(estimateAiTextCostUsd('anthropic', 1_000, 2_000)).toBeUndefined()
  })

  it('calculates input and output cost from per-million-token rates', () => {
    process.env.AI_COST_ANTHROPIC_INPUT_PER_MILLION_USD = '3'
    process.env.AI_COST_ANTHROPIC_OUTPUT_PER_MILLION_USD = '15'
    expect(estimateAiTextCostUsd('anthropic', 1_000, 2_000)).toBeCloseTo(0.033)
  })
})
