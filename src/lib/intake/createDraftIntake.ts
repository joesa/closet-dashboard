import { randomUUID } from 'crypto'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { sendIntakeLinkEmail } from '@/lib/intake/sendIntakeLinkEmail'
import {
  depositStatusForTier,
  formatUsd,
  getTierEntry,
  type IntakeTierSlug,
} from '@/lib/intake/tiers'

export type IntakeSource = 'admin' | 'public' | 'scraper'
export type RequestedProduct = 'full' | 'widget'
export type ProvisioningMode = 'auto' | 'manual'

export type CreateDraftIntakeInput = {
  source: IntakeSource
  businessName?: string | null
  scraperLeadId?: string | null
  requestedProduct?: RequestedProduct
  /** auto = template cron after submit; manual = admin AI build only */
  provisioningMode?: ProvisioningMode
  verificationEmail?: string | null
  emailVerifiedAt?: string | null
  sendEmail?: boolean
  recipientEmail?: string | null
  siteOrigin: string
  /** Pre-select Standard or AI Premium on the intake form. */
  initialTier?: IntakeTierSlug
  maintenancePlan?: 'monthly' | 'yearly'
}

export type CreateDraftIntakeResult = {
  id: string
  token: string
  url: string
}

export async function createDraftIntake(
  input: CreateDraftIntakeInput
): Promise<CreateDraftIntakeResult> {
  const token = randomUUID().replace(/-/g, '')
  const supabase = getSupabaseAdmin()

  const tierSlug = input.initialTier
  // Always populate tier pricing at creation time — even when no explicit
  // tier is chosen yet — so `tier_total_cents`/`deposit_required_cents`
  // never sit at the raw DB column default of 0 (which would price a real
  // Stripe checkout session at $0 if the prospect never visits TierPicker
  // before paying). Defaults to Standard, matching `intake_tier`'s own
  // column default.
  const tierEntry = getTierEntry(tierSlug ?? 'standard')
  const insertRow: Record<string, unknown> = {
    token,
    status: 'draft',
    source: input.source,
    business_name: input.businessName?.trim() || null,
    scraper_lead_id: input.scraperLeadId || null,
    requested_product: input.requestedProduct ?? 'full',
    provisioning_mode: input.provisioningMode ?? 'auto',
    verification_email: input.verificationEmail?.trim() || null,
    email_verified_at: input.emailVerifiedAt || null,
  }
  if (tierEntry) {
    insertRow.intake_tier = tierEntry.slug
    insertRow.tier_total_cents = tierEntry.totalCents
    insertRow.deposit_required_cents = tierEntry.depositCents
    insertRow.deposit_status = depositStatusForTier(
      tierEntry.slug,
      0,
      tierEntry.depositCents
    )
  }
  // Only mark the tier as an explicit, already-made decision when the
  // caller actually passed one (get-started flow) — not when it silently
  // defaulted to Standard above just to keep pricing fields non-zero.
  if (input.initialTier) {
    insertRow.tier_selected_at = new Date().toISOString()
  }
  if (input.maintenancePlan) {
    insertRow.maintenance_plan = input.maintenancePlan
  }

  const { data, error } = await supabase
    .from('prospect_intakes')
    .insert(insertRow)
    .select('id, token')
    .single()

  if (error) throw error

  const tierQuery = tierSlug ? `?tier=${tierSlug}` : ''
  const url = `${input.siteOrigin.replace(/\/$/, '')}/intake/${data.token}${tierQuery}`

  if (input.sendEmail && input.recipientEmail) {
    const isPublic = input.source === 'public'
    const baseVerifyUrl = `${input.siteOrigin.replace(/\/$/, '')}/api/intake/public/verify?token=${data.token}`
    const standardEntry = getTierEntry('standard')
    const premiumEntry = getTierEntry('ai_premium')

    await sendIntakeLinkEmail({
      to: input.recipientEmail,
      businessName: input.businessName,
      intakeUrl: url,
      verifyUrl: isPublic ? baseVerifyUrl : undefined,
      verifyStandardUrl: isPublic ? `${baseVerifyUrl}&tier=standard` : undefined,
      verifyPremiumUrl: isPublic ? `${baseVerifyUrl}&tier=ai_premium` : undefined,
      standardTotalLabel: standardEntry ? formatUsd(standardEntry.totalCents) : undefined,
      premiumTotalLabel: premiumEntry ? formatUsd(premiumEntry.totalCents) : undefined,
      premiumDepositLabel: premiumEntry ? formatUsd(premiumEntry.depositCents) : undefined,
      premiumRemainderLabel: premiumEntry
        ? formatUsd(premiumEntry.totalCents - premiumEntry.depositCents)
        : undefined,
    })
  }

  return { id: data.id, token: data.token, url }
}

/** Map scraper pipeline label to product mode. */
export function pipelineToRequestedProduct(pipeline: string | null | undefined): RequestedProduct {
  const p = (pipeline || '').trim().toUpperCase()
  if (p === 'A' || p.includes('PIPELINE A') || p.includes('WIDGET')) return 'widget'
  return 'full'
}

/**
 * Re-sends the original verification email for a pending public draft intake
 * — reuses the SAME token/row (never creates a new one, unlike
 * createDraftIntake) so the earlier email's link keeps working too. Returns
 * `true` only when an actual email was sent; callers should still show a
 * generic "check your email" message either way (don't leak whether the
 * address has a pending signup).
 */
export async function resendIntakeVerificationEmail(
  email: string,
  siteOrigin: string
): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  const { data: row } = await supabase
    .from('prospect_intakes')
    .select('id, token, business_name')
    .eq('verification_email', email)
    .eq('source', 'public')
    .eq('status', 'draft')
    .is('email_verified_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!row) return false

  const origin = siteOrigin.replace(/\/$/, '')
  const baseVerifyUrl = `${origin}/api/intake/public/verify?token=${row.token}`
  const standardEntry = getTierEntry('standard')
  const premiumEntry = getTierEntry('ai_premium')

  await sendIntakeLinkEmail({
    to: email,
    businessName: row.business_name,
    intakeUrl: `${origin}/intake/${row.token}`,
    verifyUrl: baseVerifyUrl,
    verifyStandardUrl: `${baseVerifyUrl}&tier=standard`,
    verifyPremiumUrl: `${baseVerifyUrl}&tier=ai_premium`,
    standardTotalLabel: standardEntry ? formatUsd(standardEntry.totalCents) : undefined,
    premiumTotalLabel: premiumEntry ? formatUsd(premiumEntry.totalCents) : undefined,
    premiumDepositLabel: premiumEntry ? formatUsd(premiumEntry.depositCents) : undefined,
    premiumRemainderLabel: premiumEntry
      ? formatUsd(premiumEntry.totalCents - premiumEntry.depositCents)
      : undefined,
  })

  return true
}
