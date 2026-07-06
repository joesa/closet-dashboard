import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13'

function fp(label: string, group: string, themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry: 'fire-protection', keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['commercial-pro', 'home-guardian', 'functional-utility', 'modern-office'] as const
const L = ['trust-report', 'trust-builder', 'process-steps', 'local-expert'] as const

export const FIRE_PROTECTION_SERVICES: ServiceDef[] = [
  fp('Fire Extinguisher Inspection & Service', 'Extinguishers', [...T], [...L, 'compact-quote'], { image: IMG, description: 'NFPA 10-compliant annual inspection, recharge, and replacement service.' }, ['fire extinguisher inspection', 'extinguisher service', 'fire extinguisher recharge']),
  fp('Fire Sprinkler Inspection & Repair', 'Sprinklers', [...T], [...L], { image: IMG, description: 'Wet, dry, and pre-action sprinkler system testing, inspection, and repair.' }, ['fire sprinkler inspection', 'sprinkler system test', 'sprinkler repair', 'nfpa 25']),
  fp('Fire Alarm Testing & Inspection', 'Alarms', ['commercial-pro', 'home-guardian', 'modern-office', 'functional-utility'], ['trust-report', 'trust-builder', 'compact-quote', 'process-steps'], { image: IMG, description: 'Panel, detector, and pull station testing per NFPA 72 and local codes.' }, ['fire alarm inspection', 'fire alarm test', 'smoke detector test', 'nfpa 72']),
  fp('Suppression System Installation', 'Suppression', ['commercial-pro', 'functional-utility', 'brutalist', 'modern-office'], ['trust-report', 'process-steps', 'trust-builder', 'conversion-focus'], { image: IMG, description: 'Kitchen hood suppression, clean agent, and CO2 systems installed and certified.' }, ['suppression system', 'kitchen hood suppression', 'clean agent system', 'ansul system']),
  fp('Emergency Exit & Lighting', 'Exit', ['commercial-pro', 'functional-utility', 'modern-office', 'home-guardian'], ['trust-report', 'compact-quote', 'trust-builder', 'local-expert'], { image: IMG, description: 'Exit sign and emergency lighting inspection, battery testing, and replacement.' }, ['exit sign', 'emergency lighting', 'exit light inspection', 'emergency exit']),
  fp('Fire Door Inspection', 'Doors', ['commercial-pro', 'functional-utility', 'modern-office', 'home-guardian'], ['trust-report', 'trust-builder', 'compact-quote', 'process-steps'], { image: IMG, description: 'Annual fire door, frame, and hardware inspection per NFPA 80.' }, ['fire door inspection', 'fire door service', 'nfpa 80', 'fire rated door']),
]

export const FIRE_PROTECTION_INDUSTRY: IndustryDef = {
  slug: 'fire-protection', label: 'Fire Protection Services',
  keywords: ['fire protection', 'fire extinguisher', 'fire sprinkler', 'fire alarm', 'fire safety', 'suppression system'],
  serviceGroups: ['Extinguishers', 'Sprinklers', 'Alarms', 'Suppression', 'Exit', 'Doors'],
  defaultThemes: ['commercial-pro', 'home-guardian', 'functional-utility', 'modern-office'],
  defaultLayouts: ['trust-report', 'trust-builder', 'process-steps', 'local-expert'],
  services: FIRE_PROTECTION_SERVICES,
}
