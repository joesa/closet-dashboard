import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getSupabaseServer } from '@/lib/supabase-server'
import { applyProWidgetConfig } from '@/lib/provision/applyProWidgetConfig'
import type { WidgetConfigHints } from '@/lib/ai/buildWidgetConfig'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'

/**
 * POST /api/intake/pro/start
 *
 * Creates a widget-only intake record pre-loaded with `widget_config_hints`
 * from the DitchTheForm Pro intake wizard. This is called immediately after
 * the user creates their Supabase auth account in step 5 of the wizard.
 *
 * Applies widget_config_hints to the contractor's existing trial row immediately
 * (signup already created contractor_settings). A provision job is recorded for
 * audit/retry but the calculator is ready before redirect to /dashboard.
 *
 * REQUIRES A SESSION, and the target contractor is derived from it.
 *
 * This route used to be unauthenticated while calling applyProWidgetConfig,
 * which DELETEs the target contractor's rooms, add-ons and finishes and
 * rewrites their settings (applyProWidgetConfig.ts:248-250). It took the
 * contractor from `body.contractorId` — an id that is public by design, since
 * it ships inside the embed snippet on every customer's website — and fell back
 * to a lookup by `body.email`. Either shape let an anonymous caller wipe any
 * contractor's pricing. The wizard calls this immediately after signing the
 * user in, so the session is always present on the legitimate path.
 */
export async function POST(req: Request) {
  try {
    const session = await getSupabaseServer()
    const {
      data: { user },
    } = await session.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Sign in to finish setup.' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))

    // The session owns the identity. A body-supplied email is accepted only as
    // a display value when it matches; it can never select a different account.
    const email = (user.email ?? '').trim().toLowerCase()
    const businessName = typeof body.businessName === 'string' ? body.businessName.trim() : ''
    const phone = typeof body.phone === 'string' ? body.phone.trim() : null
    const brandColor =
      typeof body.brandColor === 'string' ? body.brandColor.trim() : null
    const widgetConfigHints = body.widgetConfigHints ?? null
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

    // Resolved from the session, never from the request body. Prefer the
    // user_id link written by /api/contractor/bootstrap; fall back to the
    // session's own email for rows created before that link existed.
    const { data: ownRow } = await supabase
      .from('contractor_settings')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let targetContractorId: string | undefined = ownRow?.id
    if (!targetContractorId && email) {
      const { data: byEmail } = await supabase
        .from('contractor_settings')
        .select('id')
        .eq('contact_email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      targetContractorId = byEmail?.id
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
