import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'
import {
  assertCheckoutAllowed,
  type IntakeCheckoutKind,
} from '@/lib/intake/intakePaymentStage'
import {
  depositForTier,
  depositStatusForTier,
  formatUsd,
  getTierEntry,
  type IntakeTierSlug,
} from '@/lib/intake/tiers'
import { resolveOneTimePriceId, stripePriceEnv } from '@/lib/stripeCatalog'

export async function createIntakeCheckoutSession(opts: {
  row: ProspectIntakeRow
  token: string
  kind: IntakeCheckoutKind
  origin: string
}): Promise<{ url: string; sessionId: string }> {
  const { token, kind, origin } = opts
  let row = opts.row
  const gate = assertCheckoutAllowed(row, kind)
  if (gate) throw new Error(gate)

  // Defensive self-heal: `intake_tier` defaults to 'standard' with
  // `tier_total_cents`/`deposit_required_cents` defaulting to 0 for any row
  // that never went through explicit tier selection (e.g. a prospect who
  // never clicked a TierPicker card). Never let a stale/zero total slip
  // through into a real Stripe charge — recompute from the tier catalog
  // before pricing the session.
  if (kind !== 'maintenance' && row.tier_total_cents <= 0) {
    const tierSlug: IntakeTierSlug = row.intake_tier === 'ai_premium' ? 'ai_premium' : 'standard'
    const entry = getTierEntry(tierSlug)
    if (!entry) throw new Error('Unable to resolve tier pricing for checkout')
    const depositStatus = depositStatusForTier(tierSlug, row.deposit_paid_cents, entry.depositCents)
    const admin = getSupabaseAdmin()
    await admin
      .from('prospect_intakes')
      .update({
        intake_tier: tierSlug,
        tier_total_cents: entry.totalCents,
        deposit_required_cents: entry.depositCents,
        deposit_status: depositStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
    row = {
      ...row,
      intake_tier: tierSlug,
      tier_total_cents: entry.totalCents,
      deposit_required_cents: entry.depositCents,
      deposit_status: depositStatus,
    }
  }

  const stripe = getStripe()
  const env = stripePriceEnv()
  const returnUrl = `${origin}/intake/${token}`
  const email = row.contact_email || row.notification_email || row.verification_email || undefined

  let session: Stripe.Checkout.Session

  if (kind === 'maintenance') {
    const plan = row.maintenance_plan === 'yearly' ? 'yearly' : 'monthly'
    const priceId =
      plan === 'yearly' ? env.siteMaintenanceYearly : env.siteMaintenanceMonthly
    if (!priceId) {
      throw new Error('Site maintenance Stripe price is not configured')
    }
    if (!row.provisioned_contractor_id) {
      throw new Error('Contractor account not linked yet — finish provisioning first')
    }

    session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        kind: 'intake_maintenance',
        intake_id: row.id,
        intake_token: token,
        contractor_id: row.provisioned_contractor_id,
        maintenance_plan: plan,
      },
      success_url: `${returnUrl}?payment=success&kind=maintenance&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl}?payment=cancelled`,
    })
  } else {
    const catalogDeposit = depositForTier(row.tier_total_cents)
    const remainder = Math.max(0, row.tier_total_cents - row.deposit_required_cents)

    let priceId: string | null = null
    let amountCents = 0
    let catalogCents = 0
    let metaKind = ''
    let productName = ''
    let description = ''

    if (kind === 'deposit') {
      amountCents = row.deposit_required_cents
      catalogCents = catalogDeposit
      priceId = resolveOneTimePriceId(env.aiPremiumDeposit, amountCents, catalogCents)
      metaKind = 'intake_deposit'
      productName = 'ClosetQuote AI Premium — 30% deposit'
      description = `30% upfront (${formatUsd(amountCents)}) of ${formatUsd(row.tier_total_cents)} total.`
    } else if (kind === 'balance') {
      amountCents = remainder
      catalogCents = remainder
      priceId = resolveOneTimePriceId(env.aiPremiumBalance, amountCents, catalogCents)
      metaKind = 'intake_balance'
      productName = 'ClosetQuote AI Premium — balance'
      description = `Balance (${formatUsd(amountCents)}) due before launch.`
    } else {
      amountCents = row.tier_total_cents
      catalogCents = row.tier_total_cents
      priceId = resolveOneTimePriceId(env.standardBuild, amountCents, catalogCents)
      metaKind = 'intake_standard_build'
      productName = 'ClosetQuote Standard site build'
      description = `One-time build (${formatUsd(amountCents)}) — pay when satisfied.`
    }

    // Never create a $0 (or negative) one-time-payment session — a real
    // build/deposit/balance charge should always have a positive amount.
    // Maintenance (subscription) is priced entirely by its Stripe price ID
    // and is exempt from this check.
    if (amountCents <= 0) {
      throw new Error(`Invalid checkout amount for ${kind}: ${amountCents} cents`)
    }

    const lineItems = priceId
      ? [{ price: priceId, quantity: 1 }]
      : [
          {
            price_data: {
              currency: 'usd',
              unit_amount: amountCents,
              product_data: { name: productName, description },
            },
            quantity: 1,
          },
        ]

    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      line_items: lineItems,
      metadata: {
        kind: metaKind,
        intake_id: row.id,
        intake_token: token,
        tier: row.intake_tier,
      },
      success_url: `${returnUrl}?payment=success&kind=${kind}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl}?payment=cancelled`,
    })

    if (kind === 'deposit') {
      const admin = getSupabaseAdmin()
      await admin
        .from('prospect_intakes')
        .update({
          deposit_status: 'pending',
          stripe_checkout_session_id: session.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
    }
  }

  if (!session.url) throw new Error('Failed to create checkout session')
  return { url: session.url, sessionId: session.id }
}
