import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const GUTTER_IMG = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64'
const GUARD_IMG = 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1'

function gut(
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
    industry: 'gutters',
    keywords,
    widgetCategory: label,
    recommendedThemes: themes,
    recommendedLayouts: layouts,
    catalog,
  }
}

const GUT_THEMES = ['seasonal-outdoor', 'functional-utility', 'classic-warm', 'modern-office'] as const
const GUT_LAYOUTS = ['seasonal-cta', 'local-expert', 'conversion-focus', 'compact-quote'] as const

export const GUTTER_SERVICES: ServiceDef[] = [
  gut(
    'Gutter Cleaning',
    'Cleaning',
    [...GUT_THEMES],
    [...GUT_LAYOUTS, 'trust-builder'],
    { image: GUTTER_IMG, description: 'Debris cleared and downspouts flushed before the next rainstorm.' },
    ['gutter cleaning', 'gutter clean out', 'clean gutters', 'leaf removal gutters']
  ),
  gut(
    'Gutter Installation',
    'Installation',
    ['seasonal-outdoor', 'classic-warm', 'functional-utility', 'historic-classic'],
    ['portfolio-first', 'before-after', 'conversion-focus', 'trust-builder'],
    { image: GUTTER_IMG, description: 'Seamless aluminum, copper, and half-round gutter installation.' },
    ['gutter install', 'new gutters', 'seamless gutters', 'gutter replacement', 'copper gutters']
  ),
  gut(
    'Gutter Guard Installation',
    'Guards',
    ['seasonal-outdoor', 'modern-office', 'functional-utility', 'classic-warm'],
    ['process-steps', 'trust-builder', 'conversion-focus', 'before-after'],
    { image: GUARD_IMG, description: 'Micro-mesh and solid-cover gutter guards — never clean again.' },
    ['gutter guard', 'leaf guard', 'gutter cover', 'gutter protection', 'no clog gutter']
  ),
  gut(
    'Gutter Repair',
    'Repair',
    [...GUT_THEMES],
    ['trust-builder', 'compact-quote', 'conversion-focus', 'local-expert'],
    { image: GUTTER_IMG, description: 'Sagging gutters, leaky joints, and separated seams fixed fast.' },
    ['gutter repair', 'sagging gutter', 'leaking gutter', 'gutter leak', 'gutter reattach']
  ),
  gut(
    'Downspout Repair & Extension',
    'Repair',
    [...GUT_THEMES],
    ['compact-quote', 'trust-builder', 'conversion-focus'],
    { image: GUTTER_IMG, description: 'Downspout extensions and underground drainage to direct water away.' },
    ['downspout', 'downspout extension', 'drainage', 'underground downspout', 'french drain']
  ),
  gut(
    'Fascia & Soffit Repair',
    'Roofline',
    ['seasonal-outdoor', 'functional-utility', 'classic-warm', 'historic-classic'],
    ['trust-builder', 'before-after', 'conversion-focus', 'portfolio-first'],
    { image: GUTTER_IMG, description: 'Rotted fascia boards and soffit panels repaired before new gutter install.' },
    ['fascia repair', 'soffit repair', 'roofline repair', 'fascia board', 'wood rot repair']
  ),
]

export const GUTTERS_INDUSTRY: IndustryDef = {
  slug: 'gutters',
  label: 'Gutter Services',
  keywords: ['gutter', 'gutters', 'gutter cleaning', 'gutter install', 'gutter guard', 'gutter repair'],
  serviceGroups: ['Cleaning', 'Installation', 'Guards', 'Repair', 'Roofline'],
  defaultThemes: ['seasonal-outdoor', 'functional-utility', 'classic-warm', 'modern-office'],
  defaultLayouts: ['seasonal-cta', 'local-expert', 'conversion-focus', 'compact-quote'],
  services: GUTTER_SERVICES,
}
