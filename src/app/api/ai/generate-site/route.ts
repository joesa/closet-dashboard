import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { GoogleGenerativeAI, type GenerationConfig } from '@google/generative-ai'
import { getCurrentAdmin } from '@/lib/admin'

// Increase max duration for LLM inference (Vercel setting)
export const maxDuration = 60
export const runtime = 'nodejs'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// Define the expected output structure for the LLM
const JSON_SCHEMA = {
  name: 'generate_site_config',
  description: 'Generates a highly tailored website and quote calculator configuration based on the business description or scraped website text.',
  parameters: {
    type: 'object',
    properties: {
      siteConfig: {
        type: 'object',
        description: 'The content for the 1-5 page generated website.',
        properties: {
          theme: {
            type: 'string',
            enum: ['luxury-minimal', 'brutalist', 'classic-warm', 'modern-office', 'playful-kids', 'rustic-pantry', 'sleek-entertainment', 'elegant-dressing', 'functional-utility', 'creative-craft', 'sophisticated-wine', 'cozy-library', 'minimalist-zen'],
            description: 'The visual theme that best fits this business.'
          },
          hero: {
            type: 'object',
            properties: {
              headline: { type: 'string', description: 'A highly converting, punchy H1 headline.' },
              backgroundImage: { type: 'string', description: 'Placeholder image URL (leave empty or use default Unsplash).', default: 'https://images.unsplash.com/photo-1558211583-d26f610c1eb1' },
              imagePrompt: { type: 'string', description: 'A complete, bespoke gpt-image-1 art-direction prompt for a wide-angle cinematic ARCHITECTURAL hero photograph of a completed, immaculate project in this exact niche. Capture grand scale and premium materials. Editorial magazine style, cinematic lighting, photorealistic, 8k, 16:9, crisp focus, clutter-free, no text, no people.' }
            },
            required: ['headline', 'imagePrompt']
          },
          about: {
            type: 'object',
            properties: {
              description: { type: 'string', description: 'A 2-3 sentence engaging about us paragraph tailored to their specific services.' }
            },
            required: ['description']
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
                    description: { type: 'string' }
                  },
                  required: ['number', 'title', 'description']
                }
              }
            },
            required: ['title', 'subtitle', 'steps']
          },
          products: {
            type: 'array',
            description: 'The main services or products they offer (up to 6).',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                imagePrompt: { type: 'string', description: 'A complete, bespoke gpt-image-1 art-direction prompt for a TIGHT MACRO close-up that proves craftsmanship for this specific product/service. Do NOT repeat the wide hero angle — focus on premium materials, hardware, precision joints, lighting integration, or a specialized auxiliary detail. Macro interior design photography, crisp textures, premium editorial look, photorealistic, 8k, 16:9, no text, no people.' },
                details: {
                  type: 'object',
                  properties: {
                    subtitle: { type: 'string' },
                    longDescription: { type: 'string' },
                    specifications: { type: 'array', items: { type: 'string' } }
                  },
                  required: ['subtitle', 'longDescription', 'specifications']
                }
              },
              required: ['title', 'description', 'imagePrompt', 'details']
            }
          }
        },
        required: ['theme', 'hero', 'about', 'process', 'products']
      },
      widgetConfig: {
        type: 'object',
        description: 'The custom configuration for the Quote Calculator widget.',
        properties: {
          customRooms: {
            type: 'array',
            description: 'Custom services/rooms for the quote calculator (e.g. "Productivity Consulting", "Garage Organization"). Replaces the default closet options.',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                basic: { type: 'number', description: 'Base price per linear foot or unit for basic tier.' },
                standard: { type: 'number', description: 'Base price per linear foot or unit for standard tier.' },
                premium: { type: 'number', description: 'Base price per linear foot or unit for premium tier.' }
              },
              required: ['name', 'basic', 'standard', 'premium']
            }
          },
          customAddOns: {
            type: 'array',
            description: 'Relevant add-ons for the services. E.g. "Digital Decluttering" for Productivity Consulting.',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                roomType: { type: 'string', description: 'Must exactly match one of the customRooms names.' },
                price: { type: 'number' }
              },
              required: ['name', 'roomType', 'price']
            }
          },
          customFinishes: {
            type: 'array',
            description: 'Material choices or service tiers. For physical builds use colors/woods. For digital/consulting use service tiers (e.g. Virtual vs In-Person).',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                description: { type: 'string' },
                swatchHex: { type: 'string', description: 'Hex color representing this tier/material.' },
                tier: { type: 'string', enum: ['basic', 'standard', 'premium'] }
              },
              required: ['label', 'description', 'swatchHex', 'tier']
            }
          }
        },
        required: ['customRooms', 'customAddOns', 'customFinishes']
      },
      pagesConfig: {
        type: 'array',
        description: 'Deep content for the multi-page site. Generate one object for EACH page in the requested sitemap (except Home, which is handled by siteConfig).',
        items: {
          type: 'object',
          properties: {
            slug: { type: 'string', description: 'URL slug for the page (e.g. "about-us", "services"). Do not use "/".' },
            title: { type: 'string', description: 'The title of the page.' },
            hero: {
              type: 'object',
              properties: {
                headline: { type: 'string' },
                backgroundImage: { type: 'string', description: 'Placeholder image URL.', default: 'https://images.unsplash.com/photo-1558211583-d26f610c1eb1' }
              },
              required: ['headline']
            },
            content_blocks: {
              type: 'array',
              description: 'The content blocks that make up the page body.',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['text', 'image_left', 'image_right', 'grid'] },
                  heading: { type: 'string' },
                  body: { type: 'string' },
                  image: { type: 'string' },
                  items: {
                    type: 'array',
                    description: 'Only for grid type.',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string' },
                        description: { type: 'string' }
                      }
                    }
                  }
                },
                required: ['type', 'heading', 'body']
              }
            }
          },
          required: ['slug', 'title', 'hero', 'content_blocks']
        }
      },
      upsellPitch: {
        type: 'string',
        description: 'A 2-3 sentence subtle, non-pushy email pitch offering them a full website refinement/upgrade to go along with their new Quote Calculator.'
      }
    },
    required: ['siteConfig', 'widgetConfig', 'upsellPitch']
  }
}

