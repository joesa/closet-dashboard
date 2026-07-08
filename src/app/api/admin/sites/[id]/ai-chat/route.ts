import { NextResponse } from 'next/server'
import { getCurrentAdmin, logAdminAction } from '@/lib/admin'
import { runAdminSiteChat, type ChatMessage } from '@/lib/ai/adminSiteChat'

export const maxDuration = 120
export const runtime = 'nodejs'

/** ~6MB of base64 per image; anything bigger is rejected rather than truncated. */
const MAX_IMAGE_DATA_URL_CHARS = 8_000_000
const MAX_IMAGES_PER_MESSAGE = 4

function sanitizeImages(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const images = raw
    .filter(
      (u): u is string =>
        typeof u === 'string' &&
        u.length <= MAX_IMAGE_DATA_URL_CHARS &&
        /^data:image\/(png|jpeg|jpg|webp|gif);base64,/.test(u)
    )
    .slice(0, MAX_IMAGES_PER_MESSAGE)
  return images.length > 0 ? images : undefined
}

/**
 * Admin AI site chat. The admin sends the conversation so far; the AI answers
 * and (when the request calls for it) directly applies validated changes to
 * this tenant's site_configs row. Returns the assistant reply plus which
 * columns were applied/rejected so the UI can show what actually happened.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await params

  try {
    const adminUser = await getCurrentAdmin()
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const rawMessages = Array.isArray(body.messages) ? body.messages : []
    const messages: ChatMessage[] = rawMessages
      .filter(
        (m: unknown): m is { role: string; content: string } =>
          !!m &&
          typeof m === 'object' &&
          typeof (m as any).content === 'string' &&
          ((m as any).role === 'admin' || (m as any).role === 'assistant')
      )
      .map((m: { role: string; content: string; images?: unknown }) => ({
        role: m.role as 'admin' | 'assistant',
        content: m.content.slice(0, 8000),
        images: sanitizeImages(m.images),
      }))

    if (messages.length === 0 || messages[messages.length - 1].role !== 'admin') {
      return NextResponse.json(
        { error: 'messages must end with an admin message' },
        { status: 400 }
      )
    }

    const result = await runAdminSiteChat(tenantId, messages)

    if (result.applied.length > 0) {
      await logAdminAction({
        actor: adminUser,
        action: 'site.ai_chat_edit',
        targetType: 'tenant',
        targetId: tenantId,
        metadata: {
          prompt: messages[messages.length - 1].content.slice(0, 500),
          applied: result.applied,
          rejected: result.rejected,
        },
      })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('admin ai-chat error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chat failed' },
      { status: 500 }
    )
  }
}
