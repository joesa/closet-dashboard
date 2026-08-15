import { GoogleGenerativeAI, type GenerationConfig } from '@google/generative-ai'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { createSemaphore, type Semaphore } from '@/lib/ai/concurrency'
import { currentAiCallContext } from '@/lib/ai/aiCallContext'
import { resolvePurposeChain, type ResolvedEndpoint } from '@/lib/ai/modelRouting'
import { recordPrompt } from '@/lib/ai/promptRecorder'
import { AI_PURPOSES, type AiPurpose } from '@/lib/ai/purposes'

/**
 * Shared text-generation provider.
 *
 * - Full redesign: Claude Opus 5 → GPT-5.6 Sol → Gemini 3.1 Pro.
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
  /** Explicit provider order. Used by workflows with a fixed fallback policy. */
  providerChain?: readonly AiTextProvider[]
  /**
   * Override Claude model id. Defaults to CUSTOM_SITE_CLAUDE_MODEL or
   * claude-sonnet-5; Full redesign resolves its own default (claude-opus-5).
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
  /**
   * Which named purpose this call serves. Set by generateTextForPurpose and
   * used only to label a recorded prompt when the caller is not inside a
   * timePass scope — the brief and foundation passes are not, and they are
   * precisely the prompts worth reading afterwards.
   */
  purposeLabel?: string
  /**
   * An admin-configured endpoint to call instead of the env-configured vendor
   * default. Set by generateTextForPurpose; leave unset to keep the historical
   * env behavior. Its model, key, base URL and headers win over every
   * env-derived value below.
   */
  endpoint?: ResolvedEndpoint
}

export type TextGenerationResult = {
  text: string
  provider: AiTextProvider
  model?: string
  telemetry?: AiTextTelemetry
}

export type AiTextTelemetry = {
  durationMs: number
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  estimatedCostUsd?: number
}

