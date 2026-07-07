import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { applyProWidgetConfig } from '@/lib/provision/applyProWidgetConfig'
import type { WidgetConfigHints } from '@/lib/ai/buildWidgetConfig'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'

/**
 * POST /api/intake/pro/start
 *
 * Creates a widget-only intake record pre-loaded with `widget_config_hints`
 * from the ClosetQuote Pro intake wizard. This is called immediately after
 * the user creates their Supabase auth account in step 5 of the wizard.
 *
 * Applies widget_config_hints to the contractor's existing trial row immediately
 * (signup already created contractor_settings). A provision job is recorded for
 * audit/retry but the calculator is ready before redirect to /dashboard.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const businessName = typeof body.businessName === 'string' ? body.businessName.trim() : ''
    const phone = typeof body.phone === 'string' ? body.phone.trim() : null
    const brandColor =
      typeof body.brandColor === 'string' ? body.brandColor.trim() : null
    const widgetConfigHints = body.widgetConfigHints ?? null
    const subscribePlan = body.subscribePlan === 'yearly' ? 'yearly' : 'monthly'

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const token = randomUUID().replace(/-/g, '')

    const { data, error } = await supabase
      .from('prospect_intakes')
      .insert({
        token,
        status: 'submitted',
        source: 'public',
        requested_product: 'widget',
        provisioning_mode: 'auto',
        business_name: businessName || null,
        verification_email: email,
        contact_email: email,
        contact_phone: phone || null,
        primary_color_hex: brandColor || null,
        widget_config_hints: widgetConfigHints,
        industry:
          typeof widgetConfigHints?.industry === 'string'
            ? widgetConfigHints.industry.trim() || null
            : null,
        // Services array for dashboard display
        services: Array.isArray(widgetConfigHints?.services)
          ? widgetConfigHints.services
          : [],
        other_services: widgetConfigHints?.otherServices || null,
        // Widget-only uses the standard tier defaults (no deposit / build payment).
        submitted_at: new Date().toISOString(),
        email_verified_at: new Date().toISOString(),
      })
      .select('id, token')
      .single()

    if (error) {
      console.error('[pro/start] Insert failed:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let configured = false
    let targetContractorId = body.contractorId

    // Fallback if client doesn't send contractorId (older client versions)
    if (!targetContractorId) {
      const { data: contractorList } = await supabase
        .from('contractor_settings')
        .select('id')
        .eq('contact_email', email)
        .order('created_at', { ascending: false })
        .limit(1)
      
      targetContractorId = contractorList?.[0]?.id
    }

    if (targetContractorId && widgetConfigHints) {
      try {
        await applyProWidgetConfig(
          targetContractorId,
          widgetConfigHints as WidgetConfigHints
        )
        configured = true
        await supabase
          .from('prospect_intakes')
          .update({
            status: 'built',
            provisioned_contractor_id: targetContractorId,
          })
          .eq('id', data.id)
      } catch (applyErr) {
        console.error('[pro/start] applyProWidgetConfig failed:', applyErr)
      }
    }

    // Audit trail + cron retry if inline apply failed (e.g. transient Gemini error).
    await supabase
      .from('provision_jobs')
      .insert({
        intake_id: data.id,
        status: configured ? 'succeeded' : 'pending',
        mode: 'widget',
        attempts: configured ? 1 : 0,
        finished_at: configured ? new Date().toISOString() : null,
      })
      .then(({ error: jobErr }) => {
        if (jobErr) console.error('[pro/start] Failed to enqueue provision job:', jobErr)
      })

    return NextResponse.json({
      success: true,
      intakeId: data.id,
      contractorId: targetContractorId,
      configured,
      message: configured
        ? 'Your calculator is ready in your dashboard.'
        : 'Your calculator is being configured — you\'ll see it in your dashboard shortly.',
    })
  } catch (err) {
    console.error('[pro/start] Error:', err)
    const message = err instanceof Error ? err.message : 'Failed to start setup'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
