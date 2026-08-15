import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import {
  AiConfigError,
  clearAssignment,
  listAssignments,
  setAssignment,
} from '@/lib/ai/aiConfigAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET — every purpose, with its chain or the built-in it inherits. */
export async function GET() {
  await requireAdmin()
  return NextResponse.json({ assignments: await listAssignments() })
}

/** PUT — assign a chain to one purpose. An empty chain clears the override. */
export async function PUT(req: Request) {
  const admin = await requireAdmin()
  try {
    const body = (await req.json()) as Record<string, unknown>
    const purpose = String(body.purpose ?? '')
    const chain = Array.isArray(body.chain)
      ? (body.chain as Record<string, unknown>[]).map((e) => ({
          providerSlug: String(e.providerSlug ?? ''),
          model: String(e.model ?? ''),
        }))
      : []

    if (chain.length === 0) {
      await clearAssignment(purpose)
    } else {
      await setAssignment({
        purpose,
        chain,
        enabled: body.enabled === undefined ? undefined : !!body.enabled,
        updatedBy: admin.id ?? null,
      })
    }
    return NextResponse.json({ assignments: await listAssignments() })
  } catch (err) {
    if (err instanceof AiConfigError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }
}
