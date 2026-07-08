import { NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/admin'
import { parseBusinessBrief } from '@/lib/ai/parseBusinessBrief'

export const maxDuration = 60
export const runtime = 'nodejs'

/**
 * Admin sandbox: extract industry, services, business name, theme, and layout
 * from a free-text business brief so the onboarding form auto-fills sensibly.
 */
export async function POST(req: Request) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const input = typeof body.input === 'string' ? body.input.trim() : ''
    if (!input) {
      return NextResponse.json({ error: 'Input is required' }, { status: 400 })
    }

    const data = await parseBusinessBrief(input)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('parse-business-brief error:', error)
    const message = error instanceof Error ? error.message : 'Parse failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
