import { NextResponse } from 'next/server'
import { getIntakeByToken } from '@/lib/intake/getIntakeByToken'
import { assertDraftIntake, assertDepositPaid } from '@/lib/intake/intakeTierGates'
import { uploadOptimizedBuffer } from '@/lib/images/uploadOptimized'
import type { ImageUploadKind } from '@/lib/images/optimizeUpload'
import { checkRateLimit, hashRateKey } from '@/lib/rateLimit'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_BYTES = 4 * 1024 * 1024 // stay under platform body limits after multipart overhead

function resolveKind(raw: unknown): ImageUploadKind {
  if (raw === 'logo') return 'logo'
  if (raw === 'product') return 'product'
  if (raw === 'gallery') return 'gallery'
  // hero / before / after all use the wide hero profile
  return 'hero'
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const row = await getIntakeByToken(token)
    if (!row) {
      return NextResponse.json({ error: 'Intake not found' }, { status: 404 })
    }
    const draftErr = assertDraftIntake(row)
    if (draftErr) {
      return NextResponse.json({ error: draftErr }, { status: 410 })
    }
    const depositErr = assertDepositPaid(row)
    if (depositErr) {
      return NextResponse.json({ error: depositErr }, { status: 403 })
    }

    const limit = await checkRateLimit(
      hashRateKey('intake_ai_upload', token),
      40,
      60 * 60 * 1000
    )
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many uploads. Try again later.' }, { status: 429 })
    }

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: 'Image is too large. Please use a photo under 4MB.' },
        { status: 413 }
      )
    }

    const kind = resolveKind(form.get('kind'))
    const stamp = Date.now()
    const buffer = Buffer.from(await file.arrayBuffer())
    const url = await uploadOptimizedBuffer(
      buffer,
      `intakes/${token}/uploads/${kind}-${stamp}`,
      kind,
      file.type || 'image/jpeg'
    )

    return NextResponse.json({ success: true, url })
  } catch (error) {
    console.error('intake upload-image error:', error)
    const message = error instanceof Error ? error.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
