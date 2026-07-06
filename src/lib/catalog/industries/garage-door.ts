import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const GARAGE_IMG = 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13'
const DOOR_IMG = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64'

function gd(
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
    industry: 'garage-door',
    keywords,
    widgetCategory: label,
    recommendedThemes: themes,
    recommendedLayouts: layouts,
    catalog,
  }
}

const GD_THEMES = ['garage-smart', 'garage-industrial', 'functional-utility', 'modern-office'] as const
const GD_LAYOUTS = ['emergency-first', 'compact-quote', 'conversion-focus', 'trust-builder'] as const

export const GARAGE_DOOR_SERVICES: ServiceDef[] = [
  gd(
    'Garage Door Repair',
    'Repair',
    [...GD_THEMES],
    [...GD_LAYOUTS],
    { image: GARAGE_IMG, description: 'Same-day garage door repair for springs, cables, and panels.' },
    ['garage door repair', 'broken spring', 'garage door fix', 'broken cable', 'door off track']
  ),
  gd(
    'Spring Replacement',
    'Repair',
    [...GD_THEMES],
    [...GD_LAYOUTS],
    { image: GARAGE_IMG, description: 'Torsion and extension spring replacement — same day available.' },
    ['spring replacement', 'torsion spring', 'extension spring', 'broken spring', 'spring repair']
  ),
  gd(
    'Garage Door Installation',
    'Installation',
    ['garage-smart', 'garage-industrial', 'modern-office', 'luxury-minimal'],
    ['portfolio-first', 'gallery-showcase', 'conversion-focus', 'before-after'],
    { image: DOOR_IMG, description: 'New garage door installation — steel, wood, carriage-style, and more.' },
    ['new garage door', 'garage door install', 'door replacement', 'carriage door', 'custom garage door']
  ),
  gd(
    'Garage Door Opener Installation',
    'Openers',
    ['garage-smart', 'modern-office', 'sleek-entertainment', 'functional-utility'],
    ['compact-quote', 'conversion-focus', 'trust-builder', 'process-steps'],
    { image: GARAGE_IMG, description: 'Belt, chain, and smart Wi-Fi openers installed and configured.' },
    ['opener install', 'garage door opener', 'wifi opener', 'smart opener', 'liftmaster', 'chamberlain']
  ),
  gd(
    'Smart Garage Door System',
    'Smart',
    ['garage-smart', 'modern-office', 'sleek-entertainment', 'swift-mobile'],
    ['compact-quote', 'trust-builder', 'conversion-focus', 'process-steps'],
    { image: GARAGE_IMG, description: 'App-controlled smart garage access, cameras, and keypad systems.' },
    ['smart garage', 'myq', 'garage camera', 'smart access', 'keypad install']
  ),
  gd(
    'Panel & Section Replacement',
    'Repair',
    ['garage-smart', 'garage-industrial', 'functional-utility', 'classic-warm'],
    ['before-after', 'trust-builder', 'compact-quote', 'conversion-focus'],
    { image: GARAGE_IMG, description: 'Dented, cracked, or damaged garage door panels replaced to match.' },
    ['panel replacement', 'dented panel', 'garage door panel', 'door section']
  ),
  gd(
    'Garage Door Tune-Up & Maintenance',
    'Maintenance',
    [...GD_THEMES],
    ['trust-builder', 'compact-quote', 'local-expert', 'seasonal-cta'],
    { image: GARAGE_IMG, description: 'Lubrication, balance check, and safety inspection to prevent failures.' },
    ['garage door tune up', 'maintenance', 'lubrication', 'safety check', 'annual service']
  ),
  gd(
    'Commercial Garage Door Service',
    'Commercial',
    ['commercial-pro', 'garage-smart', 'brutalist', 'functional-utility'],
    ['trust-builder', 'conversion-focus', 'compact-quote', 'local-expert'],
    { image: GARAGE_IMG, description: 'Roll-up, sectional, and fire-rated commercial door service.' },
    ['commercial garage door', 'roll up door', 'industrial door', 'warehouse door']
  ),
]

export const GARAGE_DOOR_INDUSTRY: IndustryDef = {
  slug: 'garage-door',
  label: 'Garage Door Services',
  keywords: ['garage door', 'garage door repair', 'garage door spring', 'garage door opener', 'garage door install'],
  serviceGroups: ['Repair', 'Installation', 'Openers', 'Smart', 'Maintenance', 'Commercial'],
  defaultThemes: ['garage-smart', 'garage-industrial', 'functional-utility', 'modern-office'],
  defaultLayouts: ['emergency-first', 'compact-quote', 'conversion-focus', 'trust-builder'],
  services: GARAGE_DOOR_SERVICES,
}
