import {
  getIndustry,
  isLowConfidenceResolution,
  resolveIndustrySlug,
} from '@/lib/catalog/serviceCatalog'
import {
  createCustomIndustry,
  findCustomIndustryByLabel,
  type CustomIndustryRecord,
} from '@/lib/catalog/customIndustries'
import { generateCustomIndustry } from '@/lib/ai/generateCustomIndustry'
import type { EngagementModel } from '@/lib/catalog/types'
import type { LayoutSlug, ThemeSlug } from '@/lib/catalog/sitePresentationCatalog'

export type ResolveIndustrySource =
  | 'catalog'
  | 'custom-existing'
  | 'custom-new'
  | 'custom-new-fallback'
  | 'custom-new-unsaved'

export type ResolveIndustryForSetupResult = {
  source: ResolveIndustrySource
  industrySlug: string | null
  label: string
  services: string[]
  defaultThemes: ThemeSlug[]
  defaultLayouts: LayoutSlug[]
  engagementModel: EngagementModel
  /** True when the trade lives in custom_industries (not the static catalog). */
  isCustom: boolean
}

function catalogResult(slug: ReturnType<typeof resolveIndustrySlug>): ResolveIndustryForSetupResult {
  const industry = getIndustry(slug)
  return {
    source: 'catalog',
    industrySlug: slug,
    label: industry.label,
    services: industry.services.map((s) => s.label),
    defaultThemes: [...industry.defaultThemes],
    defaultLayouts: [...industry.defaultLayouts],
    engagementModel: industry.engagementModel ?? 'quote',
    isCustom: false,
  }
}

function customRecordResult(
  record: CustomIndustryRecord,
  source: ResolveIndustrySource
): ResolveIndustryForSetupResult {
  return {
    source,
    industrySlug: record.slug,
    label: record.label,
    services: record.services.map((s) => s.label),
    defaultThemes: record.defaultThemes,
    defaultLayouts: record.defaultLayouts,
    engagementModel: record.engagementModel,
    isCustom: true,
  }
}

/**
 * Resolve an industry label for onboarding/intake setup:
 * 1. Confident static-catalog match → reuse catalog services + presentation pools.
 * 2. Existing custom_industries row → reuse persisted definition.
 * 3. Genuinely new trade → Gemini generates template (services, themes, layouts,
 *    engagement model) and persists for future contractors/admins.
 */
export async function resolveIndustryForSetup(input: {
  industryText: string
  businessName?: string
  otherServices?: string
  sourceIntakeId?: string
}): Promise<ResolveIndustryForSetupResult> {
  const industryText = input.industryText.trim()
  if (!industryText) {
    throw new Error('industry is required')
  }

  const lowConfidence = isLowConfidenceResolution({ industry: industryText })
  if (!lowConfidence) {
    const slug = resolveIndustrySlug({ industry: industryText })
    return catalogResult(slug)
  }

  const existing = await findCustomIndustryByLabel(industryText)
  if (existing) {
    return customRecordResult(existing, 'custom-existing')
  }

  const generated = await generateCustomIndustry({
    industryText,
    businessName: input.businessName,
    otherServices: input.otherServices,
  })

  try {
    const created = await createCustomIndustry({
      ...generated.def,
      sourceIntakeId: input.sourceIntakeId,
    })
    return customRecordResult(
      created,
      generated.source === 'gemini' ? 'custom-new' : 'custom-new-fallback'
    )
  } catch (error) {
    console.error('Failed to persist custom industry:', error)
    return {
      source: 'custom-new-unsaved',
      industrySlug: null,
      label: generated.def.label,
      services: generated.def.services.map((s) => s.label),
      defaultThemes: generated.def.defaultThemes,
      defaultLayouts: generated.def.defaultLayouts,
      engagementModel: generated.def.engagementModel,
      isCustom: true,
    }
  }
}
