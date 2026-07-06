import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const POOL_IMG = 'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7'
const SPA_IMG = 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874'
const POOL_REPAIR_IMG = 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f'

function pool(
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
    industry: 'pool-spa',
    keywords,
    widgetCategory: label,
    recommendedThemes: themes,
    recommendedLayouts: layouts,
    catalog,
  }
}

const POOL_THEMES = ['pool-resort', 'coastal-climate', 'luxury-minimal', 'classic-warm'] as const
const POOL_LAYOUTS = ['gallery-showcase', 'visual-impact', 'seasonal-cta', 'conversion-focus'] as const

export const POOL_SPA_SERVICES: ServiceDef[] = [
  pool(
    'Pool Cleaning & Maintenance',
    'Maintenance',
    [...POOL_THEMES],
    [...POOL_LAYOUTS, 'trust-builder'],
    { image: POOL_IMG, description: 'Weekly and bi-weekly pool cleaning, skimming, and chemical balancing.' },
    ['pool cleaning', 'pool service', 'pool maintenance', 'weekly pool', 'pool skimming']
  ),
  pool(
    'Pool Opening & Closing',
    'Seasonal',
    ['pool-resort', 'coastal-climate', 'seasonal-outdoor', 'classic-warm'],
    ['seasonal-cta', 'conversion-focus', 'compact-quote', 'trust-builder'],
    { image: POOL_IMG, description: 'Full pool opening and winterization services each season.' },
    ['pool opening', 'pool closing', 'pool winterization', 'open pool', 'close pool']
  ),
  pool(
    'Pool Equipment Repair',
    'Repair',
    ['pool-resort', 'functional-utility', 'modern-office', 'coastal-climate'],
    ['trust-builder', 'conversion-focus', 'compact-quote', 'emergency-first'],
    { image: POOL_REPAIR_IMG, description: 'Pump, filter, heater, and salt-cell repair and replacement.' },
    ['pool pump repair', 'pool filter', 'pool heater repair', 'salt cell', 'pool equipment']
  ),
  pool(
    'Pool Resurfacing & Renovation',
    'Renovation',
    ['pool-resort', 'luxury-minimal', 'coastal-climate', 'stone-masonry'],
    ['before-after', 'portfolio-first', 'gallery-showcase', 'visual-impact'],
    { image: POOL_IMG, description: 'Plaster, pebble, and tile resurfacing that makes old pools look brand new.' },
    ['pool resurfacing', 'pool plaster', 'pool tile', 'pool renovation', 'replaster']
  ),
  pool(
    'Pool Construction & Installation',
    'Construction',
    ['pool-resort', 'luxury-minimal', 'coastal-climate', 'luxury-gallery'],
    ['portfolio-first', 'visual-impact', 'gallery-showcase', 'storyteller'],
    { image: POOL_IMG, description: 'Custom inground pools designed and built for your backyard.' },
    ['pool installation', 'inground pool', 'pool builder', 'new pool construction', 'custom pool']
  ),
  pool(
    'Hot Tub & Spa Service',
    'Spa',
    ['pool-resort', 'sophisticated-wine', 'luxury-minimal', 'coastal-climate'],
    ['gallery-showcase', 'trust-builder', 'seasonal-cta', 'conversion-focus'],
    { image: SPA_IMG, description: 'Hot tub and spa cleaning, chemical service, and repair.' },
    ['hot tub service', 'spa cleaning', 'hot tub repair', 'jacuzzi service', 'spa maintenance']
  ),
  pool(
    'Pool Water Testing & Chemical Service',
    'Maintenance',
    ['pool-resort', 'fresh-clean', 'coastal-climate', 'modern-office'],
    ['trust-builder', 'compact-quote', 'local-expert', 'conversion-focus'],
    { image: POOL_IMG, description: 'Professional water testing and chemical balancing for crystal-clear water.' },
    ['pool chemicals', 'water testing', 'pool pH', 'algae treatment', 'pool shock']
  ),
  pool(
    'Pool Deck & Surround',
    'Deck',
    ['pool-resort', 'stone-masonry', 'coastal-climate', 'luxury-minimal'],
    ['portfolio-first', 'before-after', 'gallery-showcase', 'visual-impact'],
    { image: POOL_IMG, description: 'Pool deck resurfacing, cool-coat, and paver surrounds.' },
    ['pool deck', 'deck resurfacing', 'cool deck', 'paver pool deck', 'travertine pool deck']
  ),
]

export const POOL_SPA_INDUSTRY: IndustryDef = {
  slug: 'pool-spa',
  label: 'Pool & Spa Services',
  keywords: ['pool', 'spa', 'pool service', 'pool cleaning', 'hot tub', 'pool maintenance', 'pool repair'],
  serviceGroups: ['Maintenance', 'Seasonal', 'Repair', 'Renovation', 'Construction', 'Spa', 'Deck'],
  defaultThemes: ['pool-resort', 'coastal-climate', 'luxury-minimal', 'classic-warm'],
  defaultLayouts: ['gallery-showcase', 'visual-impact', 'seasonal-cta', 'conversion-focus'],
  services: POOL_SPA_SERVICES,
}
