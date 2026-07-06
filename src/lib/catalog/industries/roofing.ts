import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const ROOF_IMG = 'https://images.unsplash.com/photo-1632778149955-e89f660a341d'
const STORM_IMG = 'https://images.unsplash.com/photo-1527482797697-879aa1374734'

function roof(
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
    industry: 'roofing',
    keywords,
    widgetCategory: label,
    recommendedThemes: themes,
    recommendedLayouts: layouts,
    catalog,
  }
}

const TRUST_THEMES = ['classic-warm', 'coastal-climate', 'historic-classic', 'modern-office'] as const

export const ROOFING_SERVICES: ServiceDef[] = [
  roof(
    'Roof Replacement',
    'Replacement',
    [...TRUST_THEMES, 'luxury-minimal'],
    ['portfolio-first', 'trust-builder', 'conversion-focus'],
    { image: ROOF_IMG, description: 'Full tear-off and replacement with premium materials.' },
    ['new roof', 're-roof', 'roof install']
  ),
  roof(
    'Roof Repair',
    'Repair',
    ['coastal-climate', 'classic-warm', 'functional-utility', 'modern-office'],
    ['minimalist-lead', 'conversion-focus', 'local-expert'],
    { image: ROOF_IMG, description: 'Leak repair and storm damage fixes done right.' },
    ['roof leak', 'shingle repair', 'patch']
  ),
  roof(
    'Storm & Hail Damage',
    'Emergency',
    ['brutalist', 'coastal-climate', 'functional-utility', 'classic-warm'],
    ['minimalist-lead', 'trust-builder', 'conversion-focus'],
    { image: STORM_IMG, description: 'Insurance-ready storm damage inspection and repair.' },
    ['hail', 'storm damage', 'insurance claim']
  ),
  roof(
    'Shingle Roofing',
    'Materials',
    [...TRUST_THEMES, 'rustic-pantry'],
    ['portfolio-first', 'gallery-showcase', 'trust-builder'],
    { image: ROOF_IMG, description: 'Architectural and designer shingle installations.' },
    ['asphalt shingle', 'architectural shingle']
  ),
  roof(
    'Metal Roofing',
    'Materials',
    ['brutalist', 'modern-office', 'coastal-climate', 'garage-industrial'],
    ['visual-impact', 'portfolio-first', 'trust-builder'],
    { image: ROOF_IMG, description: 'Standing seam and metal roofs built for decades.' },
    ['standing seam', 'metal roof']
  ),
  roof(
    'Flat & Commercial Roofing',
    'Commercial',
    ['commercial-pro', 'brutalist', 'modern-office', 'functional-utility'],
    ['trust-builder', 'conversion-focus', 'compact-quote'],
    { image: ROOF_IMG, description: 'TPO, EPDM, and commercial flat roof systems.' },
    ['tpo', 'flat roof', 'commercial roof']
  ),
  roof(
    'Gutter Install & Repair',
    'Gutters',
    ['coastal-climate', 'classic-warm', 'functional-utility', 'modern-office'],
    ['local-expert', 'conversion-focus', 'standard'],
    { image: ROOF_IMG, description: 'Seamless gutters and downspout solutions.' },
    ['gutter', 'downspout', 'gutter guard']
  ),
  roof(
    'Roof Inspection',
    'Inspection',
    ['classic-warm', 'modern-office', 'minimalist-zen', 'coastal-climate'],
    ['trust-builder', 'local-expert', 'compact-quote'],
    { image: ROOF_IMG, description: 'Detailed inspections for buyers, sellers, and maintenance.' },
    ['roof inspection', 'home inspection']
  ),
  roof(
    'Skylight Install & Repair',
    'Skylights',
    ['modern-office', 'luxury-minimal', 'coastal-climate', 'classic-warm'],
    ['portfolio-first', 'conversion-focus', 'standard'],
    { image: ROOF_IMG, description: 'Skylight installs that seal and brighten your space.' },
    ['skylight', 'sun tunnel', 'velux']
  ),
  roof(
    'Roof Ventilation & Insulation',
    'Efficiency',
    ['functional-utility', 'modern-office', 'coastal-climate', 'minimalist-zen'],
    ['trust-builder', 'storyteller', 'local-expert'],
    { image: ROOF_IMG, description: 'Attic ventilation and insulation for energy savings.' },
    ['attic ventilation', 'ridge vent', 'insulation']
  ),
]

export const ROOFING_GROUPS = [
  'Replacement',
  'Repair',
  'Emergency',
  'Materials',
  'Commercial',
  'Gutters',
  'Inspection',
  'Skylights',
  'Efficiency',
] as const

export const ROOFING_INDUSTRY: IndustryDef = {
  slug: 'roofing',
  label: 'Roofing',
  keywords: ['roof', 'roofing', 'shingle'],
  serviceGroups: [...ROOFING_GROUPS],
  defaultThemes: ['coastal-climate', 'classic-warm', 'modern-office', 'historic-classic'],
  defaultLayouts: ['trust-builder', 'portfolio-first', 'conversion-focus', 'local-expert'],
  services: ROOFING_SERVICES,
}
