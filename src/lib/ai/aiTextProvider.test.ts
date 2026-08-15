import { afterEach, describe, expect, it } from 'vitest'
import {
  CLAUDE_FABLE_MODEL,
  CLAUDE_OPUS_MODEL,
  CLAUDE_SONNET_MODEL,
  CLAUDE_FULL_REDESIGN_MODEL,
  FULL_REDESIGN_PROVIDER_CHAIN,
  GEMINI_FULL_REDESIGN_MODEL,
  GEMINI_SURGICAL_MODEL,
  OPENAI_FULL_REDESIGN_MODEL,
  DEFAULT_PROVIDER_CHAIN,
  OPENAI_DEFAULT_MODEL,
  OPENAI_SURGICAL_MODEL,
  SURGICAL_PROVIDER_CHAIN,
  resolveClaudeModel,
  resolveFullRedesignClaudeModel,
  resolveFullRedesignGeminiModel,
  resolveFullRedesignOpenAiModel,
  resolveGeminiModel,
  resolveOpenAiModel,
  estimateAiTextCostUsd,
  retryableProviderDelayMs,
} from './aiTextProvider'

describe('full redesign model defaults', () => {
  const prevOpenAi = process.env.FULL_REDESIGN_OPENAI_MODEL
  const prevGemini = process.env.FULL_REDESIGN_GEMINI_MODEL
  const prevAnthropic = process.env.FULL_REDESIGN_ANTHROPIC_MODEL
  const prevClaude = process.env.CUSTOM_SITE_CLAUDE_MODEL

  afterEach(() => {
    if (prevOpenAi === undefined) delete process.env.FULL_REDESIGN_OPENAI_MODEL
    else process.env.FULL_REDESIGN_OPENAI_MODEL = prevOpenAi
    if (prevGemini === undefined) delete process.env.FULL_REDESIGN_GEMINI_MODEL
    else process.env.FULL_REDESIGN_GEMINI_MODEL = prevGemini
    if (prevAnthropic === undefined) delete process.env.FULL_REDESIGN_ANTHROPIC_MODEL
    else process.env.FULL_REDESIGN_ANTHROPIC_MODEL = prevAnthropic
    if (prevClaude === undefined) delete process.env.CUSTOM_SITE_CLAUDE_MODEL
    else process.env.CUSTOM_SITE_CLAUDE_MODEL = prevClaude
  })

  it('uses Opus 5, then GPT-5.6 Sol, then Gemini 3.1 Pro', () => {
    delete process.env.FULL_REDESIGN_OPENAI_MODEL
    delete process.env.FULL_REDESIGN_GEMINI_MODEL
    delete process.env.FULL_REDESIGN_ANTHROPIC_MODEL
    delete process.env.CUSTOM_SITE_CLAUDE_MODEL
    expect([...FULL_REDESIGN_PROVIDER_CHAIN]).toEqual([
      'anthropic',
      'openai',
      'gemini',
    ])
    expect(resolveFullRedesignOpenAiModel()).toBe(OPENAI_FULL_REDESIGN_MODEL)
    expect(resolveFullRedesignGeminiModel()).toBe(GEMINI_FULL_REDESIGN_MODEL)
    expect(resolveFullRedesignClaudeModel()).toBe(CLAUDE_FULL_REDESIGN_MODEL)
    expect(CLAUDE_FULL_REDESIGN_MODEL).toBe(CLAUDE_OPUS_MODEL)
    expect(CLAUDE_OPUS_MODEL).toBe('claude-opus-5')
    expect(CLAUDE_SONNET_MODEL).toBe('claude-sonnet-5')
  })

  it('honors dedicated model overrides', () => {
    process.env.FULL_REDESIGN_OPENAI_MODEL = 'gpt-full-override'
    process.env.FULL_REDESIGN_GEMINI_MODEL = 'gemini-full-override'
    expect(resolveFullRedesignOpenAiModel()).toBe('gpt-full-override')
    expect(resolveFullRedesignGeminiModel()).toBe('gemini-full-override')
    expect(resolveFullRedesignOpenAiModel('gpt-explicit')).toBe('gpt-explicit')
  })

  it('falls back to CUSTOM_SITE_CLAUDE_MODEL, then the dedicated override', () => {
    delete process.env.FULL_REDESIGN_ANTHROPIC_MODEL
    process.env.CUSTOM_SITE_CLAUDE_MODEL = CLAUDE_SONNET_MODEL
    expect(resolveFullRedesignClaudeModel()).toBe(CLAUDE_SONNET_MODEL)
    process.env.FULL_REDESIGN_ANTHROPIC_MODEL = 'claude-full-override'
    expect(resolveFullRedesignClaudeModel()).toBe('claude-full-override')
    expect(resolveFullRedesignClaudeModel('claude-explicit')).toBe('claude-explicit')
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

  it('defaults OpenAI to the primary model, not the cheap surgical one', () => {
    // OpenAI is the lead provider now, so an unspecified call writes
    // customer-facing copy — it must land on GPT-5.6 Sol rather than the
    // cheaper model kept around for small mechanical edits.
    delete process.env.CUSTOM_SITE_OPENAI_MODEL
    delete process.env.CUSTOM_SITE_GEMINI_MODEL
    expect(resolveOpenAiModel()).toBe(OPENAI_DEFAULT_MODEL)
    expect(OPENAI_DEFAULT_MODEL).toBe('gpt-5.6-sol')
    expect(OPENAI_DEFAULT_MODEL).not.toBe(OPENAI_SURGICAL_MODEL)
    expect(resolveGeminiModel()).toBe(GEMINI_SURGICAL_MODEL)
  })

  it('leads the default fallback chain with OpenAI', () => {
    expect(DEFAULT_PROVIDER_CHAIN[0]).toBe('openai')
    // Anthropic stays last rather than being dropped, so topping the balance
    // up restores it as a backstop without a code change.
    expect(DEFAULT_PROVIDER_CHAIN).toContain('anthropic')
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

describe('retryableProviderDelayMs', () => {
  it('honors a Retry-After header when it is a sane number of seconds', () => {
    const delay = retryableProviderDelayMs(
      { status: 429, headers: { 'retry-after': '2' } },
      0
    )
    expect(delay).toBe(2000)
  })

  it('ignores an absurd Retry-After and falls back to jittered backoff', () => {
    const delay = retryableProviderDelayMs(
      { status: 429, headers: { 'retry-after': '3600' } },
      0
    )!
    // 2000ms base at attempt 0, ±25% jitter.
    expect(delay).toBeGreaterThanOrEqual(1500)
    expect(delay).toBeLessThanOrEqual(2500)
  })

  it('backs off further on later attempts, capped at 20s', () => {
    const later = retryableProviderDelayMs({ status: 503 }, 5)!
    expect(later).toBeGreaterThanOrEqual(15_000)
    expect(later).toBeLessThanOrEqual(25_000)
  })

  it('treats overload and rate-limit wording as retryable even without a status', () => {
    for (const message of [
      'Rate limit reached for gpt-5.6-sol',
      'RESOURCE_EXHAUSTED: quota',
      'Overloaded',
      '429 Too Many Requests',
    ]) {
      expect(retryableProviderDelayMs({ message }, 0), message).not.toBeNull()
    }
  })

  it('does not retry ordinary failures', () => {
    for (const err of [
      { status: 400, message: 'invalid request' },
      { status: 401, message: 'bad key' },
      new Error('context length exceeded'),
    ]) {
      expect(retryableProviderDelayMs(err, 0)).toBeNull()
    }
  })
})
