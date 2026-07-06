import { GoogleGenerativeAI, type GenerationConfig } from '@google/generative-ai'

export type SuggestIdealCustomersInput = {
  industry?: string | null
  business_name?: string | null
  services?: string[] | null
  other_services?: string | null
  differentiators?: string[] | null
}

export type SuggestIdealCustomersResult = {
  options: string[]
  source: 'default' | 'gemini'
}

/** Static fallback — used when Gemini is unavailable, fails, or input is too sparse. */
export const DEFAULT_CUSTOMER_OPTIONS = [
  'Luxury homeowners',
  'Busy families',
  'Budget-conscious homeowners',
  'Builders & commercial clients',
  'A mix of everyone',
]

const CATCH_ALL_OPTION = 'A mix of everyone'
const MAX_OPTIONS = 6

function sanitizeOptions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const cleaned = raw
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter((v) => v.length > 0 && v.length <= 60)

  const seen = new Set<string>()
  const out: string[] = []
  for (const v of cleaned) {
    const key = v.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(v)
  }
  return out.slice(0, MAX_OPTIONS)
}

/**
 * Suggests "ideal customer" dropdown options tailored to the prospect's
 * industry + services, via Gemini. Falls back to a generic static list when
 * Gemini is disabled/unavailable, the response is malformed, or there isn't
 * enough industry/service context to generate something meaningfully better.
 */
export async function suggestIdealCustomers(
  input: SuggestIdealCustomersInput,
  opts?: { useGemini?: boolean }
): Promise<SuggestIdealCustomersResult> {
  const useGemini = opts?.useGemini !== false && !!process.env.GEMINI_API_KEY
  if (!useGemini) return { options: DEFAULT_CUSTOMER_OPTIONS, source: 'default' }

  const services = (input.services ?? []).filter((s) => s && s.trim().length > 0)
  const industry = (input.industry || '').trim()
  const other = (input.other_services || '').trim()

  if (!industry && services.length === 0 && !other) {
    console.log("suggestIdealCustomers: Early return because no industry or services provided.");
    return { options: DEFAULT_CUSTOMER_OPTIONS, source: 'default' }
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 1024,
    } as GenerationConfig,
  })

  const prompt = `A contractor is filling out a form to build their marketing website and must choose their "ideal customer" from a dropdown menu.
Based on their industry and services, suggest 4-5 short, specific ideal-customer segment labels (2-5 words each) that someone in this exact trade would actually recognize and pick from. Avoid generic filler — tailor to the trade (e.g. a towing company's segments differ completely from a custom closet company's).
Always include one broad catch-all option worded close to "A mix of everyone".
Return JSON only, no markdown: { "options": string[] }

Industry: ${industry || '(not specified)'}
Services offered: ${services.length > 0 ? services.join(', ') : '(not specified)'}
${other ? `Other/custom services: ${other}\n` : ''}${input.business_name ? `Business name: ${input.business_name}\n` : ''}${input.differentiators?.length ? `Differentiators: ${input.differentiators.join(', ')}\n` : ''}`

  try {
    const result = await model.generateContent(prompt)
    const rawText = result.response.text()
    console.log("suggestIdealCustomers: Raw text returned by Gemini:", JSON.stringify(rawText))
    const text = rawText.replace(/```json/gi, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(text) as { options?: unknown }
    const options = sanitizeOptions(parsed.options)
    console.log("suggestIdealCustomers: parsed options length:", options.length);
    if (options.length < 3) return { options: DEFAULT_CUSTOMER_OPTIONS, source: 'default' }
    if (!options.some((o) => o.toLowerCase().includes('mix'))) options.push(CATCH_ALL_OPTION)
    return { options, source: 'gemini' }
  } catch (err) {
    console.error("suggestIdealCustomers AI Error:", err)
    return { options: DEFAULT_CUSTOMER_OPTIONS, source: 'default' }
  }
}
