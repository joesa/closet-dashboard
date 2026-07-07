import { NextResponse } from 'next/server'
import { generateTextWithFallback } from '@/lib/ai/aiTextProvider'
import { getCurrentAdmin } from '@/lib/admin'

export const maxDuration = 30
export const runtime = 'nodejs'

const COPY_SCHEMA = {
  type: 'object',
  properties: {
    heroHeadline: {
      type: 'string',
      description:
        'A punchy, high-converting H1 headline (6–12 words). Lead with the core benefit or transformation. Use the business name or niche when it strengthens the hook. No quotes.',
    },
    heroSubheadline: {
      type: 'string',
      description:
        'One supporting sentence (12–22 words) that sits under the headline. Add concrete substance — what is delivered, for whom, and a real proof point or differentiator from the brief (years in business, area served, materials, guarantee). No filler, do not repeat the headline.',
    },
    aboutDescription: {
      type: 'string',
      description:
        'A compelling 2–3 sentence About Us story. Open with who they are and who they serve, weave in top differentiators from the brief, and end with a subtle trust cue or call-to-action. Match the requested tone of voice.',
    },
    businessName: {
      type: 'string',
      description: 'Business name if clearly stated or inferable from the brief; otherwise empty string.',
    },
    theme: {
      type: 'string',
      enum: [
        'luxury-minimal',
        'brutalist',
        'classic-warm',
        'modern-office',
        'playful-kids',
        'rustic-pantry',
        'sleek-entertainment',
        'elegant-dressing',
        'functional-utility',
        'creative-craft',
        'sophisticated-wine',
        'cozy-library',
        'minimalist-zen',
      ],
      description: 'Best-fit visual theme slug from the brief vibe/look-and-feel.',
    },
    layoutStyle: {
      type: 'string',
      enum: [
        'standard',
        'portfolio-first',
        'conversion-focus',
        'storyteller',
        'minimalist-lead',
        'visual-impact',
      ],
      description: 'Best structural layout from the primary call-to-action / business goals.',
    },
  },
  required: ['heroHeadline', 'aboutDescription'],
}

function extractJson(text: string): string {
  let t = text.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) t = fence[1].trim()
  const firstObj = t.indexOf('{')
  const lastObj = t.lastIndexOf('}')
  if (firstObj !== -1 && lastObj > firstObj) return t.slice(firstObj, lastObj + 1)
  return t
}

function sanitizeJsonString(json: string): string {
  let insideString = false
  let escaped = false
  let result = ''
  for (let i = 0; i < json.length; i++) {
    const char = json[i]
    if (char === '"' && !escaped) {
      insideString = !insideString
      result += char
    } else if (char === '\\' && insideString && !escaped) {
      escaped = true
      result += char
    } else {
      if (insideString) {
        if (char === '\n') {
          result += '\\n'
        } else if (char === '\r') {
          result += '\\r'
        } else if (char === '\t') {
          result += '\\t'
        } else if (char.charCodeAt(0) < 32) {
          result += '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0')
        } else {
          result += char
        }
      } else {
        result += char
      }
      escaped = false
    }
  }
  return result
}

export async function POST(req: Request) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { input } = await req.json()
    if (!input || typeof input !== 'string' || !input.trim()) {
      return NextResponse.json({ error: 'Input is required' }, { status: 400 })
    }

    const systemPrompt = `You are an elite direct-response copywriter for local service businesses and contractors across any trade (e.g. plumbing, towing, HVAC, electrical, landscaping, custom closets & storage). Infer the specific trade from the business brief.`

    const prompt = `Read the business brief below and write website copy that SELLS — specific to this business, not generic filler.

RULES:
- Hero headline: benefit-first, confident, memorable. Reference their niche or location when it adds punch.
- Hero subheadline: one supporting sentence with a concrete proof point or differentiator from the brief; never repeat the headline.
- About story: warm but professional; name the business; mention services and 1–2 differentiators from the brief.
- Match the tone they asked for (e.g. playful, luxury, bold).
- Never mention "Apex Garage" or unrelated placeholder brands.
- If a business name is in the brief, use it exactly.

Return ONLY valid JSON matching this schema:
${JSON.stringify(COPY_SCHEMA, null, 2)}

User brief:
${input.trim()}`

    const { text: rawText } = await generateTextWithFallback({
      prompt,
      systemPrompt,
      jsonMode: true,
      temperature: 0.75,
      maxOutputTokens: 2048,
    })

    if (!rawText.trim()) {
      throw new Error('AI returned no copy')
    }

    const data = JSON.parse(sanitizeJsonString(extractJson(rawText)))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('AI generate-copy error:', error)
    const message = error instanceof Error ? error.message : 'Copy generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
