import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Covers the seam that makes this feature safe to adopt: with no admin
 * configuration, every purpose must run the exact chain it ran before, and a
 * configured purpose must run the admin's endpoints instead.
 */

const mocks = vi.hoisted(() => ({
  resolvePurposeChain: vi.fn(),
  createAnthropic: vi.fn(),
  createOpenAI: vi.fn(),
  anthropicStream: vi.fn(),
  openaiCreate: vi.fn(),
}))

vi.mock('@/lib/ai/modelRouting', () => ({
  resolvePurposeChain: mocks.resolvePurposeChain,
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages: { stream: typeof mocks.anthropicStream }
    constructor(config: Record<string, unknown>) {
      mocks.createAnthropic(config)
      this.messages = { stream: mocks.anthropicStream }
    }
  },
}))

vi.mock('openai', () => ({
  default: class {
    chat: { completions: { create: typeof mocks.openaiCreate } }
    constructor(config: Record<string, unknown>) {
      mocks.createOpenAI(config)
      this.chat = { completions: { create: mocks.openaiCreate } }
    }
  },
}))

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return {
        generateContent: async () => ({
          response: { text: () => 'gemini text', candidates: [], usageMetadata: undefined },
        }),
      }
    }
  },
}))

import { generateTextForPurpose } from './aiTextProvider'

function anthropicReply(text: string) {
  mocks.anthropicStream.mockReturnValue({
    finalMessage: async () => ({
      content: [{ type: 'text', text }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 5 },
    }),
  })
}

function openaiReply(text: string) {
  mocks.openaiCreate.mockResolvedValue({
    choices: [{ message: { content: text }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  })
}

describe('generateTextForPurpose', () => {
  const env = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ANTHROPIC_API_KEY = 'env-anthropic'
    process.env.OPENAI_API_KEY = 'env-openai'
    process.env.GEMINI_API_KEY = 'env-gemini'
    delete process.env.FULL_REDESIGN_ANTHROPIC_MODEL
    delete process.env.CUSTOM_SITE_CLAUDE_MODEL
  })

  afterEach(() => {
    process.env = { ...env }
  })

  it('unconfigured: full redesign still leads with the env Anthropic model', async () => {
    mocks.resolvePurposeChain.mockResolvedValue(null)
    anthropicReply('built-in')

    const result = await generateTextForPurpose('full_redesign_page', {
      prompt: 'hi',
      jsonMode: false,
    })

    expect(result.text).toBe('built-in')
    expect(result.provider).toBe('anthropic')
    expect(result.model).toBe('claude-opus-5')
    // No base URL override when nothing is configured.
    expect(mocks.createAnthropic).toHaveBeenCalledWith({ apiKey: 'env-anthropic' })
  })

  it('configured: routes to a local OpenAI-compatible endpoint', async () => {
    mocks.resolvePurposeChain.mockResolvedValue([
      {
        providerSlug: 'ollama-gpu',
        label: 'Ollama',
        kind: 'openai_compatible',
        model: 'llama3.1:70b',
        baseUrl: 'https://gpu.example/v1',
        apiKey: null,
        headers: {},
      },
    ])
    openaiReply('local text')

    const result = await generateTextForPurpose('full_redesign_page', {
      prompt: 'hi',
      jsonMode: false,
    })

    expect(result.text).toBe('local text')
    expect(result.model).toBe('llama3.1:70b')
    expect(mocks.createOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: 'https://gpu.example/v1', apiKey: 'not-required' })
    )
    expect(mocks.anthropicStream).not.toHaveBeenCalled()
  })

  it('passes a stored key and custom headers to the endpoint', async () => {
    mocks.resolvePurposeChain.mockResolvedValue([
      {
        providerSlug: 'vllm',
        label: 'vLLM',
        kind: 'openai_compatible',
        model: 'qwen',
        baseUrl: 'https://vllm.example/v1',
        apiKey: 'stored-token',
        headers: { 'x-tenant': 'acme' },
      },
    ])
    openaiReply('ok')

    await generateTextForPurpose('craft_answers', { prompt: 'hi', jsonMode: false })

    expect(mocks.createOpenAI).toHaveBeenCalledWith({
      apiKey: 'stored-token',
      baseURL: 'https://vllm.example/v1',
      defaultHeaders: { 'x-tenant': 'acme' },
    })
  })

  it('falls through to the next configured endpoint when the first fails', async () => {
    mocks.resolvePurposeChain.mockResolvedValue([
      {
        providerSlug: 'local-down',
        label: 'Local',
        kind: 'openai_compatible',
        model: 'llama',
        baseUrl: 'https://down.example/v1',
        apiKey: null,
        headers: {},
      },
      {
        providerSlug: 'anthropic-prod',
        label: 'Anthropic',
        kind: 'anthropic',
        model: 'claude-opus-5',
        baseUrl: null,
        apiKey: 'stored-anthropic',
        headers: {},
      },
    ])
    mocks.openaiCreate.mockRejectedValue(new Error('ECONNREFUSED'))
    anthropicReply('recovered')

    const result = await generateTextForPurpose('full_redesign_page', {
      prompt: 'hi',
      jsonMode: false,
    })

    expect(result.text).toBe('recovered')
    expect(result.provider).toBe('anthropic')
    expect(mocks.createAnthropic).toHaveBeenCalledWith({ apiKey: 'stored-anthropic' })
  })

  it('reports the purpose when every configured endpoint fails', async () => {
    mocks.resolvePurposeChain.mockResolvedValue([
      {
        providerSlug: 'local-down',
        label: 'Local',
        kind: 'openai_compatible',
        model: 'llama',
        baseUrl: 'https://down.example/v1',
        apiKey: null,
        headers: {},
      },
    ])
    mocks.openaiCreate.mockRejectedValue(new Error('ECONNREFUSED'))

    await expect(
      generateTextForPurpose('sitemap', { prompt: 'hi', jsonMode: false })
    ).rejects.toThrow(/configured for "sitemap"/)
  })

  it('refuses an image purpose on the text path', async () => {
    mocks.resolvePurposeChain.mockResolvedValue(null)
    // image_logo is a real purpose id, so this is a runtime guard rather than a
    // type error: an image purpose must never be served by the text path.
    await expect(
      generateTextForPurpose('image_logo', { prompt: 'hi', jsonMode: false })
    ).rejects.toThrow(/image purpose/)
  })
})