type ProviderGenerationResult = {
  text: string
  model: string
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

/** Fast production default — finishes Full redesign inside the 5m budget. */
export const CLAUDE_SONNET_MODEL = 'claude-sonnet-5'
/** Frontier Claude — Full redesign's Anthropic slot. */
export const CLAUDE_OPUS_MODEL = 'claude-opus-5'
/** Slower frontier model — deep craft, often too slow for one-shot site JSON. */
export const CLAUDE_FABLE_MODEL = 'claude-fable-5'
/**
 * Default OpenAI model for everything that does not ask for something else.
 *
 * GPT-5.6 Sol rather than a cheaper chat model because this leads
 * DEFAULT_PROVIDER_CHAIN, so whatever sits here is what writes customer-facing
 * copy for callers that express no preference. Full redesign runs its own
 * chain (Claude first) and keeps GPT-5.6 Sol as its second choice, so the two
 * paths still fall back onto the same model rather than diverging.
 *
 * Note gpt-5.6-* rejects `temperature`; generateWithOpenAI already omits it for
 * that family.
 */
export const OPENAI_DEFAULT_MODEL = 'gpt-5.6-sol'
/** Cheaper, faster model for small mechanical edits (env-overridable). */
export const OPENAI_SURGICAL_MODEL = 'gpt-4.1'
/** Best Gemini model alias for surgical edits (env-overridable). */
export const GEMINI_SURGICAL_MODEL = 'gemini-pro-latest'
/** Second-choice model for Full redesign. */
export const OPENAI_FULL_REDESIGN_MODEL = 'gpt-5.6-sol'
/** Last-resort model for Full redesign. */
export const GEMINI_FULL_REDESIGN_MODEL = 'gemini-3.1-pro-preview'
/** Primary model for Full redesign. */
export const CLAUDE_FULL_REDESIGN_MODEL = CLAUDE_OPUS_MODEL

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

/** Full redesign provider order: Anthropic → OpenAI → Gemini. */
export const FULL_REDESIGN_PROVIDER_CHAIN: readonly AiTextProvider[] = [
  'anthropic',
  'openai',
  'gemini',
] as const

/**
 * Fallback order when a caller expresses no preference.
 *
 * OpenAI leads. Anthropic sits last rather than being removed: the key is out
 * of credit, so every call routed there fails and silently falls through, which
 * cost a real round trip on every generation and made the logs read as though
 * Claude were in use. Leaving it in the chain means topping the balance up
 * restores it as a genuine backstop without a code change.
 */
export const DEFAULT_PROVIDER_CHAIN: readonly AiTextProvider[] = [
  'openai',
  'gemini',
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
  return OPENAI_DEFAULT_MODEL
}

export function resolveGeminiModel(override?: string): string {
  const fromOpts = override?.trim()
  if (fromOpts) return fromOpts
  const fromEnv = process.env.CUSTOM_SITE_GEMINI_MODEL?.trim()
  if (fromEnv) return fromEnv
  return GEMINI_SURGICAL_MODEL
}

export function resolveFullRedesignOpenAiModel(override?: string): string {
  return override?.trim() ||
    process.env.FULL_REDESIGN_OPENAI_MODEL?.trim() ||
    OPENAI_FULL_REDESIGN_MODEL
}

export function resolveFullRedesignGeminiModel(override?: string): string {
  return override?.trim() ||
    process.env.FULL_REDESIGN_GEMINI_MODEL?.trim() ||
    GEMINI_FULL_REDESIGN_MODEL
}

/**
 * Full redesign's Anthropic slot. Still honours CUSTOM_SITE_CLAUDE_MODEL so the
 * timeout message's "set it to claude-sonnet-5" escape hatch keeps working.
 */
export function resolveFullRedesignClaudeModel(override?: string): string {
  return override?.trim() ||
    process.env.FULL_REDESIGN_ANTHROPIC_MODEL?.trim() ||
    process.env.CUSTOM_SITE_CLAUDE_MODEL?.trim() ||
    CLAUDE_FULL_REDESIGN_MODEL
}

function providerConfigured(provider: AiTextProvider): boolean {
  if (provider === 'gemini') return !!process.env.GEMINI_API_KEY
  if (provider === 'openai') return !!process.env.OPENAI_API_KEY
  return !!process.env.ANTHROPIC_API_KEY
}

async function generateWithClaude(opts: TextGenerationOpts): Promise<ProviderGenerationResult> {
  const apiKey = opts.endpoint?.apiKey ?? process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('Missing ANTHROPIC_API_KEY for text generation')
  }

  const model = opts.endpoint?.model ?? resolveClaudeModel(opts.anthropicModel)
  const client = new Anthropic({
    apiKey,
    ...(opts.endpoint?.baseUrl ? { baseURL: opts.endpoint.baseUrl } : {}),
    ...(opts.endpoint?.headers && Object.keys(opts.endpoint.headers).length
      ? { defaultHeaders: opts.endpoint.headers }
      : {}),
  })
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
    return {
      text,
      model,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      totalTokens: message.usage.input_tokens + message.usage.output_tokens,
    }
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

async function generateWithGemini(opts: TextGenerationOpts): Promise<ProviderGenerationResult> {
  const apiKey = opts.endpoint?.apiKey ?? process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY for text generation')
  }

  const modelName = opts.endpoint?.model ?? resolveGeminiModel(opts.geminiModel)
  const genAI = new GoogleGenerativeAI(apiKey)
  const generationConfig: Record<string, unknown> = {
    temperature: opts.temperature ?? 0.5,
    maxOutputTokens: opts.maxOutputTokens ?? 2048,
  }
  if (opts.jsonMode) {
    generationConfig.responseMimeType = 'application/json'
  }

  const model = genAI.getGenerativeModel(
    {
      model: modelName,
      generationConfig: generationConfig as GenerationConfig,
    },
    opts.endpoint?.baseUrl ? { baseUrl: opts.endpoint.baseUrl } : undefined
  )

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
  const usage = result.response.usageMetadata
  return {
    text: text.trim(),
    model: modelName,
    inputTokens: usage?.promptTokenCount,
    outputTokens: usage?.candidatesTokenCount,
    totalTokens: usage?.totalTokenCount,
  }
}

