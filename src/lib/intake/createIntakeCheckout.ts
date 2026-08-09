import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'
import {
  assertCheckoutAllowed,
  type IntakeCheckoutKind,
} from '@/lib/intake/intakePaymentStage'
import {
  depositStatusForTier,
  formatUsd,
  getTierEntry,
  type IntakeTierSlug,
} from '@/lib/intake/tiers'
import { resolveOneTimePriceId, stripePriceEnv } from '@/lib/stripeCatalog'

export type OneTimeCheckoutKind = Exclude<IntakeCheckoutKind, 'maintenance'>

export type OneTimeCheckoutPricing = {
  amountCents: number
  /** The catalog list amount for this kind, or -1 when it cannot be resolved. */
  catalogCents: number
  /** Non-null only when charging exactly list price; otherwise inline price_data. */
  priceId: string | null
  metaKind: string
  productName: string
  description: string
}

type OneTimePriceEnv = {
  aiPremiumDeposit?: string
  aiPremiumBalance?: string
  standardBuild?: string
}

/** Which catalog entry prices this row — independent of any discount on it. */
function catalogTierSlug(row: Pick<ProspectIntakeRow, 'intake_tier'>): IntakeTierSlug {
  return row.intake_tier === 'ai_premium' ? 'ai_premium' : 'standard'
}

/**
 * Price a one-time intake charge.
 *
 * The load-bearing rule: `catalogCents` comes from the tier CATALOG, never from
 * the row. `resolveOneTimePriceId` reuses the pre-made Stripe price only when we
 * are charging exactly list price. Deriving both sides from the row made them
 * equal by construction, so a discounted row silently reused the full-price
 * Stripe price and charged list price while the UI showed the discount. A
 * catalog entry that cannot be resolved yields -1, which never matches — that
 * forces inline `price_data`, the safe direction when we cannot prove the
 * amount is list price.
 */
export function resolveOneTimeCheckoutPricing(
  row: Pick<
    ProspectIntakeRow,
    'intake_tier' | 'tier_total_cents' | 'deposit_required_cents'
  >,
  kind: OneTimeCheckoutKind,
  env: OneTimePriceEnv
): OneTimeCheckoutPricing {
  const catalog = getTierEntry(catalogTierSlug(row))
  const remainder = Math.max(0, row.tier_total_cents - row.deposit_required_cents)

  if (kind === 'deposit') {
    const amountCents = row.deposit_required_cents
    const catalogCents = catalog?.depositCents ?? -1
    return {
      amountCents,
      catalogCents,
      priceId: resolveOneTimePriceId(env.aiPremiumDeposit, amountCents, catalogCents),
      metaKind: 'intake_deposit',
      productName: 'DitchTheForm AI Premium — 30% deposit',
      description: `30% deposit (${formatUsd(amountCents)}) of ${formatUsd(row.tier_total_cents)} total. Unlocks AI image studio and starts your site build. Balance due only after you approve the preview before launch; deposit refunded if you decline.`,
    }
  }

  if (kind === 'balance') {
    const catalogCents = catalog?.remainderCents ?? -1
    return {
      amountCents: remainder,
      catalogCents,
      priceId: resolveOneTimePriceId(env.aiPremiumBalance, remainder, catalogCents),
      metaKind: 'intake_balance',
      productName: 'DitchTheForm AI Premium — balance',
      description: `Balance (${formatUsd(remainder)}) due before launch.`,
    }
  }

  const amountCents = row.tier_total_cents
  const catalogCents = catalog?.totalCents ?? -1
  return {
    amountCents,
    catalogCents,
    priceId: resolveOneTimePriceId(env.standardBuild, amountCents, catalogCents),
    metaKind: 'intake_standard_build',
    productName: 'DitchTheForm Standard site build',
    description: `One-time build (${formatUsd(amountCents)}) — pay when satisfied.`,
  }
}

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
    const { amountCents, priceId, metaKind, productName, description } =
      resolveOneTimeCheckoutPricing(row, kind, env)

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
