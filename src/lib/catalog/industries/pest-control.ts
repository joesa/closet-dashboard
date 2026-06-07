import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const PEST_IMG = 'https://images.unsplash.com/photo-1530836369250-59d4a2154fc6'
const TERMITE_IMG = 'https://images.unsplash.com/photo-1583337130417-3346a1be5905'

function pest(
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
    industry: 'pest-control',
    keywords,
    widgetCategory: label,
    recommendedThemes: themes,
    recommendedLayouts: layouts,
    catalog,
  }
}

const CLEAN_THEMES = ['laundry-clean', 'modern-office', 'minimalist-zen', 'classic-warm'] as const

export const PEST_CONTROL_SERVICES: ServiceDef[] = [
  pest(
    'General Pest Control',
    'Residential',
    [...CLEAN_THEMES],
    ['trust-builder', 'local-expert', 'conversion-focus'],
    { image: PEST_IMG, description: 'Ongoing protection from common household pests.' },
    ['ants', 'roaches', 'spiders', 'pest control']
  ),
  pest(
    'Termite Inspection & Treatment',
    'Termites',
    ['classic-warm', 'historic-classic', 'modern-office', 'functional-utility'],
    ['trust-builder', 'storyteller', 'conversion-focus'],
    { image: TERMITE_IMG, description: 'Termite inspections and treatment plans that protect your investment.' },
    ['termite', 'wood damage', 'wdo']
  ),
  pest(
    'Rodent Control',
    'Rodents',
    ['functional-utility', 'modern-office', 'brutalist', 'classic-warm'],
    ['minimalist-lead', 'trust-builder', 'local-expert'],
    { image: PEST_IMG, description: 'Mice and rat exclusion with lasting results.' },
    ['mice', 'rats', 'rodent', 'attic rodents']
  ),
  pest(
    'Mosquito & Tick Treatment',
    'Outdoor',
    ['coastal-climate', 'rustic-pantry', 'modern-office', 'minimalist-zen'],
    ['local-expert', 'conversion-focus', 'standard'],
    { image: PEST_IMG, description: 'Yard treatments that cut mosquitoes and ticks.' },
    ['mosquito', 'tick', 'yard spray']
  ),
  pest(
    'Bed Bug Treatment',
    'Specialty',
    ['laundry-clean', 'modern-office', 'minimalist-zen', 'functional-utility'],
    ['trust-builder', 'compact-quote', 'conversion-focus'],
    { image: PEST_IMG, description: 'Discrete, effective bed bug elimination programs.' },
    ['bed bug', 'bedbug']
  ),
  pest(
    'Wildlife Removal',
    'Wildlife',
    ['rustic-pantry', 'coastal-climate', 'classic-warm', 'functional-utility'],
    ['local-expert', 'storyteller', 'trust-builder'],
    { image: PEST_IMG, description: 'Humane removal of raccoons, squirrels, and bats.' },
    ['raccoon', 'squirrel', 'bat', 'wildlife']
  ),
  pest(
    'Commercial Pest Control',
    'Commercial',
    ['commercial-pro', 'modern-office', 'functional-utility', 'minimalist-zen'],
    ['trust-builder', 'conversion-focus', 'compact-quote'],
    { image: PEST_IMG, description: 'IPM programs for restaurants, offices, and warehouses.' },
    ['restaurant pest', 'commercial ipm']
  ),
  pest(
    'One-Time Pest Treatment',
    'Residential',
    [...CLEAN_THEMES],
    ['compact-quote', 'conversion-focus', 'minimalist-lead'],
    { image: PEST_IMG, description: 'Targeted one-time treatments when pests appear.' },
    ['one time', 'single treatment', 'spray service']
  ),
  pest(
    'Preventative Maintenance Plans',
    'Plans',
    ['modern-office', 'classic-warm', 'minimalist-zen', 'laundry-clean'],
    ['trust-builder', 'local-expert', 'conversion-focus'],
    { image: PEST_IMG, description: 'Quarterly plans that keep pests from coming back.' },
    ['maintenance plan', 'quarterly', 'subscription']
  ),
  pest(
    'Wasp & Bee Removal',
    'Stinging insects',
    ['coastal-climate', 'rustic-pantry', 'functional-utility', 'modern-office'],
    ['minimalist-lead', 'local-expert', 'conversion-focus'],
    { image: PEST_IMG, description: 'Safe nest removal and bee relocation when possible.' },
    ['wasp', 'hornet', 'bee nest', 'yellow jacket']
  ),
]

export const PEST_CONTROL_GROUPS = [
  'Residential',
  'Termites',
  'Rodents',
  'Outdoor',
  'Specialty',
  'Wildlife',
  'Commercial',
  'Plans',
  'Stinging insects',
] as const

export const PEST_CONTROL_INDUSTRY: IndustryDef = {
  slug: 'pest-control',
  label: 'Pest Control',
  keywords: ['pest', 'exterminator', 'termite', 'rodent', 'bug'],
  serviceGroups: [...PEST_CONTROL_GROUPS],
  defaultThemes: ['modern-office', 'laundry-clean', 'classic-warm', 'minimalist-zen'],
  defaultLayouts: ['trust-builder', 'local-expert', 'conversion-focus', 'compact-quote'],
  services: PEST_CONTROL_SERVICES,
}