async function generateWithOpenAI(opts: TextGenerationOpts): Promise<ProviderGenerationResult> {
  // Local runtimes (Ollama, LM Studio, vLLM) speak this same API and mostly
  // ignore the key, so a placeholder is enough when an endpoint supplies none.
  const apiKey =
    opts.endpoint?.apiKey ??
    (opts.endpoint?.baseUrl ? 'not-required' : process.env.OPENAI_API_KEY)
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY for text generation')
  }

  const model = opts.endpoint?.model ?? resolveOpenAiModel(opts.openaiModel)
  const client = new OpenAI({
    apiKey,
    ...(opts.endpoint?.baseUrl ? { baseURL: opts.endpoint.baseUrl } : {}),
    ...(opts.endpoint?.headers && Object.keys(opts.endpoint.headers).length
      ? { defaultHeaders: opts.endpoint.headers }
      : {}),
  })
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
      ...(!/^gpt-5\.6(?:-|$)/i.test(model)
        ? { temperature: opts.temperature ?? 0.5 }
        : {}),
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
  return {
    text,
    model,
    inputTokens: completion.usage?.prompt_tokens,
    outputTokens: completion.usage?.completion_tokens,
    totalTokens: completion.usage?.total_tokens,
  }
}

export function estimateAiTextCostUsd(
  provider: AiTextProvider,
  inputTokens?: number,
  outputTokens?: number
): number | undefined {
  const prefix = `AI_COST_${provider.toUpperCase()}_`
  const inputRaw = process.env[`${prefix}INPUT_PER_MILLION_USD`]?.trim()
  const outputRaw = process.env[`${prefix}OUTPUT_PER_MILLION_USD`]?.trim()
  if (!inputRaw || !outputRaw) return undefined
  const inputRate = Number(inputRaw)
  const outputRate = Number(outputRaw)
  if (!Number.isFinite(inputRate) || !Number.isFinite(outputRate)) return undefined
  return (((inputTokens ?? 0) * inputRate) + ((outputTokens ?? 0) * outputRate)) / 1_000_000
}

/** Status/message shapes the providers use for "slow down" or "try again". */
export function retryableProviderDelayMs(err: unknown, attempt: number): number | null {
  const e = err as { status?: number; statusCode?: number; headers?: Record<string, unknown>; message?: unknown }
  const status = Number(e?.status ?? e?.statusCode)
  const message = typeof e?.message === 'string' ? e.message : String(err ?? '')
  const retryableStatus = status === 429 || status === 529 || (status >= 500 && status < 600)
  const retryableMessage = /rate.?limit|429|RESOURCE_EXHAUSTED|overloaded|too many requests|503|service unavailable/i.test(message)
  if (!retryableStatus && !retryableMessage) return null

  const header = e?.headers?.['retry-after'] ?? e?.headers?.['Retry-After']
  const retryAfterSec = Number(Array.isArray(header) ? header[0] : header)
  if (Number.isFinite(retryAfterSec) && retryAfterSec > 0 && retryAfterSec <= 60) {
    return Math.round(retryAfterSec * 1000)
  }
  const backoff = Math.min(2000 * 2 ** attempt, 20_000)
  // ±25% jitter so parallel page calls do not retry in lockstep.
  return Math.round(backoff * (0.75 + Math.random() * 0.5))
}

const PROVIDER_RETRY_LIMIT = 2

function providerConcurrencyLimit(provider: AiTextProvider): number {
  const raw = process.env[`AI_PROVIDER_MAX_CONCURRENCY_${provider.toUpperCase()}`]?.trim()
  const parsed = Number(raw)
  if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed)
  // One above the default page fan-out (5), so a guard repair running alongside
  // a full wave of page calls does not have to queue behind them. Raising this
  // costs nothing locally — the worker sits at ~0% CPU during a redesign — so
  // the only real ceiling is the vendor's own rate limit.
  return 6
}

