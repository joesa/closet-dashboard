import * as cheerio from 'cheerio'
import { GoogleGenerativeAI, type GenerationConfig } from '@google/generative-ai'
import { LAYOUT_SLUGS, THEME_SLUGS } from '@/lib/catalog/sitePresentationCatalog'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export const GENERATE_SITE_JSON_SCHEMA = {
  name: 'generate_site_config',
  description:
    'Generates a highly tailored website and quote calculator configuration based on business description.',
  parameters: {
    type: 'object',
    properties: {
      siteConfig: {
        type: 'object',
        properties: {
          theme: {
            type: 'string',
            enum: [...THEME_SLUGS],
          },
          layoutStyle: {
            type: 'string',
            enum: [...LAYOUT_SLUGS],
          },
          defaultRoom: { type: 'string' },
          hero: {
            type: 'object',
            properties: {
              headline: { type: 'string' },
              backgroundImage: { type: 'string' },
              imagePrompt: { type: 'string' },
            },
            required: ['headline', 'imagePrompt'],
          },
          about: {
            type: 'object',
            properties: { description: { type: 'string' } },
            required: ['description'],
          },
          process: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              subtitle: { type: 'string' },
              steps: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    number: { type: 'string' },
                    title: { type: 'string' },
                    description: { type: 'string' },
                  },
                  required: ['number', 'title', 'description'],
                },
              },
            },
            required: ['title', 'subtitle', 'steps'],
          },
          products: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                imagePrompt: { type: 'string' },
                details: {
                  type: 'object',
                  properties: {
                    subtitle: { type: 'string' },
                    longDescription: { type: 'string' },
                    specifications: { type: 'array', items: { type: 'string' } },
                  },
                  required: ['subtitle', 'longDescription', 'specifications'],
                },
              },
              required: ['title', 'description', 'imagePrompt', 'details'],
            },
          },
        },
        required: ['theme', 'layoutStyle', 'defaultRoom', 'hero', 'about', 'process', 'products'],
      },
      widgetConfig: {
        type: 'object',
        properties: {
          customRooms: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                basic: { type: 'number' },
                standard: { type: 'number' },
                premium: { type: 'number' },
              },
              required: ['name', 'basic', 'standard', 'premium'],
            },
          },
          customAddOns: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                roomType: { type: 'string' },
                price: { type: 'number' },
              },
              required: ['name', 'roomType', 'price'],
            },
          },
          customFinishes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                description: { type: 'string' },
                swatchHex: { type: 'string' },
                tier: { type: 'string', enum: ['basic', 'standard', 'premium'] },
              },
              required: ['label', 'description', 'swatchHex', 'tier'],
            },
          },
        },
        required: ['customRooms', 'customAddOns', 'customFinishes'],
      },
      pagesConfig: { type: 'array', items: { type: 'object' } },
      upsellPitch: { type: 'string' },
    },
    required: ['siteConfig', 'widgetConfig', 'upsellPitch'],
  },
}

function extractTextFromHtml(html: string): string {
  const $ = cheerio.load(html)
  $('script, style, nav, footer, header, noscript, svg, img').remove()
  let text = $('body').text()
  text = text.replace(/\s+/g, ' ').trim()
  return text.substring(0, 15000)
}

export function extractJson(text: string): string {
  let t = text.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) t = fence[1].trim()
  const firstObj = t.indexOf('{')
  const lastObj = t.lastIndexOf('}')
  if (firstObj !== -1 && lastObj > firstObj) {
    return t.slice(firstObj, lastObj + 1)
  }
  return t
}

function describeFromUrl(rawUrl: string): string {
  let hint = rawUrl
  try {
    const host = new URL(rawUrl).hostname.replace(/^www\./, '')
    const words = host.split('.')[0].replace(/[-_]+/g, ' ').trim()
    hint = `${words} (${host})`
  } catch {
    /* keep */
  }
  return `Business website: ${rawUrl}. The site could not be read automatically. Infer a plausible custom closets / home storage business from "${hint}".`
}

export type GenerateSiteConfigResult = {
  data: Record<string, unknown>
  source: 'text' | 'url' | 'url-fallback'
  scraped: boolean
}

export async function generateSiteConfigFromInput(
  input: string,
  sitemap?: string[] | null
): Promise<GenerateSiteConfigResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured')
  }

  let scrapedText = input
  let isUrl = false
  try {
    const parsedUrl = new URL(input)
    if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
      isUrl = true
    }
  } catch {
    /* text */
  }

  let scrapeOk = false
  if (isUrl) {
    try {
      const response = await fetch(input, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      })
      if (response.ok) {
        const text = extractTextFromHtml(await response.text())
        if (text.trim().length > 0) {
          scrapedText = text
          scrapeOk = true
        }
      }
    } catch {
      /* fallback */
    }
    if (!scrapeOk) scrapedText = describeFromUrl(input)
  }

  let systemPrompt = `You are an elite Luxury Brand Copywriter, Visual Art Director, and Next.js Frontend Architect.
Generate a complete website and quote calculator configuration. Avoid generic AI tropes.

CRITICAL INSTRUCTIONS FOR QUOTE CALCULATOR:
Replace default closet rooms with ACTUAL services when appropriate.
customFinishes = service tiers when not a materials business.
defaultRoom = primary service type for the quote CTA.

CRITICAL INSTRUCTIONS FOR IMAGE PROMPTS:
- hero.imagePrompt: wide-angle cinematic ARCHITECTURAL photograph, photorealistic, 16:9, no text, no people.
- products[].imagePrompt: TIGHT MACRO close-ups, never reuse hero angle, photorealistic, 16:9, no text, no people.
Match products to the services listed in the business information.`

  if (sitemap && sitemap.length > 1) {
    systemPrompt += `\n\nMULTI-PAGE sitemap: ${JSON.stringify(sitemap)}. Generate pagesConfig for each non-Home page.`
  }

  systemPrompt += `\n\nOUTPUT: valid JSON only:\n${JSON.stringify(GENERATE_SITE_JSON_SCHEMA.parameters, null, 2)}`

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.7,
      maxOutputTokens: 32768,
      thinkingConfig: { thinkingBudget: 0 },
    } as GenerationConfig,
  })

  const result_ai = await model.generateContent(
    `System: ${systemPrompt}\n\nUser: Business Information:\n\n${scrapedText}`
  )

  const candidate = result_ai.response?.candidates?.[0]
  const finishReason = candidate?.finishReason
  let rawText = ''
  try {
    rawText = result_ai.response.text()
  } catch {
    rawText =
      candidate?.content?.parts?.map((p) => ('text' in p ? p.text : '')).join('') ?? ''
  }

  if (!rawText.trim()) {
    throw new Error(
      `AI returned no content${finishReason ? ` (${finishReason})` : ''}`
    )
  }

  let aiData: Record<string, unknown>
  try {
    aiData = JSON.parse(extractJson(rawText)) as Record<string, unknown>
  } catch {
    throw new Error(
      finishReason === 'MAX_TOKENS'
        ? 'AI response truncated — try a shorter description.'
        : 'AI did not return valid JSON.'
    )
  }

  return {
    data: aiData,
    source: isUrl ? (scrapeOk ? 'url' : 'url-fallback') : 'text',
    scraped: scrapeOk,
  }
}
