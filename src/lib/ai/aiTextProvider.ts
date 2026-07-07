import { GoogleGenerativeAI, type GenerationConfig } from '@google/generative-ai'

/**
 * Shared text-generation provider that uses Gemini 3.5 Flash for all content.
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
  /** Sampling temperature (default 0.5). */
  temperature?: number
  /** Maximum output tokens (default 2048). */
  maxOutputTokens?: number
}

export type TextGenerationResult = {
  text: string
  provider: 'openai' | 'gemini'
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

  const result = await model.generateContent(fullPrompt)

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
 * Generate text content using Gemini 3.5 Flash.
 */
export async function generateTextWithFallback(
  opts: TextGenerationOpts
): Promise<TextGenerationResult> {
  if (process.env.GEMINI_API_KEY) {
    const text = await generateWithGemini(opts)
    return { text, provider: 'gemini' }
  }

  throw new Error('Missing GEMINI_API_KEY — cannot generate text')
}