function extractTextFromHtml(html: string): string {
  const $ = cheerio.load(html)
  // Remove scripts, styles, nav, footer to reduce noise
  $('script, style, nav, footer, header, noscript, svg, img').remove()
  // Extract visible text
  let text = $('body').text()
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim()
  return text.substring(0, 15000) // Keep it within context limits
}

// Gemini sometimes wraps JSON in ```json fences or adds prose despite the
// responseMimeType hint. Pull out the outermost JSON object/array.
function extractJson(text: string): string {
  let t = text.trim()
  // Strip markdown code fences if present.
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) t = fence[1].trim()
  // Otherwise slice from the first { to the last } (or [ ... ]).
  const firstObj = t.indexOf('{')
  const lastObj = t.lastIndexOf('}')
  if (firstObj !== -1 && lastObj > firstObj) {
    return t.slice(firstObj, lastObj + 1)
  }
  return t
}

// When a site can't be scraped (403/bot-walls/timeouts), derive a usable seed
// from the URL so generation still proceeds instead of hard-failing.
function describeFromUrl(rawUrl: string): string {
  let hint = rawUrl
  try {
    const host = new URL(rawUrl).hostname.replace(/^www\./, '')
    const words = host.split('.')[0].replace(/[-_]+/g, ' ').trim()
    hint = `${words} (${host})`
  } catch {
    // keep raw url
  }
  return `Business website: ${rawUrl}. The site could not be read automatically (it blocked the request). Infer a plausible custom closets / home storage & organization business from the brand name "${hint}" and generate a tailored website and quote calculator. Use sensible, professional placeholder copy the operator can refine.`
}

