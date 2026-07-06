import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13'

function rs(label: string, group: string, industry: 'mold-remediation' | 'fire-restoration', themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry, keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['fresh-clean', 'functional-utility', 'commercial-pro', 'home-guardian'] as const
const L = ['emergency-first', 'trust-report', 'trust-builder', 'process-steps'] as const

export const MOLD_REMEDIATION_SERVICES: ServiceDef[] = [
  rs('Mold Remediation', 'Remediation', 'mold-remediation', [...T], [...L, 'conversion-focus'], { image: IMG, description: 'Certified mold removal with containment, HEPA air scrubbing, and clearance testing.' }, ['mold remediation', 'mold removal', 'black mold removal', 'mold cleanup']),
  rs('Mold Inspection & Testing', 'Inspection', 'mold-remediation', ['home-guardian', 'fresh-clean', 'modern-office', 'classic-warm'], ['trust-report', 'trust-builder', 'process-steps', 'local-expert'], { image: IMG, description: 'Air sampling and surface testing to identify mold species and extent.' }, ['mold inspection', 'mold testing', 'mold test', 'mold assessment', 'air quality mold']),
  rs('Crawl Space Mold Treatment', 'Crawl Space', 'mold-remediation', ['fresh-clean', 'functional-utility', 'classic-warm', 'modern-office'], ['before-after', 'trust-builder', 'process-steps', 'conversion-focus'], { image: IMG, description: 'Mold-treated crawl spaces with encapsulation to prevent recurrence.' }, ['crawl space mold', 'mold under house', 'crawl space mold removal']),
  rs('Post-Remediation Clearance Testing', 'Testing', 'mold-remediation', ['home-guardian', 'modern-office', 'fresh-clean', 'commercial-pro'], ['trust-report', 'trust-builder', 'standard', 'local-expert'], { image: IMG, description: 'Independent post-clearance air testing to confirm successful mold removal.' }, ['clearance test', 'post remediation test', 'air quality clearance', 'mold clearance']),
]

export const FIRE_RESTORATION_SERVICES: ServiceDef[] = [
  rs('Fire & Smoke Damage Restoration', 'Fire', 'fire-restoration', [...T], [...L, 'conversion-focus'], { image: IMG, description: '24/7 fire damage cleanup, board-up, smoke removal, and full reconstruction.' }, ['fire restoration', 'fire damage repair', 'smoke damage cleanup', 'fire cleanup']),
  rs('Water Damage Restoration', 'Water', 'fire-restoration', ['fresh-clean', 'functional-utility', 'swift-mobile', 'commercial-pro'], ['emergency-first', 'trust-report', 'trust-builder', 'process-steps'], { image: IMG, description: 'Water extraction, structural drying, and dehumidification after floods or leaks.' }, ['water damage restoration', 'flood restoration', 'water cleanup', 'structural drying', 'water extraction']),
  rs('Contents Cleaning & Pack-Out', 'Contents', 'fire-restoration', ['fresh-clean', 'functional-utility', 'classic-warm', 'commercial-pro'], ['trust-report', 'trust-builder', 'process-steps', 'standard'], { image: IMG, description: 'Contents inventoried, packed, cleaned off-site, and returned after restoration.' }, ['contents cleaning', 'pack out', 'contents restoration', 'personal property cleaning']),
  rs('Odor Elimination', 'Odor', 'fire-restoration', ['fresh-clean', 'functional-utility', 'modern-office', 'classic-warm'], ['trust-builder', 'before-after', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'Ozone, hydroxyl, and thermal fogging for smoke, pet, and biological odor removal.' }, ['odor removal', 'smoke odor', 'odor elimination', 'ozone treatment', 'hydroxyl treatment']),
]

export const MOLD_REMEDIATION_INDUSTRY: IndustryDef = {
  slug: 'mold-remediation', label: 'Mold Remediation',
  keywords: ['mold remediation', 'mold removal', 'mold inspection', 'black mold', 'mold cleanup', 'mold testing'],
  serviceGroups: ['Remediation', 'Inspection', 'Crawl Space', 'Testing'],
  defaultThemes: ['fresh-clean', 'functional-utility', 'commercial-pro', 'home-guardian'],
  defaultLayouts: ['emergency-first', 'trust-report', 'trust-builder', 'process-steps'],
  services: MOLD_REMEDIATION_SERVICES,
}

export const FIRE_RESTORATION_INDUSTRY: IndustryDef = {
  slug: 'fire-restoration', label: 'Fire & Water Damage Restoration',
  keywords: ['fire restoration', 'fire damage', 'smoke damage', 'water damage restoration', 'flood cleanup', 'restoration company', 'restoration services', 'restoration'],
  serviceGroups: ['Fire', 'Water', 'Contents', 'Odor'],
  defaultThemes: ['fresh-clean', 'functional-utility', 'commercial-pro', 'home-guardian'],
  defaultLayouts: ['emergency-first', 'trust-report', 'trust-builder', 'process-steps'],
  services: FIRE_RESTORATION_SERVICES,
}
