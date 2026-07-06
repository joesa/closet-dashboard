import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const CONCRETE_IMG = 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13'
const PATIO_IMG = 'https://images.unsplash.com/photo-1558981852-426c349dafd0'
const WALL_IMG = 'https://images.unsplash.com/photo-1560185893-a55cbc8c57e8'

function mason(
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
    industry: 'concrete-masonry',
    keywords,
    widgetCategory: label,
    recommendedThemes: themes,
    recommendedLayouts: layouts,
    catalog,
  }
}

const MASON_THEMES = ['stone-masonry', 'functional-utility', 'classic-warm', 'brutalist'] as const
const MASON_LAYOUTS = ['portfolio-first', 'gallery-showcase', 'before-after', 'conversion-focus'] as const

export const CONCRETE_MASONRY_SERVICES: ServiceDef[] = [
  mason(
    'Concrete Driveway Installation',
    'Concrete',
    ['stone-masonry', 'functional-utility', 'brutalist', 'classic-warm'],
    ['before-after', 'portfolio-first', 'conversion-focus', 'local-expert'],
    { image: CONCRETE_IMG, description: 'New concrete driveways poured and finished to last for decades.' },
    ['concrete driveway', 'driveway pour', 'new driveway', 'driveway install']
  ),
  mason(
    'Concrete Patio & Walkways',
    'Concrete',
    ['stone-masonry', 'classic-warm', 'rustic-pantry', 'functional-utility'],
    ['portfolio-first', 'gallery-showcase', 'before-after', 'storyteller'],
    { image: PATIO_IMG, description: 'Stamped, broom-finish, and exposed-aggregate patios and walkways.' },
    ['concrete patio', 'stamped concrete', 'concrete walkway', 'patio pour', 'sidewalk']
  ),
  mason(
    'Retaining Wall Construction',
    'Masonry',
    ['stone-masonry', 'classic-warm', 'historic-classic', 'functional-utility'],
    ['portfolio-first', 'visual-impact', 'gallery-showcase', 'conversion-focus'],
    { image: WALL_IMG, description: 'Block, stone, and timber retaining walls that hold terrain and look great.' },
    ['retaining wall', 'boulder wall', 'block wall', 'landscape wall', 'soil retention']
  ),
  mason(
    'Brick & Stone Pavers',
    'Masonry',
    ['stone-masonry', 'classic-warm', 'luxury-minimal', 'historic-classic'],
    ['gallery-showcase', 'visual-impact', 'portfolio-first', 'storyteller'],
    { image: PATIO_IMG, description: 'Brick, travertine, and paver patios and driveways with precise installation.' },
    ['brick paver', 'patio pavers', 'driveway pavers', 'travertine patio', 'stone patio']
  ),
  mason(
    'Foundation Crack Repair',
    'Concrete',
    ['stone-masonry', 'functional-utility', 'brutalist', 'commercial-pro'],
    ['trust-builder', 'conversion-focus', 'process-steps', 'before-after'],
    { image: CONCRETE_IMG, description: 'Basement and foundation crack injection and waterproofing.' },
    ['foundation crack', 'concrete crack repair', 'basement crack', 'foundation repair']
  ),
  mason(
    'Concrete Cutting & Breaking',
    'Concrete',
    ['stone-masonry', 'brutalist', 'garage-industrial', 'commercial-pro'],
    ['compact-quote', 'conversion-focus', 'trust-builder', 'standard'],
    { image: CONCRETE_IMG, description: 'Core drilling, saw cutting, and concrete demolition for remodels.' },
    ['concrete cut', 'core drill', 'concrete demo', 'concrete break', 'saw cut']
  ),
  mason(
    'Outdoor Kitchen & Fire Pit',
    'Hardscaping',
    ['stone-masonry', 'rustic-pantry', 'classic-warm', 'luxury-minimal'],
    ['portfolio-first', 'visual-impact', 'gallery-showcase', 'storyteller'],
    { image: PATIO_IMG, description: 'Custom outdoor kitchens, fire pits, and fireplaces built to entertain.' },
    ['outdoor kitchen', 'fire pit', 'outdoor fireplace', 'bbq island', 'outdoor living']
  ),
  mason(
    'Stucco & Exterior Finishes',
    'Masonry',
    ['stone-masonry', 'historic-classic', 'coastal-climate', 'classic-warm'],
    ['before-after', 'portfolio-first', 'trust-builder', 'conversion-focus'],
    { image: WALL_IMG, description: 'Stucco application, patching, and decorative exterior finishes.' },
    ['stucco', 'stucco repair', 'exterior plaster', 'stucco patch', 'dryvit']
  ),
]

export const CONCRETE_MASONRY_INDUSTRY: IndustryDef = {
  slug: 'concrete-masonry',
  label: 'Concrete & Masonry',
  keywords: ['concrete', 'masonry', 'concrete work', 'paving', 'retaining wall', 'hardscaping', 'brickwork', 'stonework'],
  serviceGroups: ['Concrete', 'Masonry', 'Hardscaping'],
  defaultThemes: ['stone-masonry', 'functional-utility', 'classic-warm', 'brutalist'],
  defaultLayouts: ['portfolio-first', 'gallery-showcase', 'before-after', 'conversion-focus'],
  services: CONCRETE_MASONRY_SERVICES,
}
