import { NextResponse } from 'next/server'
import { listCustomIndustries } from '@/lib/catalog/customIndustries'

export const runtime = 'nodejs'

/**
 * Contractor-contributed industries not in the static catalog (see
 * /api/intake/[token]/resolve-custom-industry) — merged into the intake
 * form's industry dropdown so future contractors can select them directly
 * instead of typing free text again.
 */
export async function GET() {
  const industries = await listCustomIndustries()
  return NextResponse.json({ industries })
}
