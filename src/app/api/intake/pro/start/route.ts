import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'

/**
 * POST /api/intake/pro/start
 *
 * Creates a widget-only intake record pre-loaded with `widget_config_hints`
 * from the ClosetQuote Pro intake wizard. This is called immediately after
 * the user creates their Supabase auth account in step 5 of the wizard.
 *
 * A background provisioning job picks up the intake and calls buildWidgetConfig()
 * to generate a bespoke calculator config from the hints.
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

    // Enqueue a widget provisioning job so the AI config runs async.
    // Uses the same job queue the admin cron processes.
    await supabase.from('provision_jobs').insert({
      intake_id: data.id,
      status: 'pending',
      mode: 'widget',
      attempts: 0,
    }).then(({ error: jobErr }) => {
      if (jobErr) console.error('[pro/start] Failed to enqueue provision job:', jobErr)
    })

    return NextResponse.json({
      success: true,
      intakeId: data.id,
      message: 'Your calculator is being configured — you\'ll see it in your dashboard shortly.',
    })
  } catch (err) {
    console.error('[pro/start] Error:', err)
    const message = err instanceof Error ? err.message : 'Failed to start setup'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
