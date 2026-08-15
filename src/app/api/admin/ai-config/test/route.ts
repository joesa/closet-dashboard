import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { recordProviderCheck } from '@/lib/ai/aiConfigAdmin'
import { testProviderEndpointById } from '@/lib/ai/testProviderEndpoint'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// A cold local model can take a while to answer its first request.
export const maxDuration = 60

/**
 * POST /api/admin/ai-config/test — can this environment actually reach the
 * endpoint? Runs from Vercel, which is where most (but not all) generation
 * happens; the worker VM has its own egress and can differ.
 */
export async function POST(req: Request) {
  await requireAdmin()
  const body = (await req.json()) as { id?: string }
  if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const result = await testProviderEndpointById(body.id)
  await recordProviderCheck(body.id, { ok: result.ok, error: result.error ?? null })
  return NextResponse.json(result)
}
