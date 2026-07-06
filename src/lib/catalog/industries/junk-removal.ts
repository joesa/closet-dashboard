import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const JUNK_IMG = 'https://images.unsplash.com/photo-1558618047-f4cf4f1d82af'
const DUMPSTER_IMG = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64'

function junk(
  label: string,
  group: string,
  themes: ServiceDef['recommendedThemes'],
  layouts: ServiceDef['recommendedLayouts'],
  catalog: ServiceDef['catalog'],
  keywords: string[] = []
): ServiceDef {
  return {
    label,
    group,
    industry: 'junk-removal',
    keywords,
    widgetCategory: label,
    recommendedThemes: themes,
    recommendedLayouts: layouts,
    catalog,
  }
}

const JUNK_THEMES = ['urban-reclaim', 'functional-utility', 'modern-office', 'brutalist'] as const
const JUNK_LAYOUTS = ['conversion-focus', 'compact-quote', 'minimalist-lead', 'trust-builder'] as const

export const JUNK_REMOVAL_SERVICES: ServiceDef[] = [
  junk(
    'Full-Service Junk Removal',
    'Removal',
    [...JUNK_THEMES],
    [...JUNK_LAYOUTS, 'local-expert'],
    { image: JUNK_IMG, description: 'We load it, haul it, and dispose of it — you point, we take it.' },
    ['junk removal', 'haul away', 'junk hauling', 'clutter removal', 'junk pick up']
  ),
  junk(
    'Furniture & Appliance Removal',
    'Removal',
    [...JUNK_THEMES],
    [...JUNK_LAYOUTS],
    { image: JUNK_IMG, description: 'Old sofas, mattresses, and appliances removed from any room.' },
    ['furniture removal', 'old sofa', 'mattress removal', 'appliance haul', 'couch pickup']
  ),
  junk(
    'Estate Cleanout',
    'Cleanouts',
    ['urban-reclaim', 'classic-warm', 'functional-utility', 'care-comfort'],
    ['trust-builder', 'conversion-focus', 'local-expert', 'storyteller'],
    { image: JUNK_IMG, description: 'Compassionate whole-home estate cleanouts — we handle everything.' },
    ['estate cleanout', 'estate clear out', 'house cleanout', 'downsizing cleanout']
  ),
  junk(
    'Construction Debris Removal',
    'Debris',
    ['urban-reclaim', 'brutalist', 'functional-utility', 'commercial-pro'],
    ['conversion-focus', 'compact-quote', 'trust-builder'],
    { image: JUNK_IMG, description: 'Drywall scraps, lumber, tile, and post-reno debris hauled away fast.' },
    ['debris removal', 'construction waste', 'demo cleanup', 'renovation waste', 'scrap haul']
  ),
  junk(
    'Dumpster Rental',
    'Rentals',
    ['urban-reclaim', 'functional-utility', 'commercial-pro', 'brutalist'],
    ['compact-quote', 'conversion-focus', 'local-expert', 'trust-builder'],
    { image: DUMPSTER_IMG, description: 'Roll-off dumpsters delivered and picked up on your schedule.' },
    ['dumpster rental', 'roll off dumpster', 'dumpster drop off', 'bin rental']
  ),
  junk(
    'Yard & Outdoor Debris Removal',
    'Outdoor',
    ['urban-reclaim', 'functional-utility', 'coastal-climate', 'classic-warm'],
    ['conversion-focus', 'local-expert', 'compact-quote', 'trust-builder'],
    { image: JUNK_IMG, description: 'Brush piles, storm debris, old sheds, and yard waste hauled away.' },
    ['yard debris', 'brush removal', 'storm cleanup', 'shed removal', 'yard cleanout']
  ),
  junk(
    'Commercial & Office Cleanout',
    'Commercial',
    ['commercial-pro', 'urban-reclaim', 'modern-office', 'functional-utility'],
    ['trust-builder', 'compact-quote', 'conversion-focus', 'local-expert'],
    { image: JUNK_IMG, description: 'Office furniture, equipment, and filing cabinets hauled in one trip.' },
    ['office cleanout', 'commercial cleanout', 'store cleanout', 'retail haul']
  ),
]

export const JUNK_REMOVAL_INDUSTRY: IndustryDef = {
  slug: 'junk-removal',
  label: 'Junk Removal & Hauling',
  keywords: ['junk removal', 'haul away', 'junk hauling', 'cleanout', 'debris removal', 'dumpster'],
  serviceGroups: ['Removal', 'Cleanouts', 'Debris', 'Rentals', 'Outdoor', 'Commercial'],
  defaultThemes: ['urban-reclaim', 'functional-utility', 'modern-office', 'brutalist'],
  defaultLayouts: ['conversion-focus', 'compact-quote', 'minimalist-lead', 'trust-builder'],
  services: JUNK_REMOVAL_SERVICES,
}
