import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import {
  AiConfigError,
  deleteProvider,
  listProviders,
  upsertProvider,
} from '@/lib/ai/aiConfigAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/admin/ai-config/providers — registered endpoints (never their keys). */
export async function GET() {
  await requireAdmin()
  return NextResponse.json({ providers: await listProviders() })
}

/** POST — create or update. Omit apiKey to leave a stored one untouched. */
export async function POST(req: Request) {
  await requireAdmin()
  try {
    const body = (await req.json()) as Record<string, unknown>
    const provider = await upsertProvider({
      id: typeof body.id === 'string' ? body.id : undefined,
      slug: String(body.slug ?? '').trim().toLowerCase(),
      label: String(body.label ?? ''),
      kind: String(body.kind ?? ''),
      baseUrl: typeof body.baseUrl === 'string' ? body.baseUrl : null,
      apiKey: 'apiKey' in body ? (body.apiKey as string | null) : undefined,
      extraHeaders:
        body.extraHeaders && typeof body.extraHeaders === 'object'
          ? (body.extraHeaders as Record<string, string>)
          : undefined,
      enabled: body.enabled === undefined ? undefined : !!body.enabled,
    })
    return NextResponse.json({ provider })
  } catch (err) {
    if (err instanceof AiConfigError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }
}

/** DELETE ?id= — refused while a purpose still points at it. */
export async function DELETE(req: Request) {
  await requireAdmin()
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
  try {
    await deleteProvider(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof AiConfigError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }
}
