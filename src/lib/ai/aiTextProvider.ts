import { GoogleGenerativeAI, type GenerationConfig } from '@google/generative-ai'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

/**
 * Shared text-generation provider.
 *
 * - Full redesign / intake: prefer Claude Sonnet when ANTHROPIC_API_KEY is set
 *   (Fable 5 is opt-in via CUSTOM_SITE_CLAUDE_MODEL); Gemini is the fallback.
 * - Surgical edits: Gemini → OpenAI → Anthropic (see generateTextSurgical).
 *
 * Server-only — never import in client components.
 */

export type AiTextProvider = 'anthropic' | 'gemini' | 'openai'

export type TextGenerationOpts = {
  /** The user-facing prompt (or combined system+user prompt for Gemini). */
  prompt: string
  /** Optional system prompt — prepended to prompt for Gemini. */
  systemPrompt?: string
  /** When true, request structured JSON output. */
  jsonMode: boolean
  /** Sampling temperature (default 0.5). Ignored for Claude — Sonnet/Fable reject it. */
  temperature?: number
  /** Maximum output tokens (default 2048). */
  maxOutputTokens?: number
  /**
   * Optional inline images for multimodal prompts (e.g. admin-attached
   * screenshots). `data` is raw base64 WITHOUT the `data:...;base64,` prefix.
   */
  images?: Array<{ mimeType: string; data: string }>
  /**
   * 'anthropic' routes to Claude when ANTHROPIC_API_KEY is set,
   * silently falling back to Gemini otherwise. 'openai' / 'gemini' force
   * that provider when its key is set. Default is Gemini.
   */
  preferredProvider?: AiTextProvider
  /**
   * Override Claude model id. Defaults to CUSTOM_SITE_CLAUDE_MODEL or
   * claude-sonnet-5 (fast enough for Full redesign inside Vercel limits).
   */
  anthropicModel?: string
  /** Override OpenAI chat model. Defaults to CUSTOM_SITE_OPENAI_MODEL or gpt-4.1. */
  openaiModel?: string
  /** Override Gemini model. Defaults to CUSTOM_SITE_GEMINI_MODEL or gemini-pro-latest. */
  geminiModel?: string
  /**
   * Abort Claude after this many ms (default ~4.5m). Full redesign on the
   * dedicated 800s processor can raise this so long generations finish.
   */
  abortMs?: number
}

export type TextGenerationResult = {
  text: string
  provider: AiTextProvider
  model?: string
}

/** Fast production default — finishes Full redesign inside the 5m budget. */
export const CLAUDE_SONNET_MODEL = 'claude-sonnet-5'
/** Slower frontier model — deep craft, often too slow for one-shot site JSON. */
export const CLAUDE_FABLE_MODEL = 'claude-fable-5'
/** Best OpenAI chat model for surgical edits (env-overridable). */
export const OPENAI_SURGICAL_MODEL = 'gpt-4.1'
/** Best Gemini model alias for surgical edits (env-overridable). */
export const GEMINI_SURGICAL_MODEL = 'gemini-pro-latest'

/**
 * Default Claude abort (~8.3 min). Dedicated Full redesign worker has 800s;
 * leave room for brief enhance + service images after the model returns.
 */
const CLAUDE_ABORT_MS = 500_000

/** Surgical edit provider order: Gemini → OpenAI → Anthropic. */
export const SURGICAL_PROVIDER_CHAIN: readonly AiTextProvider[] = [
  'gemini',
  'openai',
  'anthropic',
] as const

export function resolveClaudeModel(override?: string): string {
  const fromOpts = override?.trim()
  if (fromOpts) return fromOpts
  const fromEnv = process.env.CUSTOM_SITE_CLAUDE_MODEL?.trim()
  if (fromEnv) return fromEnv
  return CLAUDE_SONNET_MODEL
}

export function resolveOpenAiModel(override?: string): string {
  const fromOpts = override?.trim()
  if (fromOpts) return fromOpts
  const fromEnv = process.env.CUSTOM_SITE_OPENAI_MODEL?.trim()
  if (fromEnv) return fromEnv
  return OPENAI_SURGICAL_MODEL
}

export function resolveGeminiModel(override?: string): string {
  const fromOpts = override?.trim()
  if (fromOpts) return fromOpts
  const fromEnv = process.env.CUSTOM_SITE_GEMINI_MODEL?.trim()
  if (fromEnv) return fromEnv
  return GEMINI_SURGICAL_MODEL
}

function providerConfigured(provider: AiTextProvider): boolean {
  if (provider === 'gemini') return !!process.env.GEMINI_API_KEY
  if (provider === 'openai') return !!process.env.OPENAI_API_KEY
  return !!process.env.ANTHROPIC_API_KEY
}

