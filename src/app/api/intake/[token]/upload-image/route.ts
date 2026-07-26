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
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (bytes.byteLength < 32) {
      return NextResponse.json({ error: 'Image file is empty or invalid.' }, { status: 400 })
    }
    const buffer = Buffer.from(bytes)
    const url = await uploadOptimizedBuffer(
      buffer,
      `intakes/${token}/uploads/${kind}-${stamp}`,
      kind,
      file.type || 'image/jpeg'
    )

    // Fail closed if storage ever mangles binary again — don't select a broken URL.
    const probe = await fetch(url, { method: 'GET', cache: 'no-store' })
    if (!probe.ok) {
      return NextResponse.json({ error: 'Upload succeeded but file is not readable.' }, { status: 500 })
    }
    const uploaded = Buffer.from(await probe.arrayBuffer())
    // JPEG SOI or PNG signature — reject UTF-8-corrupted payloads (contain U+FFFD).
    const isJpeg = uploaded[0] === 0xff && uploaded[1] === 0xd8
    const isPng =
      uploaded[0] === 0x89 &&
      uploaded[1] === 0x50 &&
      uploaded[2] === 0x4e &&
      uploaded[3] === 0x47
    const isWebp =
      uploaded[0] === 0x52 &&
      uploaded[1] === 0x49 &&
      uploaded[2] === 0x46 &&
      uploaded[3] === 0x46 &&
      uploaded[8] === 0x57 &&
      uploaded[9] === 0x45 &&
      uploaded[10] === 0x42 &&
      uploaded[11] === 0x50
    if (!isJpeg && !isPng && !isWebp) {
      console.error('intake upload-image: corrupt object uploaded', {
        url,
        head: [...uploaded.subarray(0, 16)],
      })
      return NextResponse.json(
        { error: 'Uploaded image was corrupted in storage. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, url })
  } catch (error) {
    console.error('intake upload-image error:', error)
    const message = error instanceof Error ? error.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
