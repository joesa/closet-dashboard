import { GoogleGenerativeAI, type GenerationConfig } from '@google/generative-ai'
import Anthropic from '@anthropic-ai/sdk'

/**
 * Shared text-generation provider.
 *
 * Intake site content, Surgical Edit, and Full redesign prefer Claude Sonnet 5
 * when ANTHROPIC_API_KEY is set (Fable 5 is opt-in via CUSTOM_SITE_CLAUDE_MODEL
 * — often too slow for one-shot site JSON). Gemini remains the fallback.
 *
 * Server-only — never import in client components.
 */

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
   * silently falling back to Gemini otherwise. Default is Gemini.
   */
  preferredProvider?: 'anthropic' | 'gemini'
  /**
   * Override Claude model id. Defaults to CUSTOM_SITE_CLAUDE_MODEL or
   * claude-sonnet-5 (fast enough for Full redesign inside Vercel limits).
   */
  anthropicModel?: string
}

export type TextGenerationResult = {
  text: string
  provider: 'openai' | 'gemini' | 'anthropic'
  model?: string
}

/** Fast production default — finishes Full redesign inside the 5m budget. */
export const CLAUDE_SONNET_MODEL = 'claude-sonnet-5'
/** Slower frontier model — deep craft, often too slow for one-shot site JSON. */
export const CLAUDE_FABLE_MODEL = 'claude-fable-5'

/**
 * Abort Claude before Vercel's hard 300s kill so callers can persist a failed
 * job. Leave ~30s for JSON parse + DB writes after the model returns.
 */
const CLAUDE_ABORT_MS = 270_000

export function resolveClaudeModel(override?: string): string {
  const fromOpts = override?.trim()
  if (fromOpts) return fromOpts
  const fromEnv = process.env.CUSTOM_SITE_CLAUDE_MODEL?.trim()
  if (fromEnv) return fromEnv
  return CLAUDE_SONNET_MODEL
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
  const stream = client.messages.stream(
    {
      model,
      max_tokens: Math.max(opts.maxOutputTokens ?? 8192, 8192),
      system: opts.systemPrompt,
      messages: [{ role: 'user', content }],
    },
    { signal: AbortSignal.timeout(CLAUDE_ABORT_MS) }
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
    return { text, model }
  } catch (err) {
    const name = err instanceof Error ? err.name : ''
    const msg = err instanceof Error ? err.message : String(err)
    if (name === 'AbortError' || /aborted|timeout/i.test(msg)) {
      throw new Error(
        `Full redesign timed out after ~4.5 minutes on ${model} (still generating). Try again, use a shorter brief, or set CUSTOM_SITE_CLAUDE_MODEL=claude-sonnet-5.`
      )
    }
    throw err
  }
}

async function generateWithGemini(opts: TextGenerationOpts): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY for text generation')
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const generationConfig: Record<string, unknown> = {
    temperature: opts.temperature ?? 0.5,
    maxOutputTokens: opts.maxOutputTokens ?? 2048,
  }
  if (opts.jsonMode) {
    generationConfig.responseMimeType = 'application/json'
  }

  const model = genAI.getGenerativeModel({
    model: 'gemini-pro-latest',
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
  return text.trim()
}

/**
 * Generate text content. Routes to Claude when the caller prefers Anthropic
 * and a key is configured; otherwise Gemini.
 */
export async function generateTextWithFallback(
  opts: TextGenerationOpts
): Promise<TextGenerationResult> {
  if (opts.preferredProvider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
    const { text, model } = await generateWithClaude(opts)
    return { text, provider: 'anthropic', model }
  }

  if (process.env.GEMINI_API_KEY) {
    const text = await generateWithGemini(opts)
    return { text, provider: 'gemini', model: 'gemini-pro-latest' }
  }

  throw new Error('Missing GEMINI_API_KEY — cannot generate text')
}
