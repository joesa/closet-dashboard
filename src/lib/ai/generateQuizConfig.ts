import { GoogleGenerativeAI, type GenerationConfig } from '@google/generative-ai'

export type QuizOption = { id: string; label: string }
export type QuizQuestionConfig = { id: 'frustration' | 'style' | 'timeline'; title: string; options: QuizOption[] }
export type QuizConfig = { eyebrow: string; headline: string; questions: QuizQuestionConfig[] }

export type GenerateQuizConfigInput = {
  industry?: string | null
  business_name?: string | null
  services?: string[] | null
  other_services?: string | null
}

const OPTION_IDS = ['a', 'b', 'c', 'd']

/** Generic, industry-agnostic quiz — used when Gemini is unavailable/fails,
 *  and as the renderer's own built-in fallback for un-regenerated tenants. */
export const DEFAULT_QUIZ_CONFIG: QuizConfig = {
  eyebrow: 'Get Your Estimate',
  headline: 'Take our 3-question quiz.',
  questions: [
    {
      id: 'frustration',
      title: "What's the biggest challenge you're facing right now?",
      options: [
        { id: 'urgent', label: 'I need this handled quickly' },
        { id: 'quality', label: "I haven't found the right pro yet" },
        { id: 'budget', label: 'I want the best value for my budget' },
        { id: 'unsure', label: "I'm not sure where to start" },
      ],
    },
    {
      id: 'style',
      title: 'What matters most to you?',
      options: [
        { id: 'quality', label: 'Top-quality work' },
        { id: 'speed', label: 'Fast turnaround' },
        { id: 'value', label: 'Best value' },
        { id: 'trust', label: 'A trusted, experienced pro' },
      ],
    },
    {
      id: 'timeline',
      title: 'When are you looking to start?',
      options: [
        { id: 'asap', label: 'Immediately' },
        { id: '1month', label: 'Within 30 Days' },
        { id: '3months', label: 'Within 3 Months' },
        { id: 'exploring', label: 'Just Exploring' },
      ],
    },
  ],
}

function sanitizeOptions(raw: unknown): QuizOption[] {
  if (!Array.isArray(raw)) return []
  const out: QuizOption[] = []
  for (const item of raw) {
    const label = typeof item === 'string' ? item.trim() : ''
    if (!label || label.length > 60) continue
    out.push({ id: OPTION_IDS[out.length] ?? `opt${out.length}`, label })
    if (out.length >= 4) break
  }
  return out
}

/**
 * Generates the 3-question lead-capture quiz shown on the marketing site,
 * tailored to the business's actual industry/services instead of the
 * generic (or previously hardcoded closet-specific) copy. Keeps the same 3
 * fixed question ids (frustration/style/timeline) the renderer and quote
 * widget already expect — only the wording/options are industry-specific —
 * so no downstream consumer needs to change shape.
 */
export async function generateQuizConfig(
  input: GenerateQuizConfigInput,
  opts?: { useGemini?: boolean }
): Promise<{ config: QuizConfig; source: 'gemini' | 'fallback' }> {
  const useGemini = opts?.useGemini !== false && !!process.env.GEMINI_API_KEY
  const industry = (input.industry || '').trim()
  const services = (input.services ?? []).filter((s) => s && s.trim().length > 0)
  const other = (input.other_services || '').trim()

  if (!useGemini || (!industry && services.length === 0 && !other)) {
    return { config: DEFAULT_QUIZ_CONFIG, source: 'fallback' }
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.5,
      maxOutputTokens: 1024,
      thinkingConfig: { thinkingBudget: 0 },
    } as GenerationConfig,
  })

  const prompt = `A contractor's marketing website has a short "3-question quiz" widget that qualifies a visitor before they request a quote. Write industry-specific copy for it — a prospect in THIS exact trade should recognize every option as something they'd actually pick (avoid generic filler, and never reuse closet/storage-organization wording unless the trade genuinely is that).

Return JSON only, no markdown, with this EXACT shape:
{
  "eyebrow": string,          // 2-4 word label above the quiz heading, e.g. "Get Your Estimate"
  "headline": string,         // short heading, e.g. "Take our 3-question quiz."
  "questions": [
    { "id": "frustration", "title": string, "options": string[] },  // biggest pain point / problem they're facing
    { "id": "style",       "title": string, "options": string[] },  // what they value most / desired outcome or style
    { "id": "timeline",    "title": string, "options": string[] }   // when they want to start (keep close to: Immediately / Within 30 Days / Within 3 Months / Just Exploring)
  ]
}
Each "options" array must have exactly 4 short (2-6 word) answer choices.

Industry: ${industry || '(not specified)'}
Services offered: ${services.length > 0 ? services.join(', ') : '(not specified)'}
${other ? `Other/custom services: ${other}\n` : ''}${input.business_name ? `Business name: ${input.business_name}\n` : ''}`

  try {
    const result = await model.generateContent(prompt)
    const parsed = JSON.parse(result.response.text()) as {
      eyebrow?: unknown
      headline?: unknown
      questions?: unknown
    }

    const eyebrow =
      typeof parsed.eyebrow === 'string' && parsed.eyebrow.trim() ? parsed.eyebrow.trim().slice(0, 40) : DEFAULT_QUIZ_CONFIG.eyebrow
    const headline =
      typeof parsed.headline === 'string' && parsed.headline.trim() ? parsed.headline.trim().slice(0, 80) : DEFAULT_QUIZ_CONFIG.headline

    const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : []
    const byId = new Map<string, { title?: unknown; options?: unknown }>()
    for (const q of rawQuestions) {
      if (q && typeof q === 'object' && typeof (q as { id?: unknown }).id === 'string') {
        byId.set((q as { id: string }).id, q as { title?: unknown; options?: unknown })
      }
    }

    const questions: QuizQuestionConfig[] = (['frustration', 'style', 'timeline'] as const).map((id, i) => {
      const raw = byId.get(id)
      const title = typeof raw?.title === 'string' && raw.title.trim() ? raw.title.trim().slice(0, 100) : DEFAULT_QUIZ_CONFIG.questions[i].title
      const options = sanitizeOptions(raw?.options)
      return {
        id,
        title,
        options: options.length >= 2 ? options : DEFAULT_QUIZ_CONFIG.questions[i].options,
      }
    })

    return { config: { eyebrow, headline, questions }, source: 'gemini' }
  } catch {
    return { config: DEFAULT_QUIZ_CONFIG, source: 'fallback' }
  }
}
