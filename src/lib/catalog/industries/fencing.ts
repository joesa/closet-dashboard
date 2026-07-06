import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1558981852-426c349dafd0'

function fen(label: string, group: string, themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry: 'fencing', keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['artisan-wood', 'classic-warm', 'rustic-pantry', 'stone-masonry'] as const
const L = ['portfolio-first', 'before-after', 'gallery-showcase', 'local-expert'] as const

export const FENCING_SERVICES: ServiceDef[] = [
  fen('Wood Fence Installation', 'Wood', [...T], [...L, 'conversion-focus'], { image: IMG, description: 'Privacy, picket, and split-rail wood fence installation built to last.' }, ['wood fence', 'privacy fence', 'cedar fence', 'wood fence install', 'picket fence']),
  fen('Vinyl & PVC Fence', 'Vinyl', ['window-light', 'classic-warm', 'functional-utility', 'modern-office'], ['portfolio-first', 'gallery-showcase', 'before-after', 'conversion-focus'], { image: IMG, description: 'Low-maintenance vinyl privacy, ranch rail, and ornamental fence options.' }, ['vinyl fence', 'pvc fence', 'vinyl fence install', 'white vinyl fence']),
  fen('Chain Link Fence', 'Chain Link', ['functional-utility', 'brutalist', 'commercial-pro', 'classic-warm'], ['compact-quote', 'trust-builder', 'local-expert', 'conversion-focus'], { image: IMG, description: 'Galvanized and vinyl-coated chain link for yards, pools, and commercial sites.' }, ['chain link', 'chain link fence', 'chain link install', 'wire fence']),
  fen('Wrought Iron & Ornamental', 'Ornamental', ['artisan-wood', 'luxury-minimal', 'elegant-dressing', 'stone-masonry'], ['portfolio-first', 'visual-impact', 'gallery-showcase', 'conversion-focus'], { image: IMG, description: 'Custom wrought iron and ornamental steel fencing and gates.' }, ['wrought iron fence', 'iron fence', 'ornamental fence', 'iron gate', 'steel fence']),
  fen('Fence Repair', 'Repair', ['artisan-wood', 'warm-handyman', 'classic-warm', 'functional-utility'], ['before-after', 'compact-quote', 'trust-builder', 'local-expert'], { image: IMG, description: 'Leaning posts, broken boards, and damaged sections repaired or replaced.' }, ['fence repair', 'broken fence', 'fence post repair', 'fence fix']),
  fen('Gate Installation', 'Gates', ['artisan-wood', 'luxury-minimal', 'stone-masonry', 'classic-warm'], ['portfolio-first', 'gallery-showcase', 'visual-impact', 'conversion-focus'], { image: IMG, description: 'Driveway gates, pedestrian gates, and automatic openers installed.' }, ['gate install', 'driveway gate', 'automatic gate', 'gate opener', 'sliding gate']),
  fen('Agricultural & Farm Fencing', 'Farm', ['rustic-pantry', 'artisan-wood', 'functional-utility', 'classic-warm'], ['local-expert', 'trust-builder', 'conversion-focus', 'compact-quote'], { image: IMG, description: 'High-tensile wire, board-and-rail, and electric fencing for livestock.' }, ['farm fence', 'agricultural fence', 'horse fence', 'livestock fence', 'electric fence']),
]

export const FENCING_INDUSTRY: IndustryDef = {
  slug: 'fencing', label: 'Fencing Installation & Repair',
  keywords: ['fencing', 'fence install', 'fence repair', 'privacy fence', 'chain link', 'wrought iron fence', 'fence contractor'],
  serviceGroups: ['Wood', 'Vinyl', 'Chain Link', 'Ornamental', 'Repair', 'Gates', 'Farm'],
  defaultThemes: ['artisan-wood', 'classic-warm', 'rustic-pantry', 'stone-masonry'],
  defaultLayouts: ['portfolio-first', 'before-after', 'gallery-showcase', 'local-expert'],
  services: FENCING_SERVICES,
}
