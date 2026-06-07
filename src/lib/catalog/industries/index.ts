import type { IndustryDef } from '@/lib/catalog/types'
import { CUSTOM_CLOSETS_GROUPS, CUSTOM_CLOSETS_SERVICES } from '@/lib/catalog/industries/custom-closets'
import { PLUMBING_INDUSTRY } from '@/lib/catalog/industries/plumbing'
import { HVAC_INDUSTRY } from '@/lib/catalog/industries/hvac'
import { LANDSCAPING_INDUSTRY } from '@/lib/catalog/industries/landscaping'
import { TOWING_INDUSTRY } from '@/lib/catalog/industries/towing'
import { ROOFING_INDUSTRY } from '@/lib/catalog/industries/roofing'
import { ELECTRICAL_INDUSTRY } from '@/lib/catalog/industries/electrical'
import { PEST_CONTROL_INDUSTRY } from '@/lib/catalog/industries/pest-control'
import { PRESSURE_WASHING_INDUSTRY } from '@/lib/catalog/industries/pressure-washing'
import { TREE_SERVICE_INDUSTRY } from '@/lib/catalog/industries/tree-service'
import { PAINTING_INDUSTRY } from '@/lib/catalog/industries/painting'

export const CUSTOM_CLOSETS_INDUSTRY: IndustryDef = {
  slug: 'custom-closets',
  label: 'Custom Closets & Storage',
  keywords: ['closet', 'storage', 'organization', 'custom closet', 'walk-in'],
  serviceGroups: [...CUSTOM_CLOSETS_GROUPS],
  defaultThemes: ['luxury-minimal', 'modern-office', 'functional-utility', 'classic-warm'],
  defaultLayouts: ['standard', 'portfolio-first', 'conversion-focus', 'gallery-showcase'],
  services: CUSTOM_CLOSETS_SERVICES,
}

export const INDUSTRIES: IndustryDef[] = [
  CUSTOM_CLOSETS_INDUSTRY,
  PLUMBING_INDUSTRY,
  HVAC_INDUSTRY,
  LANDSCAPING_INDUSTRY,
  TOWING_INDUSTRY,
  ROOFING_INDUSTRY,
  ELECTRICAL_INDUSTRY,
  PEST_CONTROL_INDUSTRY,
  PRESSURE_WASHING_INDUSTRY,
  TREE_SERVICE_INDUSTRY,
  PAINTING_INDUSTRY,
]

export const ALL_SERVICES = INDUSTRIES.flatMap((i) => i.services)

export const INDUSTRY_BY_SLUG = Object.fromEntries(
  INDUSTRIES.map((i) => [i.slug, i])
) as Record<(typeof INDUSTRIES)[number]['slug'], IndustryDef>
