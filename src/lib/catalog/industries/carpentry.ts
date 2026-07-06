import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const CARP_IMG = 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261'
const DECK_IMG = 'https://images.unsplash.com/photo-1558981852-426c349dafd0'
const CABINET_IMG = 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136'

function carp(
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
    industry: 'carpentry',
    keywords,
    widgetCategory: label,
    recommendedThemes: themes,
    recommendedLayouts: layouts,
    catalog,
  }
}

const CARP_THEMES = ['artisan-wood', 'classic-warm', 'luxury-minimal', 'rustic-pantry'] as const
const CARP_LAYOUTS = ['portfolio-first', 'gallery-showcase', 'storyteller', 'process-steps'] as const

export const CARPENTRY_SERVICES: ServiceDef[] = [
  carp(
    'Custom Cabinetry',
    'Cabinetry',
    [...CARP_THEMES, 'elegant-dressing'],
    [...CARP_LAYOUTS, 'visual-impact'],
    { image: CABINET_IMG, description: 'Handcrafted kitchen, bathroom, and built-in cabinetry to spec.' },
    ['custom cabinet', 'cabinet build', 'built-in cabinet', 'kitchen cabinet', 'bathroom vanity']
  ),
  carp(
    'Deck Building & Repair',
    'Outdoor',
    ['artisan-wood', 'rustic-pantry', 'coastal-climate', 'classic-warm'],
    ['portfolio-first', 'before-after', 'storyteller', 'visual-impact'],
    { image: DECK_IMG, description: 'New decks, pergolas, and repairs built for years of outdoor living.' },
    ['deck build', 'deck repair', 'pergola', 'porch', 'outdoor deck']
  ),
  carp(
    'Framing & Structural Carpentry',
    'Framing',
    ['artisan-wood', 'functional-utility', 'commercial-pro', 'brutalist'],
    ['trust-builder', 'process-steps', 'conversion-focus', 'standard'],
    { image: CARP_IMG, description: 'Room additions, wall framing, and structural carpentry done to code.' },
    ['framing', 'wall framing', 'room addition', 'structural carpenter', 'stud wall']
  ),
  carp(
    'Crown Molding & Trim Work',
    'Finish',
    ['artisan-wood', 'classic-warm', 'luxury-minimal', 'historic-classic'],
    ['portfolio-first', 'gallery-showcase', 'storyteller', 'visual-impact'],
    { image: CARP_IMG, description: 'Crown molding, baseboards, and custom trim that elevates any room.' },
    ['crown molding', 'trim install', 'baseboard', 'wainscoting', 'chair rail']
  ),
  carp(
    'Staircase & Railing',
    'Finish',
    ['artisan-wood', 'luxury-minimal', 'classic-warm', 'elegant-dressing'],
    ['portfolio-first', 'gallery-showcase', 'visual-impact', 'storyteller'],
    { image: CARP_IMG, description: 'Custom staircases, balusters, and railings as focal design features.' },
    ['staircase', 'stair railing', 'banister', 'baluster', 'newel post']
  ),
  carp(
    'Built-In Shelving & Bookcases',
    'Built-Ins',
    ['artisan-wood', 'cozy-library', 'classic-warm', 'luxury-minimal'],
    ['portfolio-first', 'gallery-showcase', 'storyteller', 'visual-impact'],
    { image: CARP_IMG, description: 'Floor-to-ceiling built-ins that add value and character to any space.' },
    ['built in shelf', 'bookcase', 'built-in bookshelf', 'library shelving', 'custom shelves']
  ),
  carp(
    'Fence & Gate Installation',
    'Outdoor',
    ['artisan-wood', 'classic-warm', 'rustic-pantry', 'functional-utility'],
    ['portfolio-first', 'before-after', 'local-expert', 'conversion-focus'],
    { image: DECK_IMG, description: 'Wood, vinyl, and composite fencing and custom gate builds.' },
    ['fence install', 'fence build', 'wood fence', 'gate install', 'privacy fence']
  ),
  carp(
    'Wood Flooring & Subfloor',
    'Flooring',
    ['artisan-wood', 'rich-flooring', 'classic-warm', 'rustic-pantry'],
    ['before-after', 'portfolio-first', 'gallery-showcase', 'conversion-focus'],
    { image: CARP_IMG, description: 'Subfloor prep and solid wood flooring installed for a flawless finish.' },
    ['subfloor', 'wood floor install', 'solid wood floor', 'floor carpenter']
  ),
]

export const CARPENTRY_INDUSTRY: IndustryDef = {
  slug: 'carpentry',
  label: 'Carpentry & Woodworking',
  keywords: ['carpentry', 'carpenter', 'woodwork', 'cabinet', 'trim', 'framing', 'deck builder', 'custom wood'],
  serviceGroups: ['Cabinetry', 'Outdoor', 'Framing', 'Finish', 'Built-Ins', 'Flooring'],
  defaultThemes: ['artisan-wood', 'classic-warm', 'luxury-minimal', 'rustic-pantry'],
  defaultLayouts: ['portfolio-first', 'gallery-showcase', 'storyteller', 'process-steps'],
  services: CARPENTRY_SERVICES,
}
