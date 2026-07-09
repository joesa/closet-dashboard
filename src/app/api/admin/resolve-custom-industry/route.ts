import { NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/admin'
import { resolveIndustryForSetup } from '@/lib/catalog/resolveIndustryForSetup'

export const maxDuration = 60
export const runtime = 'nodejs'

/**
 * Admin sandbox guided setup: resolve a catalog or custom industry label,
 * generating + persisting a new trade template when needed.
 */
export async function POST(req: Request) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const industryText = typeof body.industry === 'string' ? body.industry.trim() : ''
    const businessName = typeof body.businessName === 'string' ? body.businessName.trim() : undefined
    const otherServices = typeof body.otherServices === 'string' ? body.otherServices.trim() : undefined

    if (!industryText) {
      return NextResponse.json({ error: 'industry is required' }, { status: 400 })
    }

    const result = await resolveIndustryForSetup({
      industryText,
      businessName,
      otherServices,
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('admin resolve-custom-industry error:', error)
    const message = error instanceof Error ? error.message : 'Resolve failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
