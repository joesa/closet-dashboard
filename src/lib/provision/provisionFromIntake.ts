import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { buildTemplateProvisionPayload } from '@/lib/provision/buildTemplateSiteConfig'
import { assertNoDuplicateProvision } from '@/lib/provision/dedupe'
import { runAutoQaChecks, maybeAutoApproveTenant } from '@/lib/provision/autoQa'
import { resolveSubdomain } from '@/lib/provision/resolveSubdomain'
import { provisionTenant } from '@/lib/provision/provisionTenant'
import {
  buildAiProvisionPayload,
  validateAiPremiumReady,
} from '@/lib/intake/buildAiProvisionPayload'
import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'
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

async function loadIntakeForJob(intakeId: string): Promise<ProspectIntakeRow> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('prospect_intakes')
    .select('*')
    .eq('id', intakeId)
    .single()

  if (error || !data) throw new Error('Intake not found')
  return data as ProspectIntakeRow
}

export async function provisionFromIntakeJob(
  job: ProvisionJobRow,
  loginOrigin: string
): Promise<void> {
  const row = await loadIntakeForJob(job.intake_id)
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

  const mode = job.mode === 'widget' ? 'widget' : job.mode === 'ai_full' ? 'ai_full' : 'full'

  if (mode === 'ai_full') {
    const aiErr = validateAiPremiumReady(row)
    if (aiErr) throw new Error(aiErr)
    if (row.deposit_required_cents > 0 && row.deposit_status !== 'paid') {
      throw new Error('AI Premium deposit not paid')
    }

    const subdomain = await resolveSubdomain(businessName)
    const payload = await buildAiProvisionPayload(row, loginOrigin, subdomain)

    const qa = runAutoQaChecks({
      businessName,
      contactEmail: row.contact_email ?? null,
      services: row.services ?? null,
      subdomain,
    })
    if (!qa.passed) {
      console.warn('Auto-QA warnings:', qa.reasons.join(', '))
    }

    const result = await provisionTenant({
      ...payload,
      intakeId: row.id,
      loginOrigin,
      sendWelcomeEmail: true,
    })

    await maybeAutoApproveTenant(result.tenantId, qa)
    return
  }

  const legacyRow = row as unknown as IntakeRowForProvision
  const payload = await buildTemplateProvisionPayload(legacyRow)
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
    mode: mode === 'widget' ? 'widget' : 'full',
    subdomain,
    siteStatus,
    loginOrigin,
    sendWelcomeEmail: true,
    intakeId: row.id,
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
