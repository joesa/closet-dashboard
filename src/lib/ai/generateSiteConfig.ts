import * as cheerio from 'cheerio'
import { generateTextWithFallback } from '@/lib/ai/aiTextProvider'
import { LAYOUT_SLUGS, THEME_SLUGS } from '@/lib/catalog/sitePresentationCatalog'

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
              subheadline: { type: 'string' },
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
          quiz: {
            type: 'object',
            properties: {
              eyebrow: { type: 'string' },
              headline: { type: 'string' },
              questions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    title: { type: 'string' },
                    options: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          label: { type: 'string' },
                        },
                        required: ['id', 'label'],
                      },
                    },
                  },
                  required: ['id', 'title', 'options'],
                },
              },
            },
            required: ['eyebrow', 'headline', 'questions'],
          },
        },
        required: ['theme', 'layoutStyle', 'defaultRoom', 'hero', 'about', 'process', 'products', 'quiz'],
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
            is_active: { type: 'boolean' },
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
          required: ['slug', 'title', 'is_active', 'hero', 'content_blocks'],
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

export function sanitizeJsonString(json: string): string {
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

function describeFromUrl(rawUrl: string): string {
  let hint = rawUrl
  try {
    const host = new URL(rawUrl).hostname.replace(/^www\./, '')
    const words = host.split('.')[0].replace(/[-_]+/g, ' ').trim()
    hint = `${words} (${host})`
  } catch {
    /* keep */
  }
  return `Business website: ${rawUrl}. The site could not be read automatically. Infer a plausible service business from the domain name "${hint}". Do NOT default to custom closets or home storage unless the domain name clearly implies that.`
}

export type GenerateSiteConfigResult = {
  data: Record<string, unknown>
  source: 'openai' | 'gemini' | 'url' | 'url-fallback'
  scraped: boolean
}

export async function generateSiteConfigFromInput(
  input: string,
  sitemap?: string[] | null,
  pageContents?: Record<string, string> | null,
  industry?: string | null
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

  const trade = industry?.trim()
  const domainLine = trade
    ? `This business operates in the ${trade} industry.`
    : `This business operates in the exact trade indicated by the "Services offered" list in the business brief below — infer that trade from those services and NEVER default to custom closets, cabinetry, or home storage unless the listed services clearly are closets/storage.`
  const tradeNoun = trade
    ? `${trade} business`
    : `business in the exact trade shown in the "Services offered" list`
  const tradeServices = trade ?? 'the services listed in the brief'

  let systemPrompt = `You are an elite Luxury Brand Copywriter, Visual Art Director, and Next.js Frontend Architect.
Your sole purpose is to generate high-end, bespoke content configurations and photorealistic image
prompts that build premium digital storefronts looking like they cost $200,000 to design. You
explicitly AVOID generic "AI-generated" tropes (no plastic surfaces, no warped geometry, no fake
brand text, no uncanny symmetry, no stocky lifeless renders).

BUSINESS DOMAIN (NON-NEGOTIABLE): ${domainLine}
EVERY image prompt and all copy MUST depict real, on-the-job scenes, finished work, and environments
relevant to a ${tradeNoun} and the services listed below.
NEVER generate unrelated subjects (no server rooms, data centers, spaceships, labs, abstract tech, etc.)
even if the brand tone is described as "modern", "sleek", or "high-tech" — interpret those words only as
the styling of the work shown, not the subject.

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

The SUBJECT of every prompt is the actual work of a ${tradeNoun}
(its finished work, crews on the job, equipment, and serviced spaces). The brand tone
only adjusts MATERIALS, FINISHES, and LIGHTING — it never changes the subject. Write each prompt as a
single dense paragraph (40-70 words). Name specific real materials, tools, or equipment for THIS trade
(for storage/cabinetry: rift-cut white oak, matte-black anodized hardware, fluted glass, brushed brass rails;
for drain/plumbing: hydro-jet nozzles, PVC fittings, pipe wrenches, clean sewer lines;
for HVAC: copper refrigerant lines, duct runs, condenser units;
for roofing: architectural shingles, flashing, ridge caps;
adapt to whatever the actual trade is), specify the lighting, and end with technical cues.

HERO IMAGE (hero.imagePrompt) — one wide-angle professional photograph capturing the grand
scale of a completed, high-quality job for a ${tradeNoun}.

CRITICAL — [primary service] MUST be the FIRST item from the "Services offered" field in the business
brief (e.g. if "Services offered: Garages & Garage Storage, Pantries & Wine Storage" then [primary
service] = "garages and garage storage"). NEVER substitute "walk-in closet" or any other default if
walk-in closets are not listed in Services offered. The subject of the hero image must match the
actual services the business sells.

Use this structure (adapt to the actual trade — replace "installation" with the right noun for the job):
"Professional wide-angle photograph of a completed [primary service] job for a ${tradeNoun},
showing [real finished work, specific trade materials, tools, or equipment]. Shot on a
full-frame DSLR with a 24mm lens in natural light, photorealistic, 8k resolution, crisp focus,
clean composition, wide 16:9 ratio, NOT a 3D render, NOT CGI, not digital art, no
plastic surfaces, no text, no logos."

PRODUCT IMAGES (products[].imagePrompt) — TIGHT MACRO close-ups that prove craftsmanship. NEVER reuse
the hero room angle. Rotate the focus across products so the grid feels curated, cycling through:
  • Focus A — premium materials, hardware, soft-close drawers, or precision joinery (extreme close-up).
  • Focus B — integrated lighting, smart features, or a functional-luxury layout detail.
  • Focus C — a specialized, detail-rich element of that service shot tight — a signature detail of
    the finished job that proves trade skill. Examples: for closets/storage: a jewelry drawer, shoe
    wall, pantry shelving; for drain/plumbing: a polished pipe connection or hydro-jet nozzle;
    for HVAC: a mounted air handler or copper line-set; for roofing: flashing detail or ridge cap;
    adapt to whatever the actual trade is.
Every product prompt MUST end with: "Macro interior photography, close-up shot, shot on a full-frame
DSLR with a 50mm macro lens in natural light, crisp real textures with subtle imperfections,
photorealistic, 8k resolution, wide 16:9 composition, NOT a 3D render, NOT CGI, not digital art, no
plastic surfaces, no text."
Match each product to a real service from the business information.

=== PREMIUM COPYWRITING ===
- hero.headline: a punchy headline (about 5 words) that highlights the core value this ${tradeNoun} delivers. Make it outcome-driven and specific to the trade — NOT generic, NOT about architecture unless this IS an architecture/design firm. NEVER start with "Welcome to". Prefer "{service} in {city}" or an outcome phrase over brand-greeting openers.
- hero.subheadline: ONE supporting sentence (12-22 words) that sits under the headline. Add concrete substance — what is delivered, for whom, and a real proof point or differentiator from the brief (e.g. years in business, area served, materials, guarantee). Specific to this trade; no filler, no repeating the headline.
- about.description: a compelling 3-sentence brand narrative about quality, expertise, and reliability written for a ${tradeNoun}. Make it specific to this trade and brand. Do NOT use architectural, closet, or home-storage language unless those ARE the actual services listed. Ban filler phrases like "trusted local provider" and "Licensed & insured" unless those facts are explicitly in the brief.
- process: a 3-step how-it-works section. The steps array MUST contain exactly 3 steps, numbered '01', '02', '03' in that exact sequence. The title and subtitle MUST reflect the actual trade — do NOT use "Our Architectural Process" or "From Vision to Flawless Reality" unless the business is literally an architecture or design firm. Example adaptations: drain cleaning → "Book → Diagnose → Fix"; HVAC → "Assess → Recommend → Install"; roofing → "Inspect → Estimate → Install"; closets → "Design → Build → Install". Each step is a vivid one-sentence description.
- CRITICAL — products[]: Generate EXACTLY ONE product entry for EACH service listed in the "Services offered" field of the business brief. The title MUST be that exact service name — do NOT add, remove, rename, or substitute services. If the brief lists "drain cleaning", the product title is "drain cleaning". If the brief lists 1 service, generate 1 product. The AI MUST NOT invent new services or replace the listed ones with anything else.
- products[].description: 2 sentences about what this specific service involves and who needs it.
- products[].details.subtitle: a quality/tier label appropriate to the trade (for luxury closets: "Signature Collection"; for drain/plumbing: "Professional Grade"; for HVAC: "Certified Service"; for roofing: "Expert Install" — match the actual trade).
- products[].details.longDescription: a detailed paragraph about this specific service: what is done, the tools or materials used, and the outcome for the customer. Never use closet "architectural build-out" language for non-closet trades.
- products[].details.specifications: 2-3 concrete specs naming real trade standards, certifications, materials, or warranties specific to this service. NEVER use the generic trilogy "Premium Materials / Precision Fit / Lifetime Warranty" or "Licensed & insured / Free estimate / Satisfaction guaranteed".
- quiz: Generate exactly 3 custom lead-qualification questions relevant to this specific trade. Do not use generic fallbacks like "What's the biggest challenge?". Instead, ask trade-specific questions (e.g., HVAC: "What's wrong with your current system?", Landscaping: "What is your primary goal for the outdoor space?"). Provide exactly 4 options for each question. Give each question and option a short, unique string ID.
- theme: infer exactly one of the allowed theme slugs that best fits this specific industry and trade.
- layoutStyle: infer exactly one of the allowed layout styles that best fits this specific industry and trade.`

  systemPrompt += `\n\n=== MULTI-PAGE SITEMAP (CRITICAL) ===
Generate a comprehensive "pagesConfig" array containing 8 to 12 pages for this business. This is a library of pages; you must generate the core pages AND all logical optional pages (e.g. FAQ, Service Areas, Financing, Gallery, specific services, About, Process, Contact, Testimonials, etc).
(Home is rendered separately — do NOT include it in pagesConfig).

For each page:
- "slug": a lowercase URL slug starting with "/" derived from the page title
  (e.g. "About Us" -> "/about", "Portfolio / Gallery" -> "/portfolio",
  "Reviews & Testimonials" -> "/testimonials", "Service Areas" -> "/service-areas",
  "Our Process" -> "/process", "Contact" -> "/contact", "FAQ" -> "/faq",
  "Financing" -> "/financing", "Services" -> "/services").
- "title": the page title.
- "is_active": boolean. Set to true if the page is essential for the initial site launch (e.g., About Us, Services, Contact), or false if it is an optional page that the Admin can enable later. ${sitemap && sitemap.length > 1 ? `The customer specifically requested these pages, so ensure they are included and set is_active to true for them: ${JSON.stringify(sitemap)}.` : ''}
- "hero.headline": a punchy headline specific to that page. HARD LIMIT: 6 words or fewer — some
  design variants render headlines at monumental scale, and anything longer overflows the hero
  and collides with the fixed navigation bar.
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

  if (pageContents && Object.keys(pageContents).length > 0) {
    systemPrompt += `\n\n=== USER-CUSTOMIZED PAGE COPY (NON-NEGOTIABLE) ===
The user has provided custom copy for the following pages. You MUST incorporate the full substance and exact phrasing of this copy into the page's content_blocks. 
CRITICAL: Do NOT just dump the entire text into a single "text" block. You MUST break the copy apart into 4 to 8 beautifully structured "content_blocks" utilizing rich layouts (image_left, image_right, grid, and text). Use implied sections in the copy as block "heading"s, and distribute the paragraphs into the "body" or "items" fields of the blocks to create a dynamic, premium layout.
${Object.entries(pageContents)
  .map(([slug, text]) => `- Page "/${slug.replace(/^\//, '')}": "${text.replace(/"/g, '\\"')}"`)
  .join('\n')}`
  }

  systemPrompt += `\n\nOUTPUT: valid JSON only:\n${JSON.stringify(GENERATE_SITE_JSON_SCHEMA.parameters, null, 2)}`

  const { text: rawText, provider } = await generateTextWithFallback({
    prompt: `User: Business Information:\n\n${scrapedText}`,
    systemPrompt,
    jsonMode: true,
    temperature: 0.7,
    maxOutputTokens: 32768,
  })

  let aiData: Record<string, unknown>
  try {
    aiData = JSON.parse(sanitizeJsonString(extractJson(rawText))) as Record<string, unknown>
  } catch {
    console.error('RAW TEXT:', rawText);
    throw new Error(
      'AI did not return valid JSON.'
    )
  }

  return {
    data: aiData,
    source: isUrl ? (scrapeOk ? 'url' : 'url-fallback') : provider,
    scraped: scrapeOk,
  }
}