const providerSlots = new Map<AiTextProvider, Semaphore>()
function providerSemaphore(provider: AiTextProvider): Semaphore {
  let slot = providerSlots.get(provider)
  if (!slot) {
    slot = createSemaphore(providerConcurrencyLimit(provider))
    providerSlots.set(provider, slot)
  }
  return slot
}

async function callProvider(
  provider: AiTextProvider,
  opts: TextGenerationOpts
): Promise<ProviderGenerationResult> {
  if (provider === 'anthropic') return generateWithClaude(opts)
  if (provider === 'openai') return generateWithOpenAI(opts)
  return generateWithGemini(opts)
}

async function generateWithProvider(
  provider: AiTextProvider,
  opts: TextGenerationOpts
): Promise<TextGenerationResult> {
  const ctx = currentAiCallContext()
  // Cap concurrent calls per provider regardless of caller, so fanning pages
  // out (or image generation's unbounded Promise.allSettled) cannot stampede.
  const release = await providerSemaphore(provider).acquire()
  const startedAt = Date.now()
  try {
    let result: ProviderGenerationResult | null = null
    for (let attempt = 0; ; attempt += 1) {
      try {
        result = await callProvider(provider, opts)
        break
      } catch (err) {
        const delayMs = attempt < PROVIDER_RETRY_LIMIT ? retryableProviderDelayMs(err, attempt) : null
        // Don't burn the caller's abort budget on a retry that cannot finish;
        // throwing here lets the provider chain fall through as it does today.
        const budgetLeft = opts.abortMs ? opts.abortMs - (Date.now() - startedAt) : Infinity
        if (delayMs === null || delayMs >= budgetLeft) throw err
        console.warn(JSON.stringify({
          event: 'ai_text_retry',
          provider,
          attempt: attempt + 1,
          delayMs,
          runId: ctx?.runId,
          pass: ctx?.pass,
          reason: String((err as { message?: unknown })?.message ?? err).slice(0, 200),
        }))
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
    const telemetry: AiTextTelemetry = {
      durationMs: Date.now() - startedAt,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      totalTokens: result.totalTokens,
      estimatedCostUsd: estimateAiTextCostUsd(provider, result.inputTokens, result.outputTokens),
    }
    // Capture the exact inputs when a Full redesign is recording. No-op
    // otherwise, so every other caller is untouched.
    recordPrompt({
      pass: ctx?.pass ?? opts.purposeLabel ?? null,
      provider,
      model: result.model,
      endpoint: opts.endpoint?.providerSlug ?? null,
      systemPrompt: opts.systemPrompt ?? null,
      userPrompt: opts.prompt,
      imageCount: opts.images?.length ?? 0,
      durationMs: Date.now() - startedAt,
      ok: true,
    })
    console.info(JSON.stringify({
      event: 'ai_text_call',
      provider,
      // Which configured endpoint served this, when admin routing is in play.
      // 'openai' alone cannot distinguish OpenAI from a local llama.cpp box.
      ...(opts.endpoint ? { endpoint: opts.endpoint.providerSlug } : {}),
      model: result.model,
      runId: ctx?.runId,
      pass: ctx?.pass,
      ...telemetry,
    }))
    return { text: result.text, provider, model: result.model, telemetry }
  } finally {
    release()
  }
}

/**
 * Generate text content. Routes to Claude when the caller prefers Anthropic
 * and a key is configured; otherwise Gemini (or OpenAI if preferred).
 */
export async function generateTextWithFallback(
  opts: TextGenerationOpts
): Promise<TextGenerationResult> {
  const chain: AiTextProvider[] = [];

  if (opts.providerChain) {
    for (const provider of opts.providerChain) {
      if (!chain.includes(provider) && providerConfigured(provider)) {
        chain.push(provider)
      }
    }
  } else if (opts.preferredProvider && providerConfigured(opts.preferredProvider)) {
    chain.push(opts.preferredProvider);
  }

  if (!opts.providerChain) {
    for (const p of DEFAULT_PROVIDER_CHAIN) {
      if (!chain.includes(p) && providerConfigured(p)) {
        chain.push(p);
      }
    }
  }

  if (chain.length === 0) {
    throw new Error('Missing GEMINI_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY — cannot generate text');
  }

  let lastErr: unknown = null;
  for (let i = 0; i < chain.length; i++) {
    const provider = chain[i]!;
    const startedAt = Date.now();
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
        `[aiTextProvider] ${provider} failed after ${Date.now() - startedAt}ms${next ? ` — falling back to ${next}` : ''}: ${msg.slice(0, 300)}`
      );
    }
  }

  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(`AI generation failed on all providers: ${msg}`);
}

