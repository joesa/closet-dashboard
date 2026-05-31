import { randomUUID } from 'crypto'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { sendIntakeLinkEmail } from '@/lib/intake/sendIntakeLinkEmail'

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

  const { data, error } = await supabase
    .from('prospect_intakes')
    .insert({
      token,
      status: 'draft',
      source: input.source,
      business_name: input.businessName?.trim() || null,
      scraper_lead_id: input.scraperLeadId || null,
      requested_product: input.requestedProduct ?? 'full',
      provisioning_mode: input.provisioningMode ?? 'auto',
      verification_email: input.verificationEmail?.trim() || null,
      email_verified_at: input.emailVerifiedAt || null,
    })
    .select('id, token')
    .single()

  if (error) throw error

  const url = `${input.siteOrigin.replace(/\/$/, '')}/intake/${data.token}`

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
