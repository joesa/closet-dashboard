import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const INSPECT_IMG = 'https://images.unsplash.com/photo-1558618047-f4cf4f1d82af'
const HOME_IMG = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa'

function insp(
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
    industry: 'home-inspection',
    keywords,
    widgetCategory: label,
    recommendedThemes: themes,
    recommendedLayouts: layouts,
    catalog,
  }
}

const INSP_THEMES = ['home-guardian', 'modern-office', 'classic-warm', 'commercial-pro'] as const
const INSP_LAYOUTS = ['trust-report', 'trust-builder', 'process-steps', 'local-expert'] as const

export const HOME_INSPECTION_SERVICES: ServiceDef[] = [
  insp(
    'Buyer Home Inspection',
    'Residential',
    [...INSP_THEMES],
    [...INSP_LAYOUTS, 'conversion-focus'],
    { image: HOME_IMG, description: 'Comprehensive home inspection for buyers — full report in 24 hours.' },
    ['home inspection', 'buyer inspection', 'house inspection', 'property inspection']
  ),
  insp(
    'Pre-Listing Inspection',
    'Residential',
    ['home-guardian', 'classic-warm', 'modern-office', 'commercial-pro'],
    ['trust-report', 'trust-builder', 'conversion-focus', 'local-expert'],
    { image: HOME_IMG, description: 'Seller inspections to find issues before listing — sell with confidence.' },
    ['pre listing inspection', 'seller inspection', 'pre sale inspection', 'listing inspection']
  ),
  insp(
    'New Construction Inspection',
    'Residential',
    ['home-guardian', 'modern-office', 'commercial-pro', 'functional-utility'],
    ['process-steps', 'trust-report', 'trust-builder', 'conversion-focus'],
    { image: HOME_IMG, description: 'Phase-in and final inspections for new builds before closing.' },
    ['new construction inspection', 'new build inspection', 'builder inspection', 'phase inspection']
  ),
  insp(
    'Commercial Property Inspection',
    'Commercial',
    ['commercial-pro', 'home-guardian', 'modern-office', 'functional-utility'],
    ['trust-report', 'trust-builder', 'conversion-focus', 'compact-quote'],
    { image: INSPECT_IMG, description: 'Due-diligence inspections for offices, retail, and investment properties.' },
    ['commercial inspection', 'commercial building inspection', 'office inspection', 'investment property']
  ),
  insp(
    'Radon Testing',
    'Specialty',
    ['home-guardian', 'modern-office', 'classic-warm', 'minimalist-zen'],
    ['trust-report', 'trust-builder', 'compact-quote', 'conversion-focus'],
    { image: INSPECT_IMG, description: 'Short-term and long-term radon testing with certified analysis.' },
    ['radon test', 'radon testing', 'radon inspection', 'radon level']
  ),
  insp(
    'Mold Inspection & Testing',
    'Specialty',
    ['home-guardian', 'fresh-clean', 'modern-office', 'classic-warm'],
    ['trust-report', 'trust-builder', 'process-steps', 'conversion-focus'],
    { image: INSPECT_IMG, description: 'Mold sampling, air quality testing, and remediation referral.' },
    ['mold inspection', 'mold testing', 'mold test', 'air quality test', 'mold sampling']
  ),
  insp(
    'Sewer Scope Inspection',
    'Specialty',
    ['home-guardian', 'modern-office', 'functional-utility', 'classic-warm'],
    ['trust-report', 'trust-builder', 'compact-quote', 'conversion-focus'],
    { image: INSPECT_IMG, description: 'Camera inspection of main sewer lines to find cracks and blockages.' },
    ['sewer scope', 'sewer camera', 'sewer inspection', 'drain camera']
  ),
  insp(
    '11-Month Warranty Inspection',
    'Residential',
    ['home-guardian', 'classic-warm', 'modern-office', 'commercial-pro'],
    ['trust-report', 'trust-builder', 'local-expert', 'conversion-focus'],
    { image: HOME_IMG, description: 'Builder warranty inspections performed before your first-year coverage expires.' },
    ['warranty inspection', '11 month inspection', 'builder warranty', 'new home warranty']
  ),
]

export const HOME_INSPECTION_INDUSTRY: IndustryDef = {
  slug: 'home-inspection',
  label: 'Home Inspection',
  keywords: ['home inspection', 'inspector', 'property inspection', 'house inspection', 'inspection report'],
  serviceGroups: ['Residential', 'Commercial', 'Specialty'],
  defaultThemes: ['home-guardian', 'modern-office', 'classic-warm', 'commercial-pro'],
  defaultLayouts: ['trust-report', 'trust-builder', 'process-steps', 'local-expert'],
  services: HOME_INSPECTION_SERVICES,
}
