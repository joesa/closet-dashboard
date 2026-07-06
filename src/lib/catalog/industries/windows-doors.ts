import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const WIN_IMG = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64'
const DOOR_IMG = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa'
const GLASS_IMG = 'https://images.unsplash.com/photo-1581578731548-c64695cc6952'

function win(
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
    industry: 'windows-doors',
    keywords,
    widgetCategory: label,
    recommendedThemes: themes,
    recommendedLayouts: layouts,
    catalog,
  }
}

const WIN_THEMES = ['window-light', 'luxury-minimal', 'classic-warm', 'modern-office'] as const
const WIN_LAYOUTS = ['gallery-showcase', 'before-after', 'portfolio-first', 'conversion-focus'] as const

export const WINDOWS_DOORS_SERVICES: ServiceDef[] = [
  win(
    'Window Replacement',
    'Windows',
    [...WIN_THEMES, 'coastal-climate'],
    [...WIN_LAYOUTS, 'trust-builder'],
    { image: WIN_IMG, description: 'Energy-efficient double and triple-pane window replacement for any home style.' },
    ['window replacement', 'new windows', 'window install', 'energy efficient windows', 'double pane windows']
  ),
  win(
    'Window Installation',
    'Windows',
    [...WIN_THEMES],
    [...WIN_LAYOUTS],
    { image: WIN_IMG, description: 'New construction and addition window installation — all styles and materials.' },
    ['window installation', 'window install', 'new window', 'bay window install', 'casement window']
  ),
  win(
    'Entry Door Replacement',
    'Doors',
    ['window-light', 'luxury-minimal', 'classic-warm', 'artisan-wood'],
    ['portfolio-first', 'before-after', 'gallery-showcase', 'conversion-focus'],
    { image: DOOR_IMG, description: 'Steel, fiberglass, and wood entry doors installed with new hardware.' },
    ['entry door', 'front door replacement', 'new front door', 'exterior door', 'entry door install']
  ),
  win(
    'Patio & Sliding Door Installation',
    'Doors',
    ['window-light', 'coastal-climate', 'luxury-minimal', 'modern-office'],
    ['portfolio-first', 'gallery-showcase', 'before-after', 'visual-impact'],
    { image: GLASS_IMG, description: 'Sliding glass, French, and bi-fold patio door installations.' },
    ['sliding door', 'patio door', 'french door', 'sliding glass door', 'bi-fold door']
  ),
  win(
    'Storm Door Installation',
    'Doors',
    ['window-light', 'classic-warm', 'functional-utility', 'coastal-climate'],
    ['compact-quote', 'trust-builder', 'conversion-focus', 'local-expert'],
    { image: DOOR_IMG, description: 'Storm and screen doors installed to protect your entry and add ventilation.' },
    ['storm door', 'screen door install', 'storm door install', 'exterior screen door']
  ),
  win(
    'Window Repair & Glass Replacement',
    'Repair',
    ['window-light', 'classic-warm', 'functional-utility', 'modern-office'],
    ['compact-quote', 'trust-builder', 'before-after', 'conversion-focus'],
    { image: WIN_IMG, description: 'Fogged glass, broken sashes, and seal failures repaired without full replacement.' },
    ['window repair', 'foggy window', 'broken window', 'window glass replacement', 'window seal']
  ),
  win(
    'Window & Door Weatherization',
    'Repair',
    ['window-light', 'functional-utility', 'classic-warm', 'modern-office'],
    ['trust-builder', 'compact-quote', 'local-expert', 'conversion-focus'],
    { image: WIN_IMG, description: 'Draft sealing, weatherstripping, and caulking for energy savings.' },
    ['window weatherization', 'draft seal windows', 'weatherstrip door', 'window caulking', 'energy audit']
  ),
  win(
    'Commercial Window Installation',
    'Commercial',
    ['commercial-pro', 'window-light', 'modern-office', 'brutalist'],
    ['portfolio-first', 'trust-builder', 'conversion-focus', 'compact-quote'],
    { image: WIN_IMG, description: 'Storefront glass, curtain wall, and commercial window installation.' },
    ['commercial windows', 'storefront glass', 'curtain wall', 'commercial glazing', 'office windows']
  ),
]

export const WINDOWS_DOORS_INDUSTRY: IndustryDef = {
  slug: 'windows-doors',
  label: 'Windows & Doors',
  keywords: ['windows', 'doors', 'window replacement', 'door install', 'window install', 'entry door', 'patio door'],
  serviceGroups: ['Windows', 'Doors', 'Repair', 'Commercial'],
  defaultThemes: ['window-light', 'luxury-minimal', 'classic-warm', 'modern-office'],
  defaultLayouts: ['gallery-showcase', 'before-after', 'portfolio-first', 'conversion-focus'],
  services: WINDOWS_DOORS_SERVICES,
}
