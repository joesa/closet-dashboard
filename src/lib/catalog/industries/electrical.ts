import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const ELECTRIC_IMG = 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e'
const PANEL_IMG = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64'
const LIGHT_IMG = 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15'

function elec(
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
    industry: 'electrical',
    keywords,
    widgetCategory: label,
    recommendedThemes: themes,
    recommendedLayouts: layouts,
    catalog,
  }
}

export const ELECTRICAL_SERVICES: ServiceDef[] = [
  elec(
    'Panel Upgrade & Service',
    'Panels',
    ['modern-office', 'brutalist', 'commercial-pro', 'functional-utility'],
    ['trust-builder', 'conversion-focus', 'local-expert'],
    { image: PANEL_IMG, description: 'Safe panel upgrades for modern power demands.' },
    ['electrical panel', 'breaker box', '200 amp']
  ),
  elec(
    'Outlet & Switch Install',
    'Residential',
    ['modern-office', 'classic-warm', 'minimalist-zen', 'functional-utility'],
    ['standard', 'conversion-focus', 'compact-quote'],
    { image: ELECTRIC_IMG, description: 'New outlets, switches, and USB upgrades.' },
    ['outlet', 'switch', 'gfci', 'usb outlet']
  ),
  elec(
    'Lighting Design & Install',
    'Lighting',
    ['luxury-minimal', 'sleek-entertainment', 'modern-office', 'classic-warm'],
    ['portfolio-first', 'gallery-showcase', 'visual-impact'],
    { image: LIGHT_IMG, description: 'Recessed, pendant, and accent lighting installs.' },
    ['recessed lights', 'chandelier', 'under cabinet']
  ),
  elec(
    'EV Charger Installation',
    'EV',
    ['sleek-entertainment', 'modern-office', 'minimalist-zen', 'commercial-pro'],
    ['conversion-focus', 'compact-quote', 'trust-builder'],
    { image: ELECTRIC_IMG, description: 'Level 2 EV charger installs for home and business.' },
    ['ev charger', 'tesla charger', 'level 2']
  ),
  elec(
    'Whole-Home Rewiring',
    'Rewiring',
    ['historic-classic', 'classic-warm', 'modern-office', 'functional-utility'],
    ['trust-builder', 'storyteller', 'conversion-focus'],
    { image: PANEL_IMG, description: 'Knob-and-tube and aluminum wiring replacements.' },
    ['rewire', 'knob and tube', 'aluminum wiring']
  ),
  elec(
    'Ceiling Fan Install',
    'Residential',
    ['classic-warm', 'modern-office', 'coastal-climate', 'minimalist-zen'],
    ['standard', 'conversion-focus', 'local-expert'],
    { image: LIGHT_IMG, description: 'Ceiling fan installs balanced and wired safely.' },
    ['ceiling fan', 'fan install']
  ),
  elec(
    'Generator Install & Hookup',
    'Backup power',
    ['brutalist', 'functional-utility', 'modern-office', 'commercial-pro'],
    ['trust-builder', 'conversion-focus', 'storyteller'],
    { image: PANEL_IMG, description: 'Standby generators for outage-ready homes.' },
    ['generator', 'backup power', 'transfer switch']
  ),
  elec(
    'Smart Home & Automation',
    'Smart home',
    ['sleek-entertainment', 'modern-office', 'minimalist-zen', 'luxury-minimal'],
    ['portfolio-first', 'conversion-focus', 'compact-quote'],
    { image: LIGHT_IMG, description: 'Smart switches, scenes, and home automation wiring.' },
    ['smart home', 'lutron', 'automation']
  ),
  elec(
    'Commercial Electrical',
    'Commercial',
    ['commercial-pro', 'brutalist', 'modern-office', 'functional-utility'],
    ['trust-builder', 'conversion-focus', 'compact-quote'],
    { image: ELECTRIC_IMG, description: 'Tenant improvements and commercial power systems.' },
    ['commercial electrician', 'tenant improvement', 'ti']
  ),
  elec(
    'Emergency Electrical',
    'Emergency',
    ['brutalist', 'functional-utility', 'modern-office', 'classic-warm'],
    ['minimalist-lead', 'conversion-focus', 'compact-quote'],
    { image: ELECTRIC_IMG, description: 'After-hours electrical when power fails.' },
    ['emergency electrician', 'no power', 'spark', '24/7']
  ),
  elec(
    'Surge Protection & Safety',
    'Safety',
    ['modern-office', 'classic-warm', 'functional-utility', 'minimalist-zen'],
    ['trust-builder', 'local-expert', 'standard'],
    { image: PANEL_IMG, description: 'Whole-home surge protection and safety inspections.' },
    ['surge protector', 'smoke detector', 'code compliance']
  ),
]

export const ELECTRICAL_GROUPS = [
  'Panels',
  'Residential',
  'Lighting',
  'EV',
  'Rewiring',
  'Backup power',
  'Smart home',
  'Commercial',
  'Emergency',
  'Safety',
] as const

export const ELECTRICAL_INDUSTRY: IndustryDef = {
  slug: 'electrical',
  label: 'Electrical',
  keywords: ['electric', 'electrician', 'wiring', 'panel', 'lighting'],
  serviceGroups: [...ELECTRICAL_GROUPS],
  defaultThemes: ['modern-office', 'classic-warm', 'functional-utility', 'sleek-entertainment'],
  defaultLayouts: ['trust-builder', 'conversion-focus', 'portfolio-first', 'minimalist-lead'],
  services: ELECTRICAL_SERVICES,
}
