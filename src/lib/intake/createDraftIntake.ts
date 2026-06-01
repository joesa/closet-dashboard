import { randomUUID } from 'crypto'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { sendIntakeLinkEmail } from '@/lib/intake/sendIntakeLinkEmail'
import {
  depositStatusForTier,
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
  const tierEntry = tierSlug ? getTierEntry(tierSlug) : undefined
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
    await sendIntakeLinkEmail({
      to: input.recipientEmail,
      businessName: input.businessName,
      intakeUrl: url,
      verifyUrl:
        input.source === 'public'
          ? `${input.siteOrigin.replace(/\/$/, '')}/api/intake/public/verify?token=${data.token}`
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
