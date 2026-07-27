import { NextResponse } from 'next/server'
import { getCurrentAdmin, logAdminAction } from '@/lib/admin'
import {
  loadAssistantHistory,
  runAdminSiteChat,
  type ChatMessage,
} from '@/lib/ai/adminSiteChat'
import { normalizeAdminImageRefs } from '@/lib/adminImageAttach'

export const maxDuration = 120
export const runtime = 'nodejs'

/** ~6MB of base64 per image; anything bigger is rejected rather than truncated. */
const MAX_IMAGE_DATA_URL_CHARS = 8_000_000

function sanitizeImages(raw: unknown): string[] | undefined {
  const refs = normalizeAdminImageRefs(raw).filter((u) => {
    if (u.startsWith('data:')) return u.length <= MAX_IMAGE_DATA_URL_CHARS
    return true
  })
  return refs.length > 0 ? refs : undefined
}

/**
 * Load durable AI Site Assistant history for this tenant (survives refresh).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await params
  try {
    const adminUser = await getCurrentAdmin()
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const history = await loadAssistantHistory(tenantId)
    return NextResponse.json({ messages: history })
  } catch (error) {
    console.error('admin ai-chat GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load history' },
      { status: 500 }
    )
  }
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
      .map(
        (m: {
          role: string
          content: string
          images?: unknown
          applied?: unknown
          rejected?: unknown
          at?: unknown
        }) => ({
          role: m.role as 'admin' | 'assistant',
          content: m.content.slice(0, 8000),
          images: sanitizeImages(m.images),
          ...(Array.isArray(m.applied)
            ? { applied: m.applied.filter((x): x is string => typeof x === 'string') }
            : {}),
          ...(Array.isArray(m.rejected)
            ? {
                rejected: m.rejected.filter(
                  (r): r is { column: string; reason: string } =>
                    !!r &&
                    typeof r === 'object' &&
                    typeof (r as any).column === 'string' &&
                    typeof (r as any).reason === 'string'
                ),
              }
            : {}),
          ...(typeof m.at === 'string' ? { at: m.at } : {}),
        })
      )

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
