import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { GoogleGenerativeAI, type GenerationConfig } from '@google/generative-ai'
import { getCurrentAdmin } from '@/lib/admin'

export const maxDuration = 60
export const runtime = 'nodejs'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

function extractTextFromHtml(html: string): string {
  const $ = cheerio.load(html)
  $('script, style, nav, footer, header, noscript, svg, img').remove()
  let text = $('body').text()
  text = text.replace(/\s+/g, ' ').trim()
  return text.substring(0, 15000)
}

export async function POST(req: Request) {
  try {
    // Admin-only: gating expensive Gemini inference behind the admin check.
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { input, pageCount } = await req.json()

    if (!input || typeof input !== 'string') {
      return NextResponse.json({ error: 'Input is required' }, { status: 400 })
    }

    const requestedPages = Number(pageCount) || 1
    if (requestedPages < 2 || requestedPages > 5) {
      return NextResponse.json({ error: 'Page count must be between 2 and 5 for a multi-page sitemap.' }, { status: 400 })
    }

    let scrapedText = input
    let isUrl = false

    try {
      const parsedUrl = new URL(input)
      if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
        isUrl = true
      }
    } catch {}

    if (isUrl) {
      try {
        const response = await fetch(input, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        })
        if (response.ok) {
          const html = await response.text()
          scrapedText = extractTextFromHtml(html)
        }
      } catch (err) {
        console.error('Scraping error:', err)
      }
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.5,
        // Disable "thinking" to keep latency low and avoid 60s timeouts.
        thinkingConfig: { thinkingBudget: 0 },
      } as GenerationConfig
    })

    const prompt = `System: You are an expert web strategist. Based on the business description provided, suggest a sitemap of exactly ${requestedPages} pages. 
The first page MUST always be "Home". 
Return a JSON object with a single property 'pages' which is an array of strings representing the page titles.

User: Business Information:

${scrapedText}`

    const result_ai = await model.generateContent(prompt)
    const result = JSON.parse(result_ai.response.text() || '{"pages": ["Home"]}')

    // Enforce constraints just in case
    let pages = Array.isArray(result.pages) ? result.pages : ["Home"]
    if (pages[0] !== "Home") pages = ["Home", ...pages.filter((p: string) => p !== "Home")]
    pages = pages.slice(0, requestedPages)

    return NextResponse.json({
      success: true,
      data: { pages }
    })

  } catch (error) {
    console.error('AI Sitemap Error:', error)
    const message = error instanceof Error ? error.message : 'An error occurred during AI sitemap generation.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
