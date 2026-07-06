import { GoogleGenerativeAI, type GenerationConfig } from '@google/generative-ai'
import { THEME_SLUGS, LAYOUT_SLUGS } from '@/lib/catalog/sitePresentationCatalog'
import type { CustomIndustryRecord, CustomIndustryService } from '@/lib/catalog/customIndustries'
import type { BeforeAfterCategory } from '@/lib/openai-images'
import type { EngagementModel } from '@/lib/catalog/types'

const VALID_CATEGORIES: BeforeAfterCategory[] = ['vehicle', 'exterior', 'fixture', 'pet', 'interior-space', 'not-applicable']
const VALID_ENGAGEMENT_MODELS: EngagementModel[] = ['quote', 'order', 'booking', 'ticket']

export type GenerateCustomIndustryInput = {
  industryText: string
  businessName?: string | null
  otherServices?: string | null
}

export type GenerateCustomIndustryResult = {
  def: Omit<CustomIndustryRecord, 'slug'>
  source: 'gemini' | 'fallback'
}

/** Generic, always-safe fallback used when Gemini is unavailable or fails. */
function fallbackDef(industryText: string): Omit<CustomIndustryRecord, 'slug'> {
  const label = industryText.trim().replace(/\s+/g, ' ').slice(0, 80) || 'Custom Trade'
  return {
    label,
    keywords: [label.toLowerCase()],
    services: [
      { label: `${label} Service`, keywords: [label.toLowerCase()], widgetCategory: `${label} Service` },
    ],
    defaultThemes: ['luxury-minimal', 'modern-office', 'functional-utility', 'classic-warm'],
    defaultLayouts: ['standard', 'trust-builder', 'conversion-focus'],
    // With zero real signal about this business (Gemini unavailable/failed),
    // 'not-applicable' is the safer default — skip before/after entirely
    // rather than guess a generic room scene that may not fit at all. See
    // openai-images.ts's INDUSTRY_BEFORE_AFTER_CATEGORY docstring.
    beforeAfterCategory: 'not-applicable',
    // 'quote' is the safe default — the vast majority of trades (project-
    // based, price varies per job) fit a quote calculator; only genuine
    // direct-purchase menu/catalog businesses need 'order'.
    engagementModel: 'quote',
  }
}

/**
 * Generates a lightweight industry definition for a trade that isn't in the
 * static catalog (src/lib/catalog/industries/*.ts), via Gemini: a handful of
 * services, matching keywords, a starting theme/layout pool (constrained to
 * the REAL catalog pools so the renderer can always render it), and a
 * REQUIRED before/after image subject category. The category is required in
 * the prompt/schema and validated against the 5 real categories after
 * parsing — this is what guarantees a brand-new, contractor-typed industry
 * can never end up in the same "no category assigned" state that caused the
 * pet-services before/after image bug (see repo notes).
 */
