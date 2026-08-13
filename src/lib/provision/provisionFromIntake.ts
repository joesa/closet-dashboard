import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { buildTemplateProvisionPayload } from '@/lib/provision/buildTemplateSiteConfig'
import { assertNoDuplicateProvision } from '@/lib/provision/dedupe'
import { runAutoQaChecks } from '@/lib/provision/autoQa'
import {
  autoApproveTenantSite,
  startAutoLaunchRedesign,
} from '@/lib/launch/autoLaunch'
import {
  onSpecBuildProvisioned,
  onSpecBuildRedesignFinished,
} from '@/lib/spec/specBuildHooks'
import { resolveSubdomain } from '@/lib/provision/resolveSubdomain'
import { provisionTenant } from '@/lib/provision/provisionTenant'
import { depositSatisfied } from '@/lib/intake/intakeTierGates'
import {
  buildAiProvisionPayload,
  validateAiPremiumReady,
} from '@/lib/intake/buildAiProvisionPayload'
import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'
import {
  ProvisionReviewError,
  type IntakeRowForProvision,
} from '@/lib/provision/types'
import {
  buildWidgetConfig,
  type WidgetConfigHints,
} from '@/lib/ai/buildWidgetConfig'
import { applyProWidgetConfig } from '@/lib/provision/applyProWidgetConfig'
import { resolveIndustrySlug, INDUSTRY_CONFIGS } from '@/lib/catalog/serviceCatalog'
import { DEFAULT_DOMAIN_CONFIG, type PricingModel } from '@/lib/rooms'
import { loadMarketBounds } from '@/lib/marketBounds'

function resolvePricingModel(hints: WidgetConfigHints): PricingModel {
  switch (hints.pricingModel) {
    case 'fixed':
    case 'flat_tiered':
      return 'flat_tiered'
    case 'base_plus_distance':
      return 'base_plus_distance'
    case 'per_unit':
    case 'linear_ft':
    default:
      return 'per_unit'
  }
}

function resolveTierNames(hints: WidgetConfigHints) {
  return {
    basic: hints.tierNames?.basic?.trim() || 'Basic',
    standard: hints.tierNames?.standard?.trim() || 'Standard',
    premium: hints.tierNames?.premium?.trim() || 'Premium',
  }
}

function resolveDomainConfig(hints: WidgetConfigHints) {
  const industrySlug = resolveIndustrySlug({
    industry: hints.industry,
    services: hints.services,
    other_services: hints.otherServices,
  })
  const industry = INDUSTRY_CONFIGS[industrySlug]
  return {
    ...DEFAULT_DOMAIN_CONFIG,
    categoryLabel: industry?.categoryLabel || DEFAULT_DOMAIN_CONFIG.categoryLabel,
    unitLabel: industry?.unitLabel || DEFAULT_DOMAIN_CONFIG.unitLabel,
    unitAbbrev: industry?.unitAbbrev || DEFAULT_DOMAIN_CONFIG.unitAbbrev,
    tierLabel: industry?.tierLabel || DEFAULT_DOMAIN_CONFIG.tierLabel,
    pricingModel: industry?.pricingModel || resolvePricingModel(hints),
    unitMin: industry?.unitMin || DEFAULT_DOMAIN_CONFIG.unitMin,
    unitMax: industry?.unitMax || DEFAULT_DOMAIN_CONFIG.unitMax,
    baseFee: industry?.baseFee || DEFAULT_DOMAIN_CONFIG.baseFee,
  }
}

export type ProvisionJobRow = {
  id: string
  intake_id: string
  status: string
  mode: string
  attempts: number
}

