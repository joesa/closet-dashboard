import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import OpenAI from 'openai'

export const maxDuration = 60
export const runtime = 'nodejs'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

function extractTextFromHtml(html: string): string {
  const $ = cheerio.load(html)
  $('script, style, nav, footer, header, noscript, svg, img').remove()
  let text = $('body').text()
  text = text.replace(/\s+/g, ' ').trim()
  return text.substring(0, 15000)
}

export async function POST(req: Request) {
  try {
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
      } catch (err: any) {
        console.error('Scraping error:', err)
      }
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert web strategist. Based on the business description provided, suggest a sitemap of exactly ${requestedPages} pages. 
The first page MUST always be "Home". 
Return a JSON object with a single property 'pages' which is an array of strings representing the page titles.`
        },
        {
          role: 'user',
          content: `Business Information:\n\n${scrapedText}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
    })

    const result = JSON.parse(completion.choices[0]?.message?.content || '{"pages": ["Home"]}')

    // Enforce constraints just in case
    let pages = Array.isArray(result.pages) ? result.pages : ["Home"]
    if (pages[0] !== "Home") pages = ["Home", ...pages.filter((p: string) => p !== "Home")]
    pages = pages.slice(0, requestedPages)

    return NextResponse.json({
      success: true,
      data: { pages }
    })

  } catch (error: any) {
    console.error('AI Sitemap Error:', error)
    return NextResponse.json({ error: error.message || 'An error occurred during AI sitemap generation.' }, { status: 500 })
  }
}
