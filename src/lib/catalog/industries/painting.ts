import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const PAINT_IMG = 'https://images.unsplash.com/photo-1562259949-e8e7689d7828'
const INTERIOR_IMG = 'https://images.unsplash.com/photo-1589939705382-41e6400d6a0a'
const EXTERIOR_IMG = 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6'
const CABINET_IMG = 'https://images.unsplash.com/photo-1556910103-1c02745a872f'

function paint(
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
    industry: 'painting',
    keywords,
    widgetCategory: label,
    recommendedThemes: themes,
    recommendedLayouts: layouts,
    catalog,
  }
}

export const PAINTING_SERVICES: ServiceDef[] = [
  paint(
    'Interior Painting',
    'Residential',
    ['classic-warm', 'luxury-minimal', 'modern-office', 'minimalist-zen'],
    ['portfolio-first', 'gallery-showcase', 'conversion-focus'],
    { image: INTERIOR_IMG, description: 'Flawless interior repaints with clean lines.' },
    ['inside paint', 'room painting', 'wall paint']
  ),
  paint(
    'Exterior Painting',
    'Residential',
    ['coastal-climate', 'classic-warm', 'historic-classic', 'modern-office'],
    ['visual-impact', 'portfolio-first', 'trust-builder'],
    { image: EXTERIOR_IMG, description: 'Weather-ready exterior finishes that last.' },
    ['outside paint', 'house paint', 'siding paint']
  ),
  paint(
    'Cabinet Refinishing',
    'Specialty',
    ['luxury-minimal', 'classic-warm', 'modern-office', 'pantry-fresh'],
    ['gallery-showcase', 'portfolio-first', 'conversion-focus'],
    { image: CABINET_IMG, description: 'Kitchen and bath cabinet spray finishes.' },
    ['cabinet paint', 'cabinet refinish', 'kitchen cabinets']
  ),
  paint(
    'Deck & Fence Staining',
    'Exterior wood',
    ['rustic-pantry', 'coastal-climate', 'classic-warm', 'historic-classic'],
    ['portfolio-first', 'storyteller', 'local-expert'],
    { image: EXTERIOR_IMG, description: 'Stains and sealers that protect outdoor wood.' },
    ['deck stain', 'fence stain', 'wood stain']
  ),
  paint(
    'Drywall Repair & Texture',
    'Prep',
    ['functional-utility', 'modern-office', 'classic-warm', 'minimalist-zen'],
    ['trust-builder', 'conversion-focus', 'standard'],
    { image: INTERIOR_IMG, description: 'Patch, texture, and prep before a perfect coat.' },
    ['drywall patch', 'texture match', 'hole repair']
  ),
  paint(
    'Commercial Painting',
    'Commercial',
    ['commercial-pro', 'modern-office', 'brutalist', 'functional-utility'],
    ['trust-builder', 'conversion-focus', 'compact-quote'],
    { image: PAINT_IMG, description: 'Offices, retail, and industrial painting on schedule.' },
    ['commercial painter', 'office paint', 'warehouse']
  ),
  paint(
    'Color Consultation',
    'Design',
    ['luxury-minimal', 'elegant-dressing', 'classic-warm', 'modern-office'],
    ['storyteller', 'portfolio-first', 'gallery-showcase'],
    { image: INTERIOR_IMG, description: 'Expert palette selection for whole-home cohesion.' },
    ['color consult', 'paint colors', 'designer colors']
  ),
  paint(
    'Popcorn Ceiling Removal',
    'Specialty',
    ['modern-office', 'minimalist-zen', 'luxury-minimal', 'classic-warm'],
    ['conversion-focus', 'trust-builder', 'standard'],
    { image: INTERIOR_IMG, description: 'Smooth ceilings that modernize dated rooms.' },
    ['popcorn ceiling', 'texture removal', 'ceiling scrape']
  ),
  paint(
    'Epoxy Floor Coating',
    'Floors',
    ['garage-industrial', 'brutalist', 'sleek-entertainment', 'modern-office'],
    ['visual-impact', 'portfolio-first', 'conversion-focus'],
    { image: PAINT_IMG, description: 'Durable epoxy floors for garages and basements.' },
    ['epoxy floor', 'garage floor coating', 'flake floor']
  ),
  paint(
    'Pressure Wash Prep & Paint',
    'Exterior',
    ['coastal-climate', 'laundry-clean', 'modern-office', 'classic-warm'],
    ['trust-builder', 'visual-impact', 'conversion-focus'],
    { image: EXTERIOR_IMG, description: 'Full prep including wash, scrape, and prime.' },
    ['prep and paint', 'surface prep', 'prime']
  ),
]

export const PAINTING_GROUPS = [
  'Residential',
  'Specialty',
  'Exterior wood',
  'Prep',
  'Commercial',
  'Design',
  'Floors',
  'Exterior',
] as const

export const PAINTING_INDUSTRY: IndustryDef = {
  slug: 'painting',
  label: 'Painting',
  keywords: ['paint', 'painter', 'interior paint', 'exterior paint', 'cabinet'],
  serviceGroups: [...PAINTING_GROUPS],
  defaultThemes: ['classic-warm', 'luxury-minimal', 'modern-office', 'coastal-climate'],
  defaultLayouts: ['portfolio-first', 'gallery-showcase', 'conversion-focus', 'visual-impact'],
  services: PAINTING_SERVICES,
}
