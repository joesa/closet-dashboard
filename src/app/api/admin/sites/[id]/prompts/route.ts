import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin'
import { loadFullRedesignPrompts } from '@/lib/ai/fullRedesignPrompts'
import { formatPromptsForDownload } from '@/lib/ai/promptRecorder'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/sites/[id]/prompts — the exact model inputs behind the current
 * draft. `?download=1` returns the same content as a text attachment.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAdmin()
  const { id } = await params
  const record = await loadFullRedesignPrompts(id)

  if (!record) {
    return NextResponse.json(
      { ok: false, error: 'No prompts recorded for this site yet. They are captured on the next Full redesign.' },
      { status: 404 }
    )
  }

  if (new URL(req.url).searchParams.get('download') === '1') {
    const body = formatPromptsForDownload(record.prompts, {
      brandName: record.brandName ?? undefined,
      runId: record.runId ?? undefined,
      startedAt: record.startedAt ?? undefined,
    })
    const slug = (record.brandName || 'site').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    return new NextResponse(body, {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'content-disposition': `attachment; filename="${slug}-redesign-prompts.txt"`,
      },
    })
  }

  return NextResponse.json({ ok: true, ...record })
}
