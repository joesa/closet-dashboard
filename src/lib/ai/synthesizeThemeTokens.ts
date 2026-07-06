import { GoogleGenerativeAI, type GenerationConfig } from '@google/generative-ai'
import {
  SURFACE_TOKENS,
  SHAPE_TOKENS,
  VOICE_TOKENS,
  SWATCH_TOKENS,
  SURFACE_IDS,
  SHAPE_IDS,
  VOICE_IDS,
  SWATCH_IDS,
  type ThemeTokenSelection,
} from '@/lib/catalog/themeTokenPools'

export type { ThemeTokenSelection }

export type SynthesizeThemeTokensInput = {
  industry?: string | null
  business_name?: string | null
  services?: string[] | null
  other_services?: string | null
  vibe?: string | null
  tone?: string | null
  differentiators?: string[] | null
  primary_color_hex?: string | null
}

export type SynthesizeThemeTokensResult = {
  tokens: ThemeTokenSelection
  source: 'gemini' | 'fallback'
}

function hashSeedString(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** Deterministic, seed-stable pick — same business always gets the same look. */
function deterministicFallback(input: SynthesizeThemeTokensInput): ThemeTokenSelection {
  const seed = (input.business_name || input.industry || 'default').trim() || 'default'
  return {
    surface: SURFACE_IDS[hashSeedString(`${seed}:surface`) % SURFACE_IDS.length],
    shape: SHAPE_IDS[hashSeedString(`${seed}:shape`) % SHAPE_IDS.length],
    voice: VOICE_IDS[hashSeedString(`${seed}:voice`) % VOICE_IDS.length],
    swatch: SWATCH_IDS[hashSeedString(`${seed}:swatch`) % SWATCH_IDS.length],
  }
}

/**
 * Synthesizes a bespoke theme token selection for a business whose
 * industry/services don't confidently fit any curated theme in the catalog
 * (see isLowConfidenceResolution in serviceCatalog.ts). Gemini only ever picks
 * an ID from each curated, pre-authored pool (never freeform CSS/hex) — the
 * pools are rendered into literal Tailwind classes solely in
 * custom-closets-websites/src/lib/theme.ts.
 */
export async function synthesizeThemeTokens(
  input: SynthesizeThemeTokensInput,
  opts?: { useGemini?: boolean }
): Promise<SynthesizeThemeTokensResult> {
  const fallback = deterministicFallback(input)
  const useGemini = opts?.useGemini !== false && !!process.env.GEMINI_API_KEY
  if (!useGemini) return { tokens: fallback, source: 'fallback' }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.6,
      maxOutputTokens: 512,
    } as GenerationConfig,
  })

  const prompt = `Design a bespoke marketing website "look" for a contractor business by picking exactly one option from each curated list below. Return JSON only: { "surface": string, "shape": string, "voice": string, "swatch": string }

SURFACE (background mood) — pick one id:
${SURFACE_TOKENS.map((t) => `- ${t.id}: ${t.description}`).join('\n')}

SHAPE (button/card/container style) — pick one id:
${SHAPE_TOKENS.map((t) => `- ${t.id}: ${t.description}`).join('\n')}

VOICE (typography personality) — pick one id:
${VOICE_TOKENS.map((t) => `- ${t.id}: ${t.description}`).join('\n')}

SWATCH (accent color) — pick one id:
${SWATCH_TOKENS.map((t) => `- ${t.id}: ${t.description}`).join('\n')}

Business: ${input.business_name || 'Unknown'}
Industry: ${input.industry || 'Unknown'}
Services: ${(input.services || []).join(', ') || 'Unknown'}${input.other_services?.trim() ? `, ${input.other_services.trim()}` : ''}
Vibe: ${input.vibe || 'not specified'}
Tone: ${input.tone || 'not specified'}
Differentiators: ${(input.differentiators || []).join(', ') || 'none stated'}
${input.primary_color_hex ? `Preferred brand color (nudge swatch toward the closest match): ${input.primary_color_hex}` : ''}

Pick values that feel authentic and trustworthy for this specific trade — avoid generic default combos.`

  try {
    const result = await model.generateContent(prompt)
    const raw = result.response.text()
    const parsed = JSON.parse(raw) as Partial<ThemeTokenSelection>
    return {
      tokens: {
        surface: parsed.surface && SURFACE_IDS.includes(parsed.surface) ? parsed.surface : fallback.surface,
        shape: parsed.shape && SHAPE_IDS.includes(parsed.shape) ? parsed.shape : fallback.shape,
        voice: parsed.voice && VOICE_IDS.includes(parsed.voice) ? parsed.voice : fallback.voice,
        swatch: parsed.swatch && SWATCH_IDS.includes(parsed.swatch) ? parsed.swatch : fallback.swatch,
      },
      source: 'gemini',
    }
  } catch {
    return { tokens: fallback, source: 'fallback' }
  }
}