export async function generateCustomIndustry(
  input: GenerateCustomIndustryInput,
  opts?: { useGemini?: boolean }
): Promise<GenerateCustomIndustryResult> {
  const industryText = input.industryText.trim()
  const fallback = fallbackDef(industryText)
  const useGemini = opts?.useGemini !== false && !!process.env.GEMINI_API_KEY
  if (!industryText || !useGemini) return { def: fallback, source: 'fallback' }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.4,
      maxOutputTokens: 1024,
    } as GenerationConfig,
  })

  const prompt = `A contractor is signing up for a website + instant-quote-widget builder and typed an industry/trade that isn't in our catalog yet. Generate a starting definition for this NEW industry so the product can support it well immediately, and so other contractors in the same trade can reuse it later.

Return JSON only, no markdown, with this EXACT shape:
{
  "label": string,                    // clean display name, e.g. "Mobile Dog Grooming"
  "keywords": string[],                // 3-6 short alternate phrasings/synonyms someone might type for this trade (avoid single generic English words like "clean" or "paint" that could match unrelated trades)
  "services": [                        // 4-8 specific, real services this trade actually sells
    { "label": string, "keywords": string[], "widgetCategory": string, "description": string }
  ],
  "defaultThemes": string[],           // pick 3-4 IDs ONLY from this exact list: ${THEME_SLUGS.join(', ')}
  "defaultLayouts": string[],          // pick 2-4 IDs ONLY from this exact list: ${LAYOUT_SLUGS.join(', ')}
  "beforeAfterCategory": string,       // REQUIRED. Pick EXACTLY ONE of: "vehicle" | "exterior" | "fixture" | "pet" | "interior-space" | "not-applicable"
  "engagementModel": string             // REQUIRED. Pick EXACTLY ONE of: "quote" | "order" | "booking" | "ticket"
}

engagementModel guide:
- "order": pick ONLY if a customer of this business would browse a menu/catalog of individually-priced items and place a direct order (e.g. a restaurant, cafe, bakery, walk-up food/retail seller).
- "booking": pick ONLY if the core business is scheduling a fixed time slot for a person (e.g. dental, medical, salon, massage, therapy, consulting, classes, personal training, tutoring).
- "ticket": pick ONLY if the business sells tickets to a specific event, venue, or attraction (e.g. museum, theater, concert, amusement park, tours).
- "quote": pick for EVERY OTHER case — any project-based or service-based trade where price varies per job and a human still scopes/estimates it (e.g. contractors, landscapers, cleaners, towing, mechanics). This is the correct choice for the vast majority of trades.

beforeAfterCategory guide (this drives an image-editing prompt that must depict the SAME physical subject in a worse-off "before" state vs. the finished "after" photo — pick whichever matches what a customer of this business would actually show off in a before/after photo):
- "vehicle": the business's own before/after subject is a car/truck/van/boat/motorcycle (detailing, wraps, towing, transport).
- "exterior": the subject is the outside of a property/yard/structure (landscaping, roofing, pest control, exterior lighting).
- "fixture": the subject is a specific installed object/equipment/surface (plumbing fixture, HVAC unit, countertop, flooring, cabinetry, electrical panel).
- "pet": the subject is a live animal (grooming, pet care).
- "interior-space": the subject is a whole room/interior space that gets physically transformed (remodeling, cleaning, moving, storage, event/venue staging).
- "not-applicable": pick this whenever there is NO physical object/space the business itself transforms from worse to better — direct-purchase/order businesses (restaurants, cafes, retail), pure professional/knowledge services (legal, financial, consulting, IT, research, insurance, real estate), ticketed or booking businesses (hotels, tours, museums, theaters, amusement parks), or any service centered on a PERSON's body/face (fitness, personal training, massage, medical, therapy) where an actual before/after would mean showing a real person looking "worse" — never do that. When in doubt between "interior-space" and "not-applicable", ask: would this business's own customers ever see/expect a "before vs after" photo at all? If not, use "not-applicable".

Trade/industry as typed by the contractor: "${industryText}"
${input.businessName ? `Business name: ${input.businessName}\n` : ''}${input.otherServices ? `Services they already described: ${input.otherServices}\n` : ''}`

  try {
    const result = await model.generateContent(prompt)
    const parsed = JSON.parse(result.response.text()) as {
      label?: unknown
      keywords?: unknown
      services?: unknown
      defaultThemes?: unknown
      defaultLayouts?: unknown
      beforeAfterCategory?: unknown
      engagementModel?: unknown
    }

    const label =
      typeof parsed.label === 'string' && parsed.label.trim() ? parsed.label.trim().slice(0, 80) : fallback.label

    const keywords = Array.isArray(parsed.keywords)
      ? parsed.keywords.filter((k): k is string => typeof k === 'string' && k.trim().length > 0).map((k) => k.trim())
      : fallback.keywords

    const services: CustomIndustryService[] = Array.isArray(parsed.services)
      ? parsed.services
          .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
          .map((s) => ({
            label: typeof s.label === 'string' ? s.label.trim() : '',
            keywords: Array.isArray(s.keywords)
              ? s.keywords.filter((k): k is string => typeof k === 'string')
              : [],
            widgetCategory:
              typeof s.widgetCategory === 'string' && s.widgetCategory.trim()
                ? s.widgetCategory.trim()
                : typeof s.label === 'string'
                  ? s.label.trim()
                  : '',
            description: typeof s.description === 'string' ? s.description.trim() : undefined,
          }))
          .filter((s) => s.label.length > 0)
      : []

    const themes = Array.isArray(parsed.defaultThemes)
      ? parsed.defaultThemes.filter(
          (t): t is (typeof THEME_SLUGS)[number] => typeof t === 'string' && (THEME_SLUGS as readonly string[]).includes(t)
        )
      : []
    const layouts = Array.isArray(parsed.defaultLayouts)
      ? parsed.defaultLayouts.filter(
          (l): l is (typeof LAYOUT_SLUGS)[number] => typeof l === 'string' && (LAYOUT_SLUGS as readonly string[]).includes(l)
        )
      : []

    // beforeAfterCategory is REQUIRED by the prompt/schema above; validate
    // the actual value anyway (never trust an LLM's output blindly) and fall
    // back to the safe generic default if it's missing or invalid — this is
    // the runtime guarantee that mirrors the compile-time exhaustiveness
    // check for the static catalog: a category ALWAYS ends up assigned.
    const beforeAfterCategory: BeforeAfterCategory = VALID_CATEGORIES.includes(
      parsed.beforeAfterCategory as BeforeAfterCategory
    )
      ? (parsed.beforeAfterCategory as BeforeAfterCategory)
      : 'not-applicable'

    // Same belt-and-suspenders validation for engagementModel — required by
    // the prompt/schema, but never trust the LLM's output blindly. Falls
    // back to 'quote' (the safe default) if missing/invalid.
    const engagementModel: EngagementModel = VALID_ENGAGEMENT_MODELS.includes(
      parsed.engagementModel as EngagementModel
    )
      ? (parsed.engagementModel as EngagementModel)
      : 'quote'

    if (services.length === 0) return { def: fallback, source: 'fallback' }

    return {
      def: {
        label,
        keywords: keywords.length > 0 ? keywords : fallback.keywords,
        services,
        defaultThemes: themes.length > 0 ? themes : fallback.defaultThemes,
        defaultLayouts: layouts.length > 0 ? layouts : fallback.defaultLayouts,
        beforeAfterCategory,
        engagementModel,
      },
      source: 'gemini',
    }
  } catch {
    return { def: fallback, source: 'fallback' }
  }
}
