import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const LAWN_IMG = 'https://images.unsplash.com/photo-1558904541-efa843a96f01'
const GARDEN_IMG = 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b'
const HARDSCAPE_IMG = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c'
const IRRIGATION_IMG = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64'

function land(
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
    industry: 'landscaping',
    keywords,
    widgetCategory: label,
    recommendedThemes: themes,
    recommendedLayouts: layouts,
    catalog,
  }
}

const NATURAL_THEMES = ['rustic-pantry', 'coastal-climate', 'classic-warm', 'minimalist-zen'] as const
const SHOWCASE_LAYOUTS = ['portfolio-first', 'gallery-showcase', 'visual-impact'] as const

export const LANDSCAPING_SERVICES: ServiceDef[] = [
  land(
    'Lawn Care & Mowing',
    'Lawn',
    [...NATURAL_THEMES, 'functional-utility'],
    ['local-expert', 'conversion-focus', 'standard'],
    { image: LAWN_IMG, description: 'Weekly mowing and lawn maintenance that stays green.' },
    ['mowing', 'lawn service', 'grass cutting']
  ),
  land(
    'Landscape Design & Install',
    'Design',
    ['luxury-minimal', 'coastal-climate', 'rustic-pantry', 'classic-warm'],
    [...SHOWCASE_LAYOUTS, 'storyteller'],
    { image: GARDEN_IMG, description: 'Custom landscape design from concept to planting.' },
    ['landscape design', 'planting', 'garden design']
  ),
  land(
    'Hardscaping & Patios',
    'Hardscape',
    ['brutalist', 'classic-warm', 'coastal-climate', 'historic-classic'],
    [...SHOWCASE_LAYOUTS, 'trust-builder'],
    { image: HARDSCAPE_IMG, description: 'Patios, walkways, and retaining walls built to last.' },
    ['patio', 'pavers', 'retaining wall', 'walkway']
  ),
  land(
    'Irrigation & Sprinklers',
    'Irrigation',
    ['modern-office', 'functional-utility', 'coastal-climate', 'minimalist-zen'],
    ['trust-builder', 'conversion-focus', 'local-expert'],
    { image: IRRIGATION_IMG, description: 'Sprinkler install, repair, and smart watering.' },
    ['sprinkler', 'irrigation repair', 'drip system']
  ),
  land(
    'Tree & Shrub Care',
    'Plants',
    [...NATURAL_THEMES, 'historic-classic'],
    ['local-expert', 'trust-builder', 'storyteller'],
    { image: GARDEN_IMG, description: 'Pruning, fertilization, and plant health programs.' },
    ['shrub trimming', 'hedge', 'plant care']
  ),
  land(
    'Mulching & Bed Maintenance',
    'Maintenance',
    ['rustic-pantry', 'coastal-climate', 'classic-warm', 'pantry-fresh'],
    ['local-expert', 'standard', 'conversion-focus'],
    { image: GARDEN_IMG, description: 'Fresh mulch and tidy beds season after season.' },
    ['mulch', 'flower beds', 'weeding']
  ),
  land(
    'Outdoor Lighting',
    'Lighting',
    ['sleek-entertainment', 'luxury-minimal', 'coastal-climate', 'modern-office'],
    ['visual-impact', 'portfolio-first', 'gallery-showcase'],
    { image: HARDSCAPE_IMG, description: 'Landscape lighting that highlights your property.' },
    ['path lights', 'uplighting', 'outdoor lights']
  ),
  land(
    'Sod & Turf Installation',
    'Lawn',
    ['coastal-climate', 'functional-utility', 'classic-warm', 'modern-office'],
    ['conversion-focus', 'portfolio-first', 'trust-builder'],
    { image: LAWN_IMG, description: 'Instant curb appeal with professional sod installs.' },
    ['sod', 'artificial turf', 'new lawn']
  ),
  land(
    'Seasonal Cleanup',
    'Maintenance',
    ['rustic-pantry', 'mudroom-family', 'coastal-climate', 'functional-utility'],
    ['local-expert', 'conversion-focus', 'compact-quote'],
    { image: LAWN_IMG, description: 'Spring and fall cleanups that reset your yard.' },
    ['leaf removal', 'spring cleanup', 'fall cleanup']
  ),
  land(
    'Commercial Landscaping',
    'Commercial',
    ['commercial-pro', 'modern-office', 'functional-utility', 'coastal-climate'],
    ['trust-builder', 'conversion-focus', 'compact-quote'],
    { image: LAWN_IMG, description: 'Grounds maintenance for HOAs, retail, and offices.' },
    ['hoa landscaping', 'commercial grounds']
  ),
]

export const LANDSCAPING_GROUPS = [
  'Lawn',
  'Design',
  'Hardscape',
  'Irrigation',
  'Plants',
  'Maintenance',
  'Lighting',
  'Commercial',
] as const

export const LANDSCAPING_INDUSTRY: IndustryDef = {
  slug: 'landscaping',
  label: 'Landscaping',
  keywords: ['landscap', 'lawn', 'yard', 'garden', 'hardscape', 'mowing'],
  serviceGroups: [...LANDSCAPING_GROUPS],
  defaultThemes: ['coastal-climate', 'rustic-pantry', 'classic-warm', 'modern-office'],
  defaultLayouts: ['portfolio-first', 'local-expert', 'conversion-focus', 'gallery-showcase'],
  services: LANDSCAPING_SERVICES,
}