async function buildAiWidgetConfigFromHints(
  hints: WidgetConfigHints | null | undefined,
  rowId: string,
  metro?: string | null
): Promise<Record<string, unknown> | undefined> {
  if (!hints) return undefined
  console.log(`[provisionFromIntake] Building bespoke widget config for ${rowId}`)

  const slug = resolveIndustrySlug({
    industry: hints.industry,
    services: hints.services,
    other_services: hints.otherServices,
  })
  const marketBounds = await loadMarketBounds({
    metro: metro || hints.metro,
    services: hints.services,
    industrySlug: slug,
  }).catch((err) => {
    console.warn('[provisionFromIntake] marketBounds skipped:', err)
    return []
  })

  const generated = await buildWidgetConfig({
    ...hints,
    marketBounds,
  }).catch((err) => {
    console.error('[provisionFromIntake] buildWidgetConfig failed, using defaults:', err)
    return null
  })
  if (!generated) return undefined
  return {
    customRooms: generated.customRooms,
    customAddOns: generated.customAddOns,
    customFinishes: generated.customFinishes,
    _disabledDefaultRooms: generated.disabledDefaultRooms,
    _disableDefaultFinishes: generated.disableDefaultFinishes,
    tierNames: generated.tierNames || resolveTierNames(hints),
    tierColors: generated.tierColors,
    industry: hints.industry?.trim() || undefined,
    domainConfig: resolveDomainConfig(hints),
  }
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

  const ownerEmail = (row.contact_email || row.notification_email || '').trim()
  if (!ownerEmail) {
    throw new Error('Contact email required')
  }

  await assertNoDuplicateProvision({
    businessName,
    ownerEmail,
    contactPhone: row.contact_phone,
  })

  const mode = job.mode === 'widget' ? 'widget' : job.mode === 'ai_full' ? 'ai_full' : 'full'
  const hints = row.widget_config_hints as WidgetConfigHints | null | undefined

  if (mode === 'ai_full') {
    const aiErr = validateAiPremiumReady(row)
    if (aiErr) throw new Error(aiErr)
    if (!depositSatisfied(row)) {
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

    const aiWidgetConfigFromHints = payload.aiWidgetConfig
      ? undefined
      : await buildAiWidgetConfigFromHints(
          hints,
          row.id,
          row.service_area || row.address_locality
        )

    const result = await provisionTenant({
      ...payload,
      intakeId: row.id,
      loginOrigin,
      // Honour what buildAiProvisionPayload decided. Re-asserting `true` here is
      // what would send a cold lead their credentials despite the payload
      // saying otherwise.
      sendWelcomeEmail: payload.sendWelcomeEmail ?? true,
      createAuthUser: payload.createAuthUser ?? true,
      ...(aiWidgetConfigFromHints ? { aiWidgetConfig: aiWidgetConfigFromHints } : {}),
    })

    // Record the tenant on the spec build before anything else can report back
    // — every later hook finds the build by tenant_id, so this has to land
    // first or they all silently match nothing.
    await onSpecBuildProvisioned(row.id, result.tenantId).catch((err) =>
      console.error('[provisionFromIntake] spec build provisioned hook failed', row.id, err)
    )

    await kickAutoLaunch(result.tenantId)
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

  // For widget-only provisioning: if the intake has widget_config_hints from
  // the Pro intake wizard, use Gemini to generate a bespoke calculator config.
  // Falls back gracefully to the generic defaults if hints are absent.
  let aiWidgetConfig: Record<string, unknown> | undefined = undefined
  if (mode === 'widget') {
    const { data: intakeWithHints } = await getSupabaseAdmin()
      .from('prospect_intakes')
      .select('widget_config_hints, services, contact_phone, primary_color_hex, business_name')
      .eq('id', row.id)
      .maybeSingle()

    const widgetHints = intakeWithHints?.widget_config_hints as WidgetConfigHints | null
    if (widgetHints) {
      // Pro signup already has a trial contractor_settings row — apply hints there
      // instead of provisioning a duplicate tenant.
      const { data: existingContractor } = await getSupabaseAdmin()
        .from('contractor_settings')
        .select('id')
        .eq('contact_email', ownerEmail)
        .maybeSingle()

      if (existingContractor?.id) {
        console.log(
          `[provisionFromIntake] Applying widget config to existing contractor ${existingContractor.id}`
        )
        const slug = resolveIndustrySlug({
          industry: widgetHints.industry,
          services: widgetHints.services,
          other_services: widgetHints.otherServices,
        })
        const marketBounds = await loadMarketBounds({
          metro: row.service_area || row.address_locality,
          services: widgetHints.services,
          industrySlug: slug,
          state: row.address_region,
        }).catch(() => [])
        await applyProWidgetConfig(existingContractor.id, {
          ...widgetHints,
          metro: row.service_area || row.address_locality || undefined,
          marketBounds,
        })
        await getSupabaseAdmin()
          .from('prospect_intakes')
          .update({
            status: 'built',
            provisioned_contractor_id: existingContractor.id,
          })
          .eq('id', row.id)
        return
      }

      aiWidgetConfig = await buildAiWidgetConfigFromHints(
        widgetHints,
        row.id,
        row.service_area || row.address_locality
      )
    }
  } else {
    aiWidgetConfig = await buildAiWidgetConfigFromHints(
      hints,
      row.id,
      row.service_area || row.address_locality
    )
  }

  const result = await provisionTenant({
    ...payload,
    mode: mode === 'widget' ? 'widget' : 'full',
    subdomain,
    isSpecBuild: row.source === 'spec',
    siteStatus,
    loginOrigin,
    sendWelcomeEmail: true,
    intakeId: row.id,
    ...(aiWidgetConfig ? { aiWidgetConfig } : {}),
  })

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
    await kickAutoLaunch(result.tenantId)
  }
}

/**
 * Hand a freshly provisioned tenant to auto-launch: queue its first Full
 * redesign, and only if that cannot start (no worker, kill switch off, already
 * ran) reveal the site on the engine template instead. Never fail provisioning
 * over this — the tenant exists either way and an admin can take it from here.
 */
async function kickAutoLaunch(tenantId: string): Promise<void> {
  try {
    const started = await startAutoLaunchRedesign(tenantId)
    if (!started) {
      await autoApproveTenantSite(tenantId, { reason: 'redesign_unavailable' })
      // A spec build hears back through autoApproveTenantSite for every other
      // outcome, but that function returns early for spec builds by design, so
      // this branch would leave one sitting in 'provisioning' forever with no
      // signal. Observed on a live run with AUTO_LAUNCH_REDESIGN=false.
      // published:false is accurate — the site is on the engine template, not a
      // bespoke build, which is exactly what an admin needs to be told before
      // showing it to anyone.
      await onSpecBuildRedesignFinished(tenantId, {
        published: false,
        publishError: 'The redesign did not start, so the site is on the engine template.',
      }).catch((err) =>
        console.error('[provisionFromIntake] spec build hook failed', tenantId, err)
      )
    }
  } catch (err) {
    console.error('[provisionFromIntake] auto-launch failed', tenantId, err)
  }
}

export function classifyProvisionError(err: unknown): 'needs_review' | 'failed' {
  if (err instanceof ProvisionReviewError) return 'needs_review'
  return 'failed'
}
