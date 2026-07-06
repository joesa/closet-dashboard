import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IRR_IMG = 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b'
const SPRINKLER_IMG = 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13'

function irr(
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
    industry: 'irrigation',
    keywords,
    widgetCategory: label,
    recommendedThemes: themes,
    recommendedLayouts: layouts,
    catalog,
  }
}

const IRR_THEMES = ['seasonal-outdoor', 'classic-warm', 'coastal-climate', 'functional-utility'] as const
const IRR_LAYOUTS = ['seasonal-cta', 'local-expert', 'conversion-focus', 'compact-quote'] as const

export const IRRIGATION_SERVICES: ServiceDef[] = [
  irr(
    'Sprinkler System Installation',
    'Installation',
    [...IRR_THEMES, 'modern-office'],
    ['portfolio-first', 'process-steps', 'conversion-focus', 'trust-builder'],
    { image: IRR_IMG, description: 'Custom in-ground sprinkler systems designed and installed for your yard.' },
    ['sprinkler install', 'irrigation install', 'sprinkler system', 'in-ground sprinklers', 'irrigation design']
  ),
  irr(
    'Sprinkler Repair',
    'Repair',
    [...IRR_THEMES],
    [...IRR_LAYOUTS, 'trust-builder'],
    { image: SPRINKLER_IMG, description: 'Broken heads, leaking valves, and controller issues fixed fast.' },
    ['sprinkler repair', 'broken sprinkler head', 'irrigation repair', 'valve repair', 'sprinkler leak']
  ),
  irr(
    'Irrigation Winterization',
    'Seasonal',
    ['seasonal-outdoor', 'classic-warm', 'functional-utility', 'modern-office'],
    ['seasonal-cta', 'compact-quote', 'conversion-focus', 'local-expert'],
    { image: SPRINKLER_IMG, description: 'Blow-out and shut-down service before the first freeze — protect your system.' },
    ['sprinkler winterization', 'blow out sprinklers', 'irrigation shutdown', 'winterize sprinklers']
  ),
  irr(
    'Spring Start-Up & Activation',
    'Seasonal',
    ['seasonal-outdoor', 'classic-warm', 'coastal-climate', 'functional-utility'],
    ['seasonal-cta', 'compact-quote', 'local-expert', 'conversion-focus'],
    { image: IRR_IMG, description: 'Seasonal turn-on, system check, and zone adjustment to get you ready for summer.' },
    ['sprinkler start up', 'irrigation activation', 'spring turn on', 'open sprinklers']
  ),
  irr(
    'Smart Irrigation Controller',
    'Smart',
    ['seasonal-outdoor', 'modern-office', 'sleek-entertainment', 'minimalist-zen'],
    ['process-steps', 'compact-quote', 'trust-builder', 'conversion-focus'],
    { image: SPRINKLER_IMG, description: 'Rachio, RainBird, and Hunter smart controllers installed — water only when needed.' },
    ['smart sprinkler', 'rachio install', 'smart controller', 'wifi sprinkler', 'rain sensor']
  ),
  irr(
    'Drip Irrigation Installation',
    'Installation',
    ['seasonal-outdoor', 'coastal-climate', 'classic-warm', 'rustic-pantry'],
    ['portfolio-first', 'conversion-focus', 'trust-builder', 'local-expert'],
    { image: IRR_IMG, description: 'Water-efficient drip systems for garden beds, trees, and landscaping.' },
    ['drip irrigation', 'drip system', 'drip line', 'soaker hose', 'garden irrigation']
  ),
  irr(
    'Backflow Testing & Certification',
    'Compliance',
    ['seasonal-outdoor', 'commercial-pro', 'functional-utility', 'modern-office'],
    ['trust-report', 'trust-builder', 'compact-quote', 'local-expert'],
    { image: SPRINKLER_IMG, description: 'Annual backflow preventer testing and city certification.' },
    ['backflow test', 'backflow preventer', 'backflow certification', 'annual backflow']
  ),
]

export const IRRIGATION_INDUSTRY: IndustryDef = {
  slug: 'irrigation',
  label: 'Irrigation & Sprinklers',
  keywords: ['irrigation', 'sprinkler system', 'lawn irrigation', 'drip irrigation', 'backflow'],
  serviceGroups: ['Installation', 'Repair', 'Seasonal', 'Smart', 'Compliance'],
  defaultThemes: ['seasonal-outdoor', 'classic-warm', 'coastal-climate', 'functional-utility'],
  defaultLayouts: ['seasonal-cta', 'local-expert', 'conversion-focus', 'compact-quote'],
  services: IRRIGATION_SERVICES,
}
