import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const TREE_IMG = 'https://images.unsplash.com/photo-1513836279014-a89e7a76ae86'
const STUMP_IMG = 'https://images.unsplash.com/photo-1598902108852-0e981b7a6088'

function tree(
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
    industry: 'tree-service',
    keywords,
    widgetCategory: label,
    recommendedThemes: themes,
    recommendedLayouts: layouts,
    catalog,
  }
}

const NATURAL_THEMES = ['rustic-pantry', 'coastal-climate', 'classic-warm', 'historic-classic'] as const

export const TREE_SERVICE_SERVICES: ServiceDef[] = [
  tree(
    'Tree Removal',
    'Removal',
    [...NATURAL_THEMES, 'functional-utility'],
    ['trust-builder', 'conversion-focus', 'local-expert'],
    { image: TREE_IMG, description: 'Safe removal of hazardous or unwanted trees.' },
    ['cut down tree', 'tree take down', 'dead tree']
  ),
  tree(
    'Tree Trimming & Pruning',
    'Care',
    [...NATURAL_THEMES],
    ['local-expert', 'portfolio-first', 'storyteller'],
    { image: TREE_IMG, description: 'Healthy pruning that shapes and protects trees.' },
    ['tree trim', 'pruning', 'canopy raise']
  ),
  tree(
    'Emergency Storm Cleanup',
    'Emergency',
    ['brutalist', 'functional-utility', 'coastal-climate', 'rustic-pantry'],
    ['minimalist-lead', 'conversion-focus', 'trust-builder'],
    { image: TREE_IMG, description: 'Fallen trees and storm debris cleared fast.' },
    ['storm damage', 'fallen tree', 'emergency tree']
  ),
  tree(
    'Stump Grinding',
    'Stumps',
    ['functional-utility', 'rustic-pantry', 'modern-office', 'classic-warm'],
    ['compact-quote', 'conversion-focus', 'local-expert'],
    { image: STUMP_IMG, description: 'Stump grinding that clears space for landscaping.' },
    ['stump removal', 'stump grind']
  ),
  tree(
    'Tree Health & Disease Treatment',
    'Health',
    ['coastal-climate', 'classic-warm', 'rustic-pantry', 'minimalist-zen'],
    ['trust-builder', 'storyteller', 'local-expert'],
    { image: TREE_IMG, description: 'Diagnostics and treatment for diseased trees.' },
    ['tree disease', 'emerald ash borer', 'tree doctor']
  ),
  tree(
    'Land Clearing',
    'Clearing',
    ['brutalist', 'functional-utility', 'garage-industrial', 'coastal-climate'],
    ['visual-impact', 'conversion-focus', 'trust-builder'],
    { image: TREE_IMG, description: 'Lot and acreage clearing for builds and pastures.' },
    ['land clearing', 'brush clearing', 'lot clearing']
  ),
  tree(
    'Cabling & Bracing',
    'Health',
    ['historic-classic', 'classic-warm', 'coastal-climate', 'rustic-pantry'],
    ['trust-builder', 'storyteller', 'local-expert'],
    { image: TREE_IMG, description: 'Structural support for mature and heritage trees.' },
    ['cabling', 'bracing', 'split tree']
  ),
  tree(
    'Crane-Assisted Removal',
    'Removal',
    ['brutalist', 'commercial-pro', 'functional-utility', 'modern-office'],
    ['trust-builder', 'portfolio-first', 'conversion-focus'],
    { image: TREE_IMG, description: 'Crane removals for tight spaces and large trees.' },
    ['crane tree removal', 'large tree']
  ),
  tree(
    'Firewood & Mulch Delivery',
    'Add-ons',
    ['rustic-pantry', 'coastal-climate', 'classic-warm', 'historic-classic'],
    ['local-expert', 'standard', 'conversion-focus'],
    { image: STUMP_IMG, description: 'Seasoned firewood and mulch from local processing.' },
    ['firewood', 'mulch delivery', 'wood chips']
  ),
  tree(
    'Commercial Tree Service',
    'Commercial',
    ['commercial-pro', 'modern-office', 'functional-utility', 'coastal-climate'],
    ['trust-builder', 'conversion-focus', 'compact-quote'],
    { image: TREE_IMG, description: 'HOA and commercial property tree maintenance.' },
    ['hoa tree', 'commercial arborist', 'property management']
  ),
]

export const TREE_SERVICE_GROUPS = [
  'Removal',
  'Care',
  'Emergency',
  'Stumps',
  'Health',
  'Clearing',
  'Add-ons',
  'Commercial',
] as const

export const TREE_SERVICE_INDUSTRY: IndustryDef = {
  slug: 'tree-service',
  label: 'Tree Service',
  keywords: ['tree', 'arborist', 'stump', 'trimming', 'land clearing'],
  serviceGroups: [...TREE_SERVICE_GROUPS],
  defaultThemes: ['rustic-pantry', 'coastal-climate', 'classic-warm', 'functional-utility'],
  defaultLayouts: ['local-expert', 'trust-builder', 'conversion-focus', 'portfolio-first'],
  services: TREE_SERVICE_SERVICES,
}
