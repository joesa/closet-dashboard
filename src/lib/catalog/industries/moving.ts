import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const MOVE_IMG = 'https://images.unsplash.com/photo-1600518464441-9154a4dea21b'
const TRUCK_IMG = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64'
const STORAGE_IMG = 'https://images.unsplash.com/photo-1558618047-f4cf4f1d82af'

function move(
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
    industry: 'moving',
    keywords,
    widgetCategory: label,
    recommendedThemes: themes,
    recommendedLayouts: layouts,
    catalog,
  }
}

const MOVE_THEMES = ['clean-move', 'functional-utility', 'modern-office', 'classic-warm'] as const
const MOVE_LAYOUTS = ['trust-builder', 'process-steps', 'conversion-focus', 'local-expert'] as const

export const MOVING_SERVICES: ServiceDef[] = [
  move(
    'Local Moving',
    'Moving',
    [...MOVE_THEMES],
    [...MOVE_LAYOUTS, 'compact-quote'],
    { image: MOVE_IMG, description: 'Full-service local moves handled with care and efficiency.' },
    ['local move', 'residential move', 'house move', 'apartment move', 'local mover']
  ),
  move(
    'Long-Distance Moving',
    'Moving',
    ['clean-move', 'commercial-pro', 'modern-office', 'functional-utility'],
    ['trust-builder', 'conversion-focus', 'compact-quote', 'process-steps'],
    { image: TRUCK_IMG, description: 'Cross-state and long-distance moves coordinated from start to finish.' },
    ['long distance move', 'interstate move', 'out of state move', 'cross country move']
  ),
  move(
    'Packing & Unpacking Services',
    'Packing',
    ['clean-move', 'classic-warm', 'functional-utility', 'modern-office'],
    ['process-steps', 'trust-builder', 'conversion-focus', 'standard'],
    { image: MOVE_IMG, description: 'Professional packing that protects everything from fragile to furniture.' },
    ['packing service', 'pack and move', 'unpack', 'moving boxes', 'packing materials']
  ),
  move(
    'Commercial & Office Moving',
    'Commercial',
    ['commercial-pro', 'clean-move', 'modern-office', 'functional-utility'],
    ['trust-builder', 'compact-quote', 'conversion-focus', 'process-steps'],
    { image: TRUCK_IMG, description: 'Office and commercial relocations with minimal business downtime.' },
    ['office move', 'commercial move', 'business relocation', 'office relocation']
  ),
  move(
    'Storage Solutions',
    'Storage',
    ['clean-move', 'functional-utility', 'commercial-pro', 'modern-office'],
    ['trust-builder', 'compact-quote', 'conversion-focus', 'local-expert'],
    { image: STORAGE_IMG, description: 'Short and long-term climate-controlled storage during or after a move.' },
    ['storage unit', 'moving storage', 'portable storage', 'pod storage', 'storage container']
  ),
  move(
    'Furniture Delivery & Assembly',
    'Specialty',
    ['clean-move', 'warm-handyman', 'functional-utility', 'classic-warm'],
    ['compact-quote', 'trust-builder', 'conversion-focus'],
    { image: MOVE_IMG, description: 'White-glove furniture delivery, placement, and assembly in your new space.' },
    ['furniture delivery', 'furniture assembly', 'white glove delivery', 'furniture move']
  ),
  move(
    'Junk Removal & Haul-Away',
    'Specialty',
    ['urban-reclaim', 'functional-utility', 'clean-move', 'modern-office'],
    ['conversion-focus', 'compact-quote', 'trust-builder', 'local-expert'],
    { image: TRUCK_IMG, description: 'Clutter cleared before or after your move — same-day haul-away.' },
    ['junk removal', 'haul away', 'junk hauling', 'debris removal', 'cleanout']
  ),
  move(
    'Senior Moving Services',
    'Specialty',
    ['care-comfort', 'clean-move', 'classic-warm', 'warm-handyman'],
    ['trust-builder', 'storyteller', 'local-expert', 'process-steps'],
    { image: MOVE_IMG, description: 'Patient, careful moving services tailored for seniors and downsizing.' },
    ['senior move', 'elderly move', 'downsizing move', 'assisted living move']
  ),
]

export const MOVING_INDUSTRY: IndustryDef = {
  slug: 'moving',
  label: 'Moving & Storage',
  keywords: ['moving', 'mover', 'relocation', 'moving company', 'storage', 'moving and hauling', 'packing'],
  serviceGroups: ['Moving', 'Packing', 'Commercial', 'Storage', 'Specialty'],
  defaultThemes: ['clean-move', 'functional-utility', 'modern-office', 'classic-warm'],
  defaultLayouts: ['trust-builder', 'process-steps', 'conversion-focus', 'local-expert'],
  services: MOVING_SERVICES,
}
