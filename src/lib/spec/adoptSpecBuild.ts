import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { Resend } from 'resend'
import { platformFromEmail } from '@/lib/fromEmail'
import { logSystemAction } from '@/lib/admin'
import { ensureTenantAuthUser } from '@/lib/provision/ensureTenantAuthUser'
import { syncTenantLaunchAccess } from '@/lib/intake/syncTenantLaunchAccess'
import { formatUsd } from '@/lib/intake/tiers'
import { publicAppOrigin } from '@/lib/urls'
import { priceSpecOffer } from '@/lib/spec/specOffer'
import type { SpecBuildRow } from '@/lib/spec/types'

/**
 * Turn an accepted spec build into a real, discounted AI Premium customer.
 *
 * Everything up to this point was deliberately anonymous: the tenant runs under
 * a platform placeholder address, no account exists, no email has been sent.
 * This is the first moment the business has actually asked for any of it, and
 * it is where their real details enter the system.
 *
 * Ordered so a crash leaves a recoverable state rather than a half-adopted one,
 * and every step is idempotent, because a retry after a partial failure is the
 * normal case rather than the exception. Nothing here re-provisions: the site,
 * the subdomain and the bespoke build all survive untouched, which is the whole
 * value of having built it in advance.
 */

export type AdoptSpecBuildResult =
  | { ok: true; intakeId: string; tenantId: string; payUrl: string | null; amountCents: number }
  | { ok: false; reason: string }

export async function adoptSpecBuild(
  build: SpecBuildRow,
  realEmail: string
): Promise<AdoptSpecBuildResult> {
  const email = realEmail.trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, reason: 'A valid email is required to adopt a spec build.' }
  }
  if (!build.intake_id || !build.tenant_id) {
    return { ok: false, reason: 'This build has no site to hand over.' }
  }

  const supabase = getSupabaseAdmin()

  // Refuse if that address already owns a tenant. Reassigning it here would
  // point an existing customer's login at this site.
  const { data: clash } = await supabase
    .from('tenants')
    .select('id')
    .eq('owner_email', email)
    .neq('id', build.tenant_id)
    .maybeSingle()
  if (clash) {
    return {
      ok: false,
      reason: `${email} already has an account with us. Hand this over manually so nothing is overwritten.`,
    }
  }

  const pricing = priceSpecOffer(build.offer_discount_bps)
  const amountCents = build.offer_total_cents ?? pricing.offerCents
  if (amountCents <= 0) {
    return { ok: false, reason: 'The offer has no price on it.' }
  }

  // 1. The intake becomes a normal discounted AI Premium row. `source` stays
  //    'spec' — it is the provenance, and it is what keeps the auto-approve
  //    guard honest if this site is ever redesigned again.
  const now = new Date().toISOString()
  const { error: intakeError } = await supabase
    .from('prospect_intakes')
    .update({
      contact_email: email,
      notification_email: email,
      verification_email: email,
      tier_total_cents: amountCents,
      deposit_required_cents: 0,
      deposit_status: 'waived',
      // Stands in for "Approve preview": the owner has seen the site and said
      // yes, which is exactly what that stamp records. Without it
      // syncTenantLaunchAccess leaves them on the holding page with no way to pay.
      preview_approved_at: now,
      updated_at: now,
    })
    .eq('id', build.intake_id)
  if (intakeError) return { ok: false, reason: intakeError.message }

  // 2. Ownership moves to the real address.
  const { data: tenant } = await supabase
    .from('tenants')
    .select('widget_id, business_name')
    .eq('id', build.tenant_id)
    .maybeSingle()
  const widgetId = (tenant as { widget_id?: string } | null)?.widget_id
  const businessName =
    (tenant as { business_name?: string } | null)?.business_name || build.business_name

  await supabase
    .from('tenants')
    .update({ owner_email: email, updated_at: now })
    .eq('id', build.tenant_id)

  // 3. Their login, created through the same helper provisioning uses.
  const auth = widgetId
    ? await ensureTenantAuthUser(supabase, {
        ownerEmail: email,
        tenantId: build.tenant_id,
        widgetId,
      })
    : null

  // 4. Retire the placeholder account if one somehow exists. Spec builds
  //    provision with createAuthUser:false so normally there is none, but a
  //    build from before that flag — or one adopted twice — could leave one.
  if (build.placeholder_owner_email) {
    try {
      const { data: users } = await supabase.auth.admin.listUsers()
      const placeholder = users.users.find((u) => u.email === build.placeholder_owner_email)
      if (placeholder) await supabase.auth.admin.deleteUser(placeholder.id)
    } catch (err) {
      console.error('[adoptSpecBuild] could not remove placeholder user', err)
    }
  }

  // 5. Open the launch paywall. syncTenantLaunchAccess reads preview_approved_at
  //    (set above) and moves the site to awaiting_launch_payment with a pay URL.
  const launch = await syncTenantLaunchAccess({
    tenantId: build.tenant_id,
    intakeId: build.intake_id,
  }).catch((err) => {
    console.error('[adoptSpecBuild] syncTenantLaunchAccess failed', err)
    return null
  })

  await supabase
    .from('spec_builds')
    .update({
      placeholder_owner_email: null,
      status_reason: null,
      updated_at: now,
    })
    .eq('id', build.id)

  await sendAdoptionEmail({
    to: email,
    businessName,
    payUrl: launch?.launchPayUrl ?? null,
    tempPassword: auth?.tempPassword ?? null,
    amountCents,
    listCents: pricing.listCents,
  })

  await logSystemAction({
    action: 'spec_build.adopted',
    targetType: 'spec_build',
    targetId: build.id,
    metadata: { tenantId: build.tenant_id, amountCents },
  })

  return {
    ok: true,
    intakeId: build.intake_id,
    tenantId: build.tenant_id,
    payUrl: launch?.launchPayUrl ?? null,
    amountCents,
  }
}

/**
 * The first email this business ever receives from us — written on the
 * assumption they have seen the site and nothing else.
 */
async function sendAdoptionEmail(opts: {
  to: string
  businessName: string
  payUrl: string | null
  tempPassword: string | null
  amountCents: number
  listCents: number
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) return
  const loginUrl = `${publicAppOrigin().replace(/\/$/, '')}/login`

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: platformFromEmail(),
      to: [opts.to],
      subject: `${opts.businessName} — your website`,
      html: `
        <h1>Good news, ${opts.businessName}</h1>
        <p>Thanks for saying yes. Your site is built and waiting — here is everything you need.</p>
        <p><strong>What you pay:</strong> ${formatUsd(opts.amountCents)}
        <span style="color:#888;text-decoration:line-through;">${formatUsd(opts.listCents)}</span>
        — the half-price AI Premium build we offered.</p>
        ${
          opts.payUrl
            ? `<p><a href="${opts.payUrl}" style="background:#4f46e5;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Pay and take it live</a></p>`
            : `<p>We will send your payment link shortly.</p>`
        }
        ${
          opts.tempPassword
            ? `<p>Your login, so you can change anything on the site:</p>
               <p><strong>Where:</strong> <a href="${loginUrl}">${loginUrl}</a><br/>
               <strong>Email:</strong> ${opts.to}<br/>
               <strong>Temporary password:</strong> ${opts.tempPassword}</p>
               <p><em>You will be asked to change this the first time you log in.</em></p>`
            : ''
        }
        <p>Reply to this email with anything you want changed — wording, photos, pages, the lot.</p>
      `,
    })
  } catch (err) {
    // Never fail an adoption because an email bounced; the admin can resend.
    console.error('[adoptSpecBuild] welcome email failed', err)
  }
}
