import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import OpenAI from 'openai'

// Increase max duration for LLM inference (Vercel setting)
export const maxDuration = 60
export const runtime = 'nodejs'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

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
              backgroundImage: { type: 'string', description: 'Placeholder image URL (leave empty or use default Unsplash).', default: 'https://images.unsplash.com/photo-1558211583-d26f610c1eb1' }
            },
            required: ['headline']
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
              required: ['title', 'description', 'details']
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

export async function POST(req: Request) {
  try {
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

    if (isUrl) {
      try {
        const response = await fetch(input, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        })
        if (!response.ok) {
          throw new Error(`Failed to fetch URL: ${response.status}`)
        }
        const html = await response.text()
        scrapedText = extractTextFromHtml(html)
      } catch (err: any) {
        console.error('Scraping error:', err)
        return NextResponse.json({ error: `Failed to scrape URL: ${err.message}` }, { status: 500 })
      }
    }

    // Build system prompt based on whether this is a multi-page request
    let systemPrompt = `You are an expert web designer, copywriter, and business analyst. 
Your job is to read the following business description or scraped website text and generate a complete, tailored configuration for a website and an interactive Quote Calculator.

CRITICAL INSTRUCTIONS FOR QUOTE CALCULATOR:
If the business is NOT a traditional closet/garage builder (e.g., they are a Professional Organizer or Consultant), you MUST completely replace the standard closet rooms (Walk-In, Reach-In) with their ACTUAL services (e.g., "Productivity Consulting", "Home Organizing").
The "customFinishes" should represent their service tiers (e.g., "Virtual Consultation", "In-Person (Half Day)") instead of wood materials.

Keep the upsell pitch professional, subtle, and focused on value.`;

    if (sitemap && Array.isArray(sitemap) && sitemap.length > 1) {
      systemPrompt += `\n\nCRITICAL MULTI-PAGE INSTRUCTION:
The user has requested a MULTI-PAGE site with the following sitemap: ${JSON.stringify(sitemap)}.
The first page is always "Home" and is handled by the 'siteConfig' object.
For ALL OTHER PAGES in the sitemap, you MUST generate an object in the 'pagesConfig' array.
For example, if the sitemap is ["Home", "About Us", "Contact"], you must generate 'pagesConfig' with two items: one for "About Us" and one for "Contact". 
Make sure the content_blocks are engaging and robust.`;
    }

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: `Business Information:\n\n${scrapedText}`
        }
      ],
      tools: [
        {
          type: 'function',
          function: JSON_SCHEMA
        }
      ],
      tool_choice: { type: 'function', function: { name: 'generate_site_config' } },
      temperature: 0.7,
    })

    const toolCall = completion.choices[0]?.message?.tool_calls?.[0]
    if (!toolCall) {
      throw new Error('OpenAI did not return the expected structured data.')
    }

    const aiData = JSON.parse((toolCall as any).function.arguments)

    return NextResponse.json({
      success: true,
      source: isUrl ? 'url' : 'text',
      data: aiData
    })

  } catch (error: any) {
    console.error('AI Generation Error:', error)
    return NextResponse.json({ error: error.message || 'An error occurred during AI generation.' }, { status: 500 })
  }
}
