import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const CHIMNEY_IMG = 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750'
const FIREPLACE_IMG = 'https://images.unsplash.com/photo-1513694203232-719a280e022f'

function chim(
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
    industry: 'chimney-fireplace',
    keywords,
    widgetCategory: label,
    recommendedThemes: themes,
    recommendedLayouts: layouts,
    catalog,
  }
}

const CHIM_THEMES = ['hearth-warm', 'classic-warm', 'rustic-pantry', 'historic-classic'] as const
const CHIM_LAYOUTS = ['trust-builder', 'portfolio-first', 'seasonal-cta', 'conversion-focus'] as const

export const CHIMNEY_FIREPLACE_SERVICES: ServiceDef[] = [
  chim(
    'Chimney Sweeping & Cleaning',
    'Cleaning',
    [...CHIM_THEMES],
    [...CHIM_LAYOUTS, 'local-expert'],
    { image: CHIMNEY_IMG, description: 'CSIA-certified chimney sweeping to remove creosote and debris.' },
    ['chimney sweep', 'chimney cleaning', 'creosote removal', 'flue cleaning', 'chimney clean']
  ),
  chim(
    'Chimney Inspection',
    'Inspection',
    ['hearth-warm', 'classic-warm', 'home-guardian', 'modern-office'],
    ['trust-report', 'trust-builder', 'process-steps', 'local-expert'],
    { image: CHIMNEY_IMG, description: 'Level I, II, and III chimney inspections with video scanning.' },
    ['chimney inspection', 'level 2 inspection', 'chimney camera', 'chimney survey']
  ),
  chim(
    'Chimney Repair & Tuckpointing',
    'Repair',
    ['hearth-warm', 'classic-warm', 'stone-masonry', 'historic-classic'],
    ['before-after', 'portfolio-first', 'trust-builder', 'conversion-focus'],
    { image: CHIMNEY_IMG, description: 'Mortar joint repair, spalling brick, and chimney crown restoration.' },
    ['chimney repair', 'tuckpointing', 'chimney crown', 'spalling brick', 'mortar repair']
  ),
  chim(
    'Chimney Cap & Damper Installation',
    'Installation',
    ['hearth-warm', 'functional-utility', 'classic-warm', 'modern-office'],
    ['compact-quote', 'trust-builder', 'conversion-focus', 'process-steps'],
    { image: CHIMNEY_IMG, description: 'Stainless chimney caps and top-sealing dampers to keep out weather and pests.' },
    ['chimney cap', 'damper install', 'top sealing damper', 'chimney cover']
  ),
  chim(
    'Chimney Liner Installation',
    'Installation',
    ['hearth-warm', 'functional-utility', 'classic-warm', 'commercial-pro'],
    ['process-steps', 'trust-builder', 'conversion-focus', 'compact-quote'],
    { image: CHIMNEY_IMG, description: 'Stainless steel and cast-in-place liner installation for safe venting.' },
    ['chimney liner', 'flue liner', 'stainless liner', 'relining']
  ),
  chim(
    'Fireplace Installation & Conversion',
    'Fireplace',
    ['hearth-warm', 'rustic-pantry', 'luxury-minimal', 'classic-warm'],
    ['portfolio-first', 'gallery-showcase', 'storyteller', 'before-after'],
    { image: FIREPLACE_IMG, description: 'Gas insert, electric, and wood-burning fireplace installations.' },
    ['fireplace install', 'gas insert', 'fireplace conversion', 'gas fireplace', 'electric fireplace']
  ),
  chim(
    'Fireplace Repair & Reface',
    'Fireplace',
    ['hearth-warm', 'classic-warm', 'rustic-pantry', 'artisan-wood'],
    ['before-after', 'portfolio-first', 'gallery-showcase', 'storyteller'],
    { image: FIREPLACE_IMG, description: 'Firebox repairs, surround tile replacement, and mantel refacing.' },
    ['fireplace repair', 'firebox repair', 'fireplace reface', 'mantel install', 'hearth tile']
  ),
  chim(
    'Dryer Vent Cleaning',
    'Cleaning',
    ['hearth-warm', 'fresh-clean', 'functional-utility', 'modern-office'],
    ['compact-quote', 'trust-builder', 'conversion-focus', 'local-expert'],
    { image: CHIMNEY_IMG, description: 'Lint-blocked dryer vents cleaned to prevent fire hazards.' },
    ['dryer vent cleaning', 'dryer vent', 'lint removal', 'dryer vent clean out']
  ),
]

export const CHIMNEY_FIREPLACE_INDUSTRY: IndustryDef = {
  slug: 'chimney-fireplace',
  label: 'Chimney & Fireplace',
  keywords: ['chimney', 'fireplace', 'chimney sweep', 'chimney cleaning', 'firebox', 'hearth', 'flue'],
  serviceGroups: ['Cleaning', 'Inspection', 'Repair', 'Installation', 'Fireplace'],
  defaultThemes: ['hearth-warm', 'classic-warm', 'rustic-pantry', 'historic-classic'],
  defaultLayouts: ['trust-builder', 'portfolio-first', 'seasonal-cta', 'conversion-focus'],
  services: CHIMNEY_FIREPLACE_SERVICES,
}
