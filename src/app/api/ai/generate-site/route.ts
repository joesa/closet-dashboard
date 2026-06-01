import { NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/admin'
import { checkAndIncrementAiUsage } from '@/lib/aiUsage'
import { generateSiteConfigFromInput } from '@/lib/ai/generateSiteConfig'

export const maxDuration = 60
export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const usage = await checkAndIncrementAiUsage('generate_site')
    if (!usage.allowed) {
      return NextResponse.json({ error: usage.reason || 'AI limit reached' }, { status: 429 })
    }

    const { input, sitemap } = await req.json()

    if (!input || typeof input !== 'string') {
      return NextResponse.json({ error: 'Input is required' }, { status: 400 })
    }

    const result = await generateSiteConfigFromInput(
      input,
      Array.isArray(sitemap) ? sitemap : null
    )

    return NextResponse.json({
      success: true,
      source: result.source,
      scraped: result.scraped,
      data: result.data,
    })
  } catch (error) {
    console.error('AI Generation Error:', error)
    const message = error instanceof Error ? error.message : 'An error occurred during AI generation.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
