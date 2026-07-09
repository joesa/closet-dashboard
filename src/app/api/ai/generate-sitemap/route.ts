import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { generateTextWithFallback } from '@/lib/ai/aiTextProvider'
import { getCurrentAdmin } from '@/lib/admin'
import { extractJson, sanitizeJsonString } from '@/lib/ai/generateSiteConfig'
import { SITE_PAGE_OPTIONS } from '@/lib/catalog/sitePages'

export const maxDuration = 60
export const runtime = 'nodejs'

function extractTextFromHtml(html: string): string {
  const $ = cheerio.load(html)
  $('script, style, nav, footer, header, noscript, svg, img').remove()
  let text = $('body').text()
  text = text.replace(/\s+/g, ' ').trim()
  return text.substring(0, 15000)
}

/** Deterministic sitemap when Gemini returns unparseable JSON. */
function fallbackSitemap(pageCount: number): string[] {
  const extras = SITE_PAGE_OPTIONS.filter((p) => p.recommended).map((p) => p.label)
  const more = SITE_PAGE_OPTIONS.filter((p) => !p.recommended).map((p) => p.label)
  const pool = [...extras, ...more]
  return ['Home', ...pool.slice(0, Math.max(0, pageCount - 1))]
}

function normalizePages(raw: unknown, pageCount: number): string[] {
  let pages = Array.isArray(raw)
    ? raw.filter((p): p is string => typeof p === 'string' && p.trim().length > 0).map((p) => p.trim())
    : []

  if (pages.length === 0) {
    return fallbackSitemap(pageCount)
  }

  if (pages[0] !== 'Home') {
    pages = ['Home', ...pages.filter((p) => p !== 'Home')]
  }

  // Deduplicate while preserving order.
  const seen = new Set<string>()
  pages = pages.filter((p) => {
    const key = p.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  if (pages.length < pageCount) {
    const filler = fallbackSitemap(pageCount).filter(
      (p) => !pages.some((existing) => existing.toLowerCase() === p.toLowerCase())
    )
    pages = [...pages, ...filler].slice(0, pageCount)
  }

  return pages.slice(0, pageCount)
}

export async function POST(req: Request) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { input, pageCount } = await req.json()

    if (!input || typeof input !== 'string') {
      return NextResponse.json({ error: 'Input is required' }, { status: 400 })
    }

    const requestedPages = Math.round(Number(pageCount) || 1)
    if (requestedPages < 2 || requestedPages > 10) {
      return NextResponse.json(
        { error: 'Page count must be between 2 and 10 for a multi-page sitemap.' },
        { status: 400 }
      )
    }

    let scrapedText = input
    let isUrl = false

    try {
      const parsedUrl = new URL(input)
      if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
        isUrl = true
      }
    } catch {
      // not a URL
    }

    if (isUrl) {
      try {
        const response = await fetch(input, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          },
        })
        if (response.ok) {
          const html = await response.text()
          scrapedText = extractTextFromHtml(html)
        }
      } catch (err) {
        console.error('Scraping error:', err)
      }
    }

    const systemPrompt = `You are an expert web strategist for local service businesses. Based on the business description, suggest a sitemap of exactly ${requestedPages} pages.
The first page MUST always be "Home".
Use clear page titles like "About Us", "Services", "Portfolio", "Contact", "FAQ", "Service Areas", "Our Process", "Reviews".
Return ONLY a JSON object with this exact shape: {"pages":["Home","Services","About Us",...]}
No markdown, no commentary.`

    const prompt = `Business Information:

${scrapedText}`

    const { text } = await generateTextWithFallback({
      prompt,
      systemPrompt,
      jsonMode: true,
      temperature: 0.3,
      maxOutputTokens: 1024,
    })

    let pages: string[]
    try {
      const result = JSON.parse(sanitizeJsonString(extractJson(text || ''))) as {
        pages?: unknown
      }
      pages = normalizePages(result.pages, requestedPages)
    } catch (parseErr) {
      console.error('AI Sitemap JSON parse failed, using fallback:', parseErr, text?.slice(0, 200))
      pages = fallbackSitemap(requestedPages)
    }

    return NextResponse.json({
      success: true,
      data: { pages },
    })
  } catch (error) {
    console.error('AI Sitemap Error:', error)
    const message =
      error instanceof Error ? error.message : 'An error occurred during AI sitemap generation.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