async function generateWithClaude(opts: TextGenerationOpts): Promise<{
  text: string
  model: string
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('Missing ANTHROPIC_API_KEY for text generation')
  }

  const model = resolveClaudeModel(opts.anthropicModel)
  const client = new Anthropic({ apiKey })
  const abortMs = Math.max(60_000, opts.abortMs ?? CLAUDE_ABORT_MS)

  const content: Anthropic.ContentBlockParam[] = [
    { type: 'text', text: opts.prompt },
  ]
  for (const img of opts.images ?? []) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: img.mimeType as
          | 'image/jpeg'
          | 'image/png'
          | 'image/gif'
          | 'image/webp',
        data: img.data,
      },
    })
  }

  // Stream so long generations don't hit the SDK's non-streaming time limit.
  // Do not send temperature — Claude Sonnet 5 / Fable 5 reject it as deprecated.
  const system =
    opts.jsonMode && opts.systemPrompt
      ? `${opts.systemPrompt}\n\nOutput MUST be a single valid JSON object only — no markdown fences, no commentary.`
      : opts.systemPrompt

  const stream = client.messages.stream(
    {
      model,
      max_tokens: Math.max(opts.maxOutputTokens ?? 8192, 8192),
      system,
      messages: [{ role: 'user', content }],
    },
    { signal: AbortSignal.timeout(abortMs) }
  )

  try {
    const message = await stream.finalMessage()
    const text = message.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('')
      .trim()

    if (!text) {
      throw new Error(`Claude returned no content (stop: ${message.stop_reason})`)
    }
    if (message.stop_reason === 'max_tokens') {
      console.warn(
        `[aiTextProvider] Claude output truncated at max_tokens=${Math.max(opts.maxOutputTokens ?? 8192, 8192)} on ${model} — downstream JSON repair may be needed`
      )
    }
    return { text, model }
  } catch (err) {
    const name = err instanceof Error ? err.name : ''
    const msg = err instanceof Error ? err.message : String(err)
    if (name === 'AbortError' || /aborted|timeout/i.test(msg)) {
      const mins = Math.round(abortMs / 60_000)
      throw new Error(
        `Full redesign timed out after ~${mins} minutes on ${model} (still generating). Try again, use a shorter brief, or set CUSTOM_SITE_CLAUDE_MODEL=claude-sonnet-5.`
      )
    }
    // undici / Node fetch often surfaces OOM or host SIGKILL as bare "terminated".
    if (/^terminated$/i.test(msg.trim())) {
      throw new Error(
        `Claude request terminated early on ${model} (often Render OOM on 512MB Starter — upgrade the worker to Standard 2GB and retry).`
      )
    }
    throw err
  }
}

async function generateWithGemini(opts: TextGenerationOpts): Promise<{
  text: string
  model: string
}> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY for text generation')
  }

  const modelName = resolveGeminiModel(opts.geminiModel)
  const genAI = new GoogleGenerativeAI(apiKey)
  const generationConfig: Record<string, unknown> = {
    temperature: opts.temperature ?? 0.5,
    maxOutputTokens: opts.maxOutputTokens ?? 2048,
  }
  if (opts.jsonMode) {
    generationConfig.responseMimeType = 'application/json'
  }

  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: generationConfig as GenerationConfig,
  })

  // Gemini doesn't have a separate system role in the simple API — prepend
  // the system prompt to the user prompt if provided.
  const fullPrompt = opts.systemPrompt
    ? `System: ${opts.systemPrompt}\n\nUser: ${opts.prompt}`
    : opts.prompt

  const parts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [{ text: fullPrompt }]
  for (const img of opts.images ?? []) {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } })
  }

  const result = await model.generateContent(parts)

  // Try the standard accessor first; fall back to raw part extraction
  // (handles edge cases where .text() throws on certain finish reasons).
  let text = ''
  try {
    text = result.response.text()
  } catch {
    text =
      result.response.candidates?.[0]?.content?.parts
        ?.map((p) => ('text' in p ? p.text : ''))
        .join('') ?? ''
  }

  if (!text.trim()) {
    const finishReason = result.response.candidates?.[0]?.finishReason
    throw new Error(
      `Gemini returned no content${finishReason ? ` (${finishReason})` : ''}`
    )
  }
  if (result.response.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
    console.warn(
      `[aiTextProvider] Gemini output truncated at maxOutputTokens=${opts.maxOutputTokens ?? 2048} on ${modelName} — downstream JSON repair may be needed`
    )
  }
  return { text: text.trim(), model: modelName }
}

