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
      pagesConfig: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            slug: { type: 'string' },
            title: { type: 'string' },
            hero: {
              type: 'object',
              properties: { headline: { type: 'string' } },
              required: ['headline'],
            },
            content_blocks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: {
                    type: 'string',
                    enum: ['text', 'image_left', 'image_right', 'grid'],
                  },
                  heading: { type: 'string' },
                  body: { type: 'string' },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string' },
                        description: { type: 'string' },
                      },
                      required: ['title', 'description'],
                    },
                  },
                },
                required: ['type', 'heading', 'body'],
              },
            },
          },
          required: ['slug', 'title', 'hero', 'content_blocks'],
        },
      },
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
Your sole purpose is to generate high-end, bespoke content configurations and photorealistic image
prompts that build premium digital storefronts looking like they cost $200,000 to design. You
explicitly AVOID generic "AI-generated" tropes (no plastic surfaces, no warped geometry, no fake
brand text, no uncanny symmetry, no stocky lifeless renders).

BUSINESS DOMAIN (NON-NEGOTIABLE): This is a custom closets / home storage & organization company
(walk-in closets, reach-in closets, pantries, garages, mudrooms, home offices, built-ins, etc.).
EVERY image prompt MUST depict a real, organized residential storage space relevant to the services
listed. NEVER generate unrelated subjects (no server rooms, data centers, offices full of computers,
spaceships, labs, abstract tech, etc.) even if the brand tone is described as "modern", "sleek", or
"high-tech" — interpret those words only as the styling of the closet/cabinetry, not the subject.

CRITICAL INSTRUCTIONS FOR QUOTE CALCULATOR:
Replace default closet rooms with ACTUAL services when appropriate.
customFinishes = service tiers when not a materials business.
defaultRoom = primary service type for the quote CTA.

=== VISUAL ART DIRECTION (image prompts must be detailed and cinematic) ===

REALISM MANDATE (NON-NEGOTIABLE): Every image prompt must describe a REAL PHOTOGRAPH, not a render.
Explicitly write that it is shot on a full-frame DSLR with a specific lens (e.g. 24mm or 35mm), in
natural window light with soft realistic shadows, showing real physical materials with natural grain
and subtle lived-in imperfections. Every prompt MUST include the phrase "NOT a 3D render, NOT CGI,
not digital art" and forbid plastic/glossy surfaces, waxy textures, warped geometry, and uncanny
perfect symmetry. The goal is an authentic architectural / real-estate photo that does NOT look
AI-generated.

The SUBJECT of every prompt is a custom closet / home-storage installation (cabinetry, shelving,
drawers, hanging rods, organized wardrobe / pantry / garage / mudroom / home office). The brand tone
only adjusts MATERIALS, FINISHES, and LIGHTING — it never changes the subject. Write each prompt as a
single dense paragraph (40-70 words). Name specific premium materials (e.g. rift-cut white oak,
matte-black anodized hardware, fluted glass, brushed brass rails, backlit LED shelving, Italian
porcelain, walnut veneer), specify the lighting, and end with the technical cues.

HERO IMAGE (hero.imagePrompt) — one wide-angle cinematic ARCHITECTURAL photograph capturing the grand
scale of a completed, immaculate installation.

CRITICAL — [primary service] MUST be the FIRST item from the "Services offered" field in the business
brief (e.g. if "Services offered: Garages & Garage Storage, Pantries & Wine Storage" then [primary
service] = "garages and garage storage"). NEVER substitute "walk-in closet" or any other default if
walk-in closets are not listed in Services offered. The subject of the hero image must match the
actual services the business sells.

Use this structure:
"Architectural photography, a grand wide-angle view of an immaculate [primary service] installation,
featuring [premium materials, specific high-end finishes, luxury environmental elements]. Shot on a
full-frame DSLR with a 24mm lens in natural window light, photorealistic, 8k resolution, crisp focus,
clean lines, clutter-free, wide 16:9 composition, NOT a 3D render, NOT CGI, not digital art, no
plastic surfaces, no text, no people, no logos."

