import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getIntakeByToken } from '@/lib/intake/getIntakeByToken'
import { assertDraftIntake, assertDepositPaid } from '@/lib/intake/intakeTierGates'
import { resolveStudioServiceNames } from '@/lib/intake/studioServiceNames'
import { parseImageSelections, syncProductSlots } from '@/lib/intake/imageSelections'

export const runtime = 'nodejs'

export async function PATCH(
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

    const body = await req.json()
    const slot = body.slot === 'product' ? 'product' : body.slot === 'hero' ? 'hero' : null
    const selectedUrl = typeof body.selectedUrl === 'string' ? body.selectedUrl.trim() : ''
    const selectedAttempt =
      typeof body.attempt === 'number' ? body.attempt : parseInt(body.attempt, 10)
    const productIndex =
      typeof body.productIndex === 'number' ? body.productIndex : parseInt(body.productIndex, 10)

    if (!slot || !selectedUrl) {
      return NextResponse.json({ error: 'slot and selectedUrl required' }, { status: 400 })
    }

    const selections = syncProductSlots(
      parseImageSelections(row.image_selections),
      resolveStudioServiceNames(row, body.serviceNames)
    )

    if (slot === 'hero') {
      const allowed = selections.hero.history.some((h) => h.urls.includes(selectedUrl))
      if (!allowed) {
        return NextResponse.json({ error: 'URL not from a generated hero batch' }, { status: 400 })
      }
      selections.hero.selectedUrl = selectedUrl
      selections.hero.selectedAttempt = Number.isFinite(selectedAttempt) ? selectedAttempt : undefined
    } else {
      const idx = Number.isFinite(productIndex) ? productIndex : -1
      const product = selections.products[idx]
      if (!product) {
        return NextResponse.json({ error: 'Invalid product index' }, { status: 400 })
      }
      const allowed = product.history.some((h) => h.urls.includes(selectedUrl))
      if (!allowed) {
        return NextResponse.json({ error: 'URL not from a generated product batch' }, { status: 400 })
      }
      product.selectedUrl = selectedUrl
      product.selectedAttempt = Number.isFinite(selectedAttempt) ? selectedAttempt : undefined
    }

    const admin = getSupabaseAdmin()
    await admin
      .from('prospect_intakes')
      .update({
        image_selections: selections,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)

    return NextResponse.json({ success: true, imageSelections: selections })
  } catch (error) {
    console.error('intake image-selection error:', error)
    const message = error instanceof Error ? error.message : 'Failed to save selection'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