async function generateWithOpenAI(opts: TextGenerationOpts): Promise<{
  text: string
  model: string
}> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY for text generation')
  }

  const model = resolveOpenAiModel(opts.openaiModel)
  const client = new OpenAI({ apiKey })
  const abortMs = Math.max(60_000, opts.abortMs ?? CLAUDE_ABORT_MS)

  const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [
    { type: 'text', text: opts.prompt },
  ]
  for (const img of opts.images ?? []) {
    userContent.push({
      type: 'image_url',
      image_url: {
        url: `data:${img.mimeType};base64,${img.data}`,
      },
    })
  }

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = []
  if (opts.systemPrompt) {
    const system =
      opts.jsonMode
        ? `${opts.systemPrompt}\n\nOutput MUST be a single valid JSON object only — no markdown fences, no commentary.`
        : opts.systemPrompt
    messages.push({ role: 'system', content: system })
  }
  messages.push({ role: 'user', content: userContent })

  const completion = await client.chat.completions.create(
    {
      model,
      messages,
      temperature: opts.temperature ?? 0.5,
      max_completion_tokens: Math.max(opts.maxOutputTokens ?? 2048, 2048),
      ...(opts.jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
    },
    { signal: AbortSignal.timeout(abortMs) }
  )

  const text = completion.choices[0]?.message?.content?.trim() ?? ''
  if (!text) {
    throw new Error(
      `OpenAI returned no content (finish: ${completion.choices[0]?.finish_reason ?? 'unknown'})`
    )
  }
  return { text, model }
}

async function generateWithProvider(
  provider: AiTextProvider,
  opts: TextGenerationOpts
): Promise<TextGenerationResult> {
  if (provider === 'anthropic') {
    const { text, model } = await generateWithClaude(opts)
    return { text, provider: 'anthropic', model }
  }
  if (provider === 'openai') {
    const { text, model } = await generateWithOpenAI(opts)
    return { text, provider: 'openai', model }
  }
  const { text, model } = await generateWithGemini(opts)
  return { text, provider: 'gemini', model }
}

/**
 * Generate text content. Routes to Claude when the caller prefers Anthropic
 * and a key is configured; otherwise Gemini (or OpenAI if preferred).
 */
export async function generateTextWithFallback(
  opts: TextGenerationOpts
): Promise<TextGenerationResult> {
  const chain: AiTextProvider[] = [];

  if (opts.preferredProvider && providerConfigured(opts.preferredProvider)) {
    chain.push(opts.preferredProvider);
  }

  const defaultOrder: AiTextProvider[] = ['gemini', 'openai', 'anthropic'];
  for (const p of defaultOrder) {
    if (!chain.includes(p) && providerConfigured(p)) {
      chain.push(p);
    }
  }

  if (chain.length === 0) {
    throw new Error('Missing GEMINI_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY — cannot generate text');
  }

  let lastErr: unknown = null;
  for (let i = 0; i < chain.length; i++) {
    const provider = chain[i]!;
    try {
      const result = await generateWithProvider(provider, opts);
      if (i > 0) {
        console.warn(
          `[aiTextProvider] generateTextWithFallback succeeded on fallback provider=${provider} model=${result.model ?? '?'}`
        );
      }
      return result;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const next = chain[i + 1];
      console.warn(
        `[aiTextProvider] ${provider} failed${next ? ` — falling back to ${next}` : ''}: ${msg.slice(0, 300)}`
      );
    }
  }

  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(`AI generation failed on all providers: ${msg}`);
}

/**
 * Providers available for surgical edits, in fallback order.
 * Skips any whose API key is missing.
 */
export function configuredSurgicalProviders(): AiTextProvider[] {
  return SURGICAL_PROVIDER_CHAIN.filter(providerConfigured)
}

/**
 * Surgical edits only: try Gemini, then OpenAI, then Anthropic.
 * Skips providers without an API key. Falls through on credit / API / empty
 * response failures so site-wide renames keep working when one vendor is down.
 *
 * Callers that need to fall through on bad JSON should iterate
 * `configuredSurgicalProviders()` with `generateTextWithFallback` themselves
 * (see `callModelJson` in generateCustomSite).
 */
export async function generateTextSurgical(
  opts: TextGenerationOpts
): Promise<TextGenerationResult> {
  const chain = configuredSurgicalProviders()
  if (chain.length === 0) {
    throw new Error(
      'AI is not configured for surgical edits (need GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY).'
    )
  }

  let lastErr: unknown = null
  for (let i = 0; i < chain.length; i++) {
    const provider = chain[i]!
    try {
      const result = await generateWithProvider(provider, opts)
      if (i > 0) {
        console.warn(
          `[aiTextProvider] surgical succeeded on fallback provider=${provider} model=${result.model ?? '?'}`
        )
      }
      return result
    } catch (err) {
      lastErr = err
      const msg = err instanceof Error ? err.message : String(err)
      const next = chain[i + 1]
      console.warn(
        `[aiTextProvider] surgical ${provider} failed${next ? ` — trying ${next}` : ''}: ${msg.slice(0, 400)}`
      )
    }
  }

  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr)
  throw new Error(`Surgical AI generation failed on all providers: ${msg}`)
}
