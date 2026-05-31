import { NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/admin'
import {
  createDraftIntake,
  pipelineToRequestedProduct,
} from '@/lib/intake/createDraftIntake'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
export const runtime = 'nodejs'

// Admin-only: create a draft intake + shareable token.
export async function POST(req: Request) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    let businessName: string | undefined = body.businessName
    const scraperLeadId: string | undefined = body.scraperLeadId
    let recipientEmail: string | undefined = body.recipientEmail
    const sendEmail: boolean = body.sendEmail !== false && !!recipientEmail

    const origin = new URL(req.url).origin
    let requestedProduct = body.requestedProduct as 'full' | 'widget' | undefined

    if (scraperLeadId && !requestedProduct) {
      const supabase = getSupabaseAdmin()
      const { data: lead } = await supabase
        .from('scraper_leads')
        .select('pipeline, email, business_name')
        .eq('id', scraperLeadId)
        .maybeSingle()
      if (lead) {
        requestedProduct = pipelineToRequestedProduct(lead.pipeline)
        if (!recipientEmail && lead.email) recipientEmail = lead.email
        if (!businessName && lead.business_name) businessName = lead.business_name
      }
    }

    const result = await createDraftIntake({
      source: scraperLeadId ? 'scraper' : 'admin',
      businessName: businessName || null,
      scraperLeadId: scraperLeadId || null,
      requestedProduct: requestedProduct ?? 'full',
      verificationEmail: recipientEmail || null,
      emailVerifiedAt: scraperLeadId ? new Date().toISOString() : null,
      sendEmail,
      recipientEmail: recipientEmail || null,
      siteOrigin: origin,
    })

    return NextResponse.json({
      success: true,
      id: result.id,
      token: result.token,
      url: result.url,
    })
  } catch (error) {
    console.error('Intake create error:', error)
    const message = error instanceof Error ? error.message : 'Failed to create intake link'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