PRODUCT IMAGES (products[].imagePrompt) — TIGHT MACRO close-ups that prove craftsmanship. NEVER reuse
the hero room angle. Rotate the focus across products so the grid feels curated, cycling through:
  • Focus A — premium materials, hardware, soft-close drawers, or precision joinery (extreme close-up).
  • Focus B — integrated lighting, smart features, or a functional-luxury layout detail.
  • Focus C — a highly organized, specialized auxiliary zone within that service (e.g. jewelry drawer,
    shoe wall, pantry provisions, garage workbench) shot tight.
Every product prompt MUST end with: "Macro interior photography, close-up shot, shot on a full-frame
DSLR with a 50mm macro lens in natural light, crisp real textures with subtle imperfections,
photorealistic, 8k resolution, wide 16:9 composition, NOT a 3D render, NOT CGI, not digital art, no
plastic surfaces, no text, no people."
Match each product to a real service from the business information.

=== PREMIUM COPYWRITING ===
- hero.headline: a punchy, high-end headline (about 5 words) focused on status and craftsmanship.
- about.description: a compelling 3-sentence narrative about raw architectural quality, master
  craftsmanship, and flawless execution — specific to this brand and niche, never boilerplate.
- process: title "Our Architectural Process", subtitle "From Vision to Flawless Reality", with 3 steps
  (e.g. Bespoke Consultation → Material Engineering → Precision Execution), each a vivid one-sentence
  description.
- products[].description: 2 sentences of high-level overview of that space/service.
- products[].details.subtitle: a premium line designation (e.g. "Signature Collection").
- products[].details.longDescription: a detailed paragraph on design intent, workflow advantage, and
  spatial value.
- products[].details.specifications: 2-3 concrete specs naming materials, build standards, hardware, or
  technology integration.
- theme: infer exactly one of the allowed theme slugs from the brand's aesthetic.`

  if (sitemap && sitemap.length > 1) {
    systemPrompt += `\n\n=== MULTI-PAGE SITEMAP (CRITICAL) ===
The customer chose these pages: ${JSON.stringify(sitemap)}.
Generate a "pagesConfig" array with ONE entry for EVERY page in the sitemap EXCEPT "Home"
(Home is rendered separately — do NOT include it in pagesConfig).

For each page:
- "slug": a lowercase URL slug starting with "/" derived from the page title
  (e.g. "About Us" -> "/about", "Portfolio / Gallery" -> "/portfolio",
  "Reviews & Testimonials" -> "/testimonials", "Service Areas" -> "/service-areas",
  "Our Process" -> "/process", "Contact" -> "/contact", "FAQ" -> "/faq",
  "Financing" -> "/financing", "Services" -> "/services").
- "title": the page title.
- "hero.headline": a punchy headline specific to that page.
- "content_blocks": 2 to 4 blocks of RICH, SPECIFIC, PERSUASIVE selling copy tailored to this exact
  business and niche — NEVER generic placeholders like "List the cities you serve". Write real
  marketing copy a $200k agency would ship. Vary block types:
    • "text" blocks: 2-4 sentence paragraphs (heading + body).
    • "image_left"/"image_right" blocks: heading + 2-4 sentence body (an image is auto-attached).
    • "grid" blocks: heading + short intro body + an "items" array of 3-6 {title, description}
      cards (great for FAQ Q&A, service lists, testimonials, process steps, or service-area cities).
  Choose block types that fit the page: FAQ -> grid of Q&A; Services -> grid of services;
  Testimonials -> grid of quotes; Service Areas -> grid of cities + a text intro; About/Process ->
  text + image blocks. Fill every field with concrete, on-brand content. No lorem ipsum, no
  "describe your..." instructions, no empty bodies.`
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
