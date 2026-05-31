import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { buildTemplateProvisionPayload } from '@/lib/provision/buildTemplateSiteConfig'
import { assertNoDuplicateProvision } from '@/lib/provision/dedupe'
import { runAutoQaChecks, maybeAutoApproveTenant } from '@/lib/provision/autoQa'
import { resolveSubdomain } from '@/lib/provision/resolveSubdomain'
import { provisionTenant } from '@/lib/provision/provisionTenant'
import {
  ProvisionReviewError,
  type IntakeRowForProvision,
} from '@/lib/provision/types'

export type ProvisionJobRow = {
  id: string
  intake_id: string
  status: string
  mode: string
  attempts: number
}

export async function provisionFromIntakeJob(
  job: ProvisionJobRow,
  loginOrigin: string
): Promise<void> {
  const admin = getSupabaseAdmin()

  const { data: intake, error } = await admin
    .from('prospect_intakes')
    .select('*')
    .eq('id', job.intake_id)
    .single()

  if (error || !intake) {
    throw new Error('Intake not found')
  }

  const row = intake as IntakeRowForProvision
  const businessName = row.business_name?.trim()
  if (!businessName) {
    throw new Error('Business name required')
  }

  const ownerEmail = (row.notification_email || row.contact_email || '').trim()
  if (!ownerEmail) {
    throw new Error('Contact email required')
  }

  await assertNoDuplicateProvision({
    businessName,
    ownerEmail,
    contactPhone: row.contact_phone,
  })

  const mode = job.mode === 'widget' ? 'widget' : 'full'
  const payload = buildTemplateProvisionPayload(row)
  const subdomain = mode === 'full' ? await resolveSubdomain(businessName) : undefined

  if (mode === 'full') {
    const qa = runAutoQaChecks({
      businessName,
      contactEmail: row.contact_email ?? null,
      services: row.services ?? null,
      subdomain: subdomain!,
    })
    if (!qa.passed) {
      console.warn('Auto-QA warnings:', qa.reasons.join(', '))
    }
  }

  const siteStatus =
    mode === 'widget' ? 'widget_only' : ('pending_approval' as const)

  const result = await provisionTenant({
    ...payload,
    mode,
    subdomain,
    siteStatus,
    loginOrigin,
    sendWelcomeEmail: true,
  })

  if (mode === 'full') {
    const qa = runAutoQaChecks({
      businessName,
      contactEmail: row.contact_email ?? null,
      services: row.services ?? null,
      subdomain: subdomain!,
    })
    await maybeAutoApproveTenant(result.tenantId, qa)
  }
}

export function classifyProvisionError(err: unknown): 'needs_review' | 'failed' {
  if (err instanceof ProvisionReviewError) return 'needs_review'
  return 'failed'
}