export async function POST(req: Request) {
  try {
    // Admin-only: gating expensive Gemini inference behind the admin check.
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { input, sitemap } = await req.json()

    if (!input || typeof input !== 'string') {
      return NextResponse.json({ error: 'Input is required' }, { status: 400 })
    }

    let scrapedText = input
    let isUrl = false

    // Check if input is a URL
    try {
      const parsedUrl = new URL(input)
      if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
        isUrl = true
      }
    } catch {
      // Not a URL, treat as raw text
    }

    let scrapeOk = false
    if (isUrl) {
      try {
        const response = await fetch(input, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        })
        if (response.ok) {
          const text = extractTextFromHtml(await response.text())
          if (text.trim().length > 0) {
            scrapedText = text
            scrapeOk = true
          }
        } else {
          console.warn(`Scrape returned ${response.status} for ${input}; using domain hint`)
        }
      } catch (err) {
        console.warn('Scrape failed; using domain hint:', err)
      }

      // Non-fatal fallback: a blocked/empty scrape should not abort onboarding.
      if (!scrapeOk) {
        scrapedText = describeFromUrl(input)
      }
    }

    // Build system prompt based on whether this is a multi-page request
    let systemPrompt = `You are an elite Luxury Brand Copywriter, Visual Art Director, and Next.js Frontend Architect. 
Your job is to read the following business description or scraped website text and generate a complete, tailored configuration for a website and an interactive Quote Calculator. The output must look like a $200,000 bespoke digital storefront, explicitly avoiding generic "AI-generated" tropes.

CRITICAL INSTRUCTIONS FOR QUOTE CALCULATOR:
If the business is NOT a traditional closet/garage builder (e.g., they are a Professional Organizer or Consultant), you MUST completely replace the standard closet rooms (Walk-In, Reach-In) with their ACTUAL services (e.g., "Productivity Consulting", "Home Organizing").
The "customFinishes" should represent their service tiers (e.g., "Virtual Consultation", "In-Person (Half Day)") instead of wood materials.

CRITICAL INSTRUCTIONS FOR IMAGE PROMPTS (Visual Art Director):
Every "imagePrompt" you write is handed directly to gpt-image-1 to render a bespoke, photorealistic image — so make each one specific, contextual, and self-contained. Follow these rules:
- hero.imagePrompt: ONE wide-angle, cinematic ARCHITECTURAL photograph of a completed, immaculate project in this exact niche, capturing grand scale and premium materials/finishes. Editorial magazine style, cinematic lighting, photorealistic, 8k, 16:9, crisp focus, clutter-free, no text, no people.
- products[].imagePrompt: TIGHT MACRO close-ups that prove expertise. NEVER reuse the hero angle. Vary them across the products: (1) premium materials/hardware/precision joints, (2) lighting integration or high-tech functional luxury, (3) a highly organized specialized auxiliary detail. Macro interior design photography, crisp textures, premium editorial look, photorealistic, 8k, 16:9, no text, no people.
- Tailor every prompt to the contractor's specific niche and the chosen theme's aesthetic. Do not use brand names, logos, or watermarks.

Keep the upsell pitch professional, subtle, and focused on value.`;

    if (sitemap && Array.isArray(sitemap) && sitemap.length > 1) {
      systemPrompt += `\n\nCRITICAL MULTI-PAGE INSTRUCTION:
The user has requested a MULTI-PAGE site with the following sitemap: ${JSON.stringify(sitemap)}.
The first page is always "Home" and is handled by the 'siteConfig' object.
For ALL OTHER PAGES in the sitemap, you MUST generate an object in the 'pagesConfig' array.
For example, if the sitemap is ["Home", "About Us", "Contact"], you must generate 'pagesConfig' with two items: one for "About Us" and one for "Contact". 
Make sure the content_blocks are engaging and robust.`;
    }

    systemPrompt += `\n\nOUTPUT FORMAT:
You MUST return ONLY valid JSON matching the following schema. Do not wrap in markdown blocks, just return the raw JSON object.

${JSON.stringify(JSON_SCHEMA.parameters, null, 2)}`;

    // Call Gemini. Multi-page generation produces large JSON, so give it room;
    // default output token limits truncate the response and break JSON.parse.
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
        maxOutputTokens: 32768,
        // Disable "thinking": on this large structured-JSON prompt the default
        // thinking budget adds minutes of latency (blowing the 60s maxDuration)
        // and eats the output-token budget, truncating the JSON. The field is
        // honored by the v1beta API but not yet in this SDK's types.
        thinkingConfig: { thinkingBudget: 0 },
      } as GenerationConfig
    })

    const prompt = `System: ${systemPrompt}

User: Business Information:

${scrapedText}`

    const result_ai = await model.generateContent(prompt)

    // Read the raw text defensively: a blocked/empty candidate makes .text() throw.
    const candidate = result_ai.response?.candidates?.[0]
    const finishReason = candidate?.finishReason
    let rawText = ''
    try {
      rawText = result_ai.response.text()
    } catch {
      rawText = candidate?.content?.parts?.map((p) => ('text' in p ? p.text : '')).join('') ?? ''
    }

    if (!rawText.trim()) {
      console.error('Gemini empty response. finishReason:', finishReason)
      throw new Error(
        `AI returned no content${finishReason ? ` (finishReason: ${finishReason})` : ''}. Try fewer pages or a shorter description.`
      )
    }

    let aiData
    try {
      aiData = JSON.parse(extractJson(rawText))
    } catch {
      console.error(
        'Gemini JSON parse failed. finishReason:',
        finishReason,
        'rawText head:',
        rawText.slice(0, 300)
      )
      const hint =
        finishReason === 'MAX_TOKENS'
          ? ' The response was cut off (too long) — try fewer pages.'
          : ''
      throw new Error(`Gemini did not return valid JSON data.${hint}`)
    }

    return NextResponse.json({
      success: true,
      source: isUrl ? (scrapeOk ? 'url' : 'url-fallback') : 'text',
      scraped: scrapeOk,
      data: aiData
    })

  } catch (error) {
    console.error('AI Generation Error:', error)
    const message = error instanceof Error ? error.message : 'An error occurred during AI generation.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
