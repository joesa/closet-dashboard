import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const HANDYMAN_IMG = 'https://images.unsplash.com/photo-1504307651254-35680f356dfd'
const DRYWALL_IMG = 'https://images.unsplash.com/photo-1558618047-f4cf4f1d82af'
const ASSEMBLY_IMG = 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc'

function hm(
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
    industry: 'handyman',
    keywords,
    widgetCategory: label,
    recommendedThemes: themes,
    recommendedLayouts: layouts,
    catalog,
  }
}

const HM_THEMES = ['warm-handyman', 'classic-warm', 'functional-utility', 'modern-office'] as const
const HM_LAYOUTS = ['process-steps', 'trust-builder', 'local-expert', 'conversion-focus'] as const

export const HANDYMAN_SERVICES: ServiceDef[] = [
  hm(
    'General Handyman Services',
    'General',
    [...HM_THEMES],
    [...HM_LAYOUTS, 'standard'],
    { image: HANDYMAN_IMG, description: 'Reliable fixes for everything on your honey-do list.' },
    ['handyman', 'odd jobs', 'general repairs', 'fix it', 'home repair']
  ),
  hm(
    'Furniture Assembly',
    'Assembly',
    ['warm-handyman', 'classic-warm', 'modern-office', 'minimalist-zen'],
    ['compact-quote', 'conversion-focus', 'trust-builder', 'local-expert'],
    { image: ASSEMBLY_IMG, description: 'IKEA, Wayfair, or any flat-pack assembled quickly and correctly.' },
    ['ikea assembly', 'furniture build', 'flat pack', 'assemble furniture']
  ),
  hm(
    'TV & Shelf Mounting',
    'Assembly',
    ['modern-office', 'sleek-entertainment', 'warm-handyman', 'functional-utility'],
    ['compact-quote', 'conversion-focus', 'trust-builder'],
    { image: HANDYMAN_IMG, description: 'Wall-mounted TVs, floating shelves, and gallery walls done right.' },
    ['tv mount', 'wall mount', 'tv hanging', 'shelf install', 'picture hanging']
  ),
  hm(
    'Drywall Repair & Patching',
    'Repairs',
    ['warm-handyman', 'classic-warm', 'functional-utility', 'historic-classic'],
    ['before-after', 'trust-builder', 'process-steps', 'conversion-focus'],
    { image: DRYWALL_IMG, description: 'Holes, cracks, and water-damaged drywall restored invisibly.' },
    ['drywall patch', 'drywall hole', 'drywall repair', 'plaster repair', 'wall patch']
  ),
  hm(
    'Door & Window Repair',
    'Repairs',
    ['warm-handyman', 'classic-warm', 'functional-utility', 'historic-classic'],
    ['trust-builder', 'local-expert', 'conversion-focus'],
    { image: HANDYMAN_IMG, description: 'Sticky doors, broken locks, foggy windows, and screen replacement.' },
    ['door repair', 'door hinge', 'window repair', 'screen door', 'door frame']
  ),
  hm(
    'Caulking & Weatherproofing',
    'Weatherproofing',
    ['warm-handyman', 'functional-utility', 'classic-warm', 'modern-office'],
    ['trust-builder', 'conversion-focus', 'local-expert', 'compact-quote'],
    { image: HANDYMAN_IMG, description: 'Seal drafts, leaks, and gaps to save energy and prevent damage.' },
    ['caulk', 'weatherstrip', 'draft seal', 'energy seal', 'gap fill']
  ),
  hm(
    'Interior Painting Touch-Ups',
    'Repairs',
    ['warm-handyman', 'classic-warm', 'fresh-clean', 'minimalist-zen'],
    ['before-after', 'trust-builder', 'local-expert'],
    { image: HANDYMAN_IMG, description: 'Quick paint repairs, scuffs, and touch-ups to keep walls looking fresh.' },
    ['paint touch up', 'wall paint', 'scuff repair', 'interior paint']
  ),
  hm(
    'Baby & Home Safety Proofing',
    'Safety',
    ['warm-handyman', 'classic-warm', 'playful-kids', 'care-comfort'],
    ['trust-builder', 'storyteller', 'local-expert', 'process-steps'],
    { image: HANDYMAN_IMG, description: 'Cabinet locks, corner guards, stair gates, and anchor straps installed.' },
    ['baby proof', 'childproofing', 'safety install', 'earthquake strap', 'anchor furniture']
  ),
  hm(
    'Smart Home Device Install',
    'Technology',
    ['modern-office', 'sleek-entertainment', 'minimalist-zen', 'warm-handyman'],
    ['compact-quote', 'conversion-focus', 'trust-builder'],
    { image: HANDYMAN_IMG, description: 'Smart locks, doorbells, thermostats, and cameras set up correctly.' },
    ['smart lock', 'nest', 'ring doorbell', 'smart thermostat', 'smart home setup']
  ),
]

export const HANDYMAN_INDUSTRY: IndustryDef = {
  slug: 'handyman',
  label: 'Handyman Services',
  keywords: ['handyman', 'home repair', 'odd jobs', 'fix it', 'general contractor', 'maintenance'],
  serviceGroups: ['General', 'Assembly', 'Repairs', 'Weatherproofing', 'Safety', 'Technology'],
  defaultThemes: ['warm-handyman', 'classic-warm', 'functional-utility', 'modern-office'],
  defaultLayouts: ['process-steps', 'trust-builder', 'local-expert', 'conversion-focus'],
  services: HANDYMAN_SERVICES,
}
