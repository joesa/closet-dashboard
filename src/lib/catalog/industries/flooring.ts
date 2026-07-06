import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const FLOOR_IMG = 'https://images.unsplash.com/photo-1578662996442-48f60103fc96'
const HARDWOOD_IMG = 'https://images.unsplash.com/photo-1560185893-a55cbc8c57e8'
const TILE_IMG = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64'
const CARPET_IMG = 'https://images.unsplash.com/photo-1558317374-067fb5f30001'

function floor(
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
    industry: 'flooring',
    keywords,
    widgetCategory: label,
    recommendedThemes: themes,
    recommendedLayouts: layouts,
    catalog,
  }
}

const FLOOR_THEMES = ['rich-flooring', 'luxury-minimal', 'classic-warm', 'artisan-wood'] as const
const FLOOR_LAYOUTS = ['gallery-showcase', 'portfolio-first', 'before-after', 'conversion-focus'] as const

export const FLOORING_SERVICES: ServiceDef[] = [
  floor(
    'Hardwood Floor Installation',
    'Hardwood',
    [...FLOOR_THEMES, 'elegant-dressing'],
    [...FLOOR_LAYOUTS, 'visual-impact'],
    { image: HARDWOOD_IMG, description: 'Solid and engineered hardwood installed to last a lifetime.' },
    ['hardwood install', 'wood floor', 'engineered hardwood', 'solid hardwood']
  ),
  floor(
    'Hardwood Floor Refinishing',
    'Hardwood',
    ['rich-flooring', 'classic-warm', 'artisan-wood', 'historic-classic'],
    ['before-after', 'portfolio-first', 'storyteller', 'conversion-focus'],
    { image: HARDWOOD_IMG, description: 'Sand, stain, and seal existing hardwood to look brand new.' },
    ['floor refinish', 'sand and stain', 'hardwood refinish', 'floor restoration']
  ),
  floor(
    'Tile & Stone Flooring',
    'Tile',
    ['rich-flooring', 'luxury-minimal', 'stone-masonry', 'minimalist-zen'],
    ['gallery-showcase', 'visual-impact', 'before-after', 'portfolio-first'],
    { image: TILE_IMG, description: 'Porcelain, ceramic, and natural stone tile installed with precision.' },
    ['tile install', 'floor tile', 'porcelain tile', 'stone floor', 'travertine']
  ),
  floor(
    'Carpet Installation',
    'Carpet',
    ['rich-flooring', 'classic-warm', 'cozy-library', 'playful-kids'],
    ['gallery-showcase', 'conversion-focus', 'standard', 'trust-builder'],
    { image: CARPET_IMG, description: 'Premium carpet installation for bedrooms, offices, and living spaces.' },
    ['carpet install', 'carpet laying', 'new carpet', 'carpet replacement']
  ),
  floor(
    'Luxury Vinyl Plank (LVP) Installation',
    'Vinyl',
    ['rich-flooring', 'modern-office', 'minimalist-zen', 'classic-warm'],
    ['gallery-showcase', 'conversion-focus', 'portfolio-first', 'compact-quote'],
    { image: FLOOR_IMG, description: 'Waterproof LVP — beautiful, durable, and budget-friendly.' },
    ['lvp', 'luxury vinyl', 'vinyl plank', 'vinyl flooring', 'waterproof flooring']
  ),
  floor(
    'Laminate Flooring Installation',
    'Vinyl',
    ['rich-flooring', 'classic-warm', 'modern-office', 'warm-handyman'],
    ['conversion-focus', 'compact-quote', 'trust-builder', 'standard'],
    { image: FLOOR_IMG, description: 'Affordable and stylish laminate flooring installed quickly.' },
    ['laminate', 'laminate install', 'floating floor', 'click floor']
  ),
  floor(
    'Bathroom & Kitchen Tile Work',
    'Tile',
    ['luxury-minimal', 'minimalist-zen', 'rich-flooring', 'rustic-pantry'],
    ['before-after', 'portfolio-first', 'gallery-showcase', 'conversion-focus'],
    { image: TILE_IMG, description: 'Custom shower tile, backsplashes, and bathroom floor installations.' },
    ['shower tile', 'backsplash', 'bathroom tile', 'kitchen tile', 'mosaic']
  ),
  floor(
    'Floor Repair & Restoration',
    'Repairs',
    ['rich-flooring', 'classic-warm', 'artisan-wood', 'historic-classic'],
    ['before-after', 'trust-builder', 'storyteller', 'process-steps'],
    { image: FLOOR_IMG, description: 'Squeaky boards, warped planks, and cracked tile repaired to match.' },
    ['floor repair', 'floor fix', 'board replacement', 'tile repair', 'squeaky floor']
  ),
]

export const FLOORING_INDUSTRY: IndustryDef = {
  slug: 'flooring',
  label: 'Flooring',
  keywords: ['flooring', 'hardwood', 'tile', 'carpet', 'vinyl', 'floor install', 'floor refinish', 'lvp'],
  serviceGroups: ['Hardwood', 'Tile', 'Carpet', 'Vinyl', 'Repairs'],
  defaultThemes: ['rich-flooring', 'luxury-minimal', 'classic-warm', 'artisan-wood'],
  defaultLayouts: ['gallery-showcase', 'portfolio-first', 'before-after', 'conversion-focus'],
  services: FLOORING_SERVICES,
}
