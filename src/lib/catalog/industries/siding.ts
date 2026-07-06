import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64'

function sid(label: string, group: string, themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry: 'siding', keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['window-light', 'classic-warm', 'historic-classic', 'artisan-wood'] as const
const L = ['before-after', 'portfolio-first', 'gallery-showcase', 'conversion-focus'] as const

export const SIDING_SERVICES: ServiceDef[] = [
  sid('Vinyl Siding Installation', 'Installation', [...T, 'functional-utility'], [...L, 'trust-builder'], { image: IMG, description: 'Low-maintenance vinyl siding in dozens of colors and profiles.' }, ['vinyl siding', 'vinyl siding install', 'new siding', 'siding replacement']),
  sid('Fiber Cement Siding', 'Installation', ['window-light', 'classic-warm', 'artisan-wood', 'luxury-minimal'], ['portfolio-first', 'gallery-showcase', 'before-after', 'visual-impact'], { image: IMG, description: 'James Hardie and fiber cement siding that looks like wood — without the rot.' }, ['hardie board', 'fiber cement', 'james hardie', 'hardie plank', 'cement siding']),
  sid('Wood Siding Installation', 'Installation', ['artisan-wood', 'rustic-pantry', 'historic-classic', 'classic-warm'], ['portfolio-first', 'gallery-showcase', 'storyteller', 'before-after'], { image: IMG, description: 'Cedar shake, clapboard, and board-and-batten wood siding installation.' }, ['wood siding', 'cedar siding', 'clapboard', 'board and batten', 'cedar shake']),
  sid('Siding Repair', 'Repair', ['window-light', 'classic-warm', 'warm-handyman', 'functional-utility'], ['before-after', 'trust-builder', 'compact-quote', 'local-expert'], { image: IMG, description: 'Cracked, warped, or missing siding panels replaced to match your existing home.' }, ['siding repair', 'cracked siding', 'damaged siding', 'siding patch']),
  sid('Exterior Trim & Fascia', 'Trim', ['window-light', 'artisan-wood', 'classic-warm', 'historic-classic'], ['portfolio-first', 'gallery-showcase', 'before-after', 'conversion-focus'], { image: IMG, description: 'Decorative trim, soffit, fascia, and corner wrap that completes the look.' }, ['exterior trim', 'fascia install', 'soffit install', 'corner trim', 'exterior molding']),
  sid('Siding Cleaning & Painting', 'Maintenance', ['window-light', 'fresh-clean', 'classic-warm', 'functional-utility'], ['before-after', 'seasonal-cta', 'trust-builder', 'local-expert'], { image: IMG, description: 'Soft-wash siding cleaning and elastomeric painting to restore your exterior.' }, ['siding cleaning', 'siding painting', 'paint siding', 'exterior house paint', 'soft wash siding']),
]

export const SIDING_INDUSTRY: IndustryDef = {
  slug: 'siding', label: 'Siding Installation & Repair',
  keywords: ['siding', 'vinyl siding', 'fiber cement', 'hardie board', 'siding repair', 'siding install', 'exterior siding'],
  serviceGroups: ['Installation', 'Repair', 'Trim', 'Maintenance'],
  defaultThemes: ['window-light', 'classic-warm', 'historic-classic', 'artisan-wood'],
  defaultLayouts: ['before-after', 'portfolio-first', 'gallery-showcase', 'conversion-focus'],
  services: SIDING_SERVICES,
}