/** Full redesign only: Claude Opus 5 → GPT-5.6 Sol → Gemini 3.1 Pro. */
export function generateTextFullRedesign(
  opts: TextGenerationOpts
): Promise<TextGenerationResult> {
  return generateTextWithFallback({
    ...opts,
    preferredProvider: undefined,
    providerChain: FULL_REDESIGN_PROVIDER_CHAIN,
    openaiModel: resolveFullRedesignOpenAiModel(opts.openaiModel),
    geminiModel: resolveFullRedesignGeminiModel(opts.geminiModel),
    anthropicModel: resolveFullRedesignClaudeModel(opts.anthropicModel),
  })
}

/** Which SDK path serves a configured endpoint. Local runtimes use the OpenAI one. */
function providerForKind(kind: ResolvedEndpoint['kind']): AiTextProvider {
  if (kind === 'anthropic') return 'anthropic'
  if (kind === 'gemini') return 'gemini'
  // 'openai' and 'openai_compatible' both speak the OpenAI wire format.
  return 'openai'
}

/**
 * Run an admin-configured chain, falling through on failure exactly as the
 * built-in chains do. Logs the provider slug, not just the vendor, so a run
 * against three different local endpoints is still readable afterwards.
 */
async function generateWithConfiguredChain(
  purpose: AiPurpose,
  endpoints: ResolvedEndpoint[],
  opts: TextGenerationOpts
): Promise<TextGenerationResult> {
  let lastErr: unknown = null
  for (let i = 0; i < endpoints.length; i++) {
    const endpoint = endpoints[i]!
    try {
      const result = await generateWithProvider(providerForKind(endpoint.kind), {
        ...opts,
        endpoint,
        maxOutputTokens: endpoint.maxOutputTokens ?? opts.maxOutputTokens,
      })
      if (i > 0) {
        console.warn(
          `[aiTextProvider] purpose=${purpose} succeeded on fallback endpoint=${endpoint.providerSlug} model=${result.model ?? '?'}`
        )
      }
      return result
    } catch (err) {
      lastErr = err
      const msg = err instanceof Error ? err.message : String(err)
      const next = endpoints[i + 1]
      console.warn(
        `[aiTextProvider] purpose=${purpose} endpoint=${endpoint.providerSlug} (${endpoint.model}) failed${next ? ` — trying ${next.providerSlug}` : ''}: ${msg.slice(0, 300)}`
      )
    }
  }
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr)
  throw new Error(
    `AI generation failed on every endpoint configured for "${purpose}": ${msg}`
  )
}

/**
 * The entry point every text call site should use.
 *
 * Runs whatever an admin assigned to this purpose; with nothing configured it
 * runs the exact chain that purpose has always used, so adopting it is not a
 * behavior change. Resolution never throws — an unreachable config database
 * degrades to the built-in chain.
 */
export async function generateTextForPurpose(
  purpose: AiPurpose,
  opts: TextGenerationOpts
): Promise<TextGenerationResult> {
  const def = AI_PURPOSES[purpose]
  if (def.category !== 'text') {
    throw new Error(`Purpose "${purpose}" is an image purpose — use the image path instead`)
  }

  const labelled = { ...opts, purposeLabel: opts.purposeLabel ?? purpose }

  const configured = await resolvePurposeChain(purpose)
  if (configured && configured.length > 0) {
    return generateWithConfiguredChain(purpose, configured, labelled)
  }

  if (def.fallback === 'full_redesign') return generateTextFullRedesign(labelled)
  if (def.fallback === 'surgical') return generateTextSurgical(labelled)
  return generateTextWithFallback(labelled)
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
