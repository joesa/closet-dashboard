import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13'

function wt(label: string, group: string, themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry: 'water-treatment', keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['fresh-clean', 'minimalist-zen', 'modern-office', 'classic-warm'] as const
const L = ['trust-report', 'process-steps', 'trust-builder', 'conversion-focus'] as const

export const WATER_TREATMENT_SERVICES: ServiceDef[] = [
  wt('Water Softener Installation', 'Softeners', [...T], [...L, 'compact-quote'], { image: IMG, description: 'Salt-based and salt-free water softener systems installed and maintained.' }, ['water softener', 'water softener install', 'hard water treatment', 'salt free softener']),
  wt('Reverse Osmosis System', 'Filtration', ['fresh-clean', 'minimalist-zen', 'modern-office', 'luxury-minimal'], ['trust-report', 'trust-builder', 'process-steps', 'compact-quote'], { image: IMG, description: 'Under-sink and whole-house RO systems for ultra-pure drinking water.' }, ['reverse osmosis', 'ro system', 'ro water filter', 'drinking water system']),
  wt('Whole House Water Filtration', 'Filtration', [...T], [...L], { image: IMG, description: 'Multi-stage whole-home carbon, sediment, and chemical filtration systems.' }, ['whole house filter', 'water filtration system', 'whole home filter', 'carbon filter']),
  wt('Iron & Sulfur Filter', 'Filtration', ['fresh-clean', 'functional-utility', 'classic-warm', 'modern-office'], ['trust-report', 'compact-quote', 'trust-builder', 'local-expert'], { image: IMG, description: 'Iron, manganese, and sulfur (rotten egg smell) removal systems.' }, ['iron filter', 'iron water filter', 'sulfur filter', 'rusty water filter', 'iron removal']),
  wt('UV Water Disinfection', 'Disinfection', ['fresh-clean', 'modern-office', 'minimalist-zen', 'home-guardian'], ['trust-report', 'process-steps', 'trust-builder', 'compact-quote'], { image: IMG, description: 'UV sterilization systems to eliminate bacteria and viruses without chemicals.' }, ['uv water treatment', 'uv disinfection', 'uv water filter', 'bacteria water treatment']),
  wt('Water Quality Testing', 'Testing', ['fresh-clean', 'home-guardian', 'modern-office', 'minimalist-zen'], ['trust-report', 'trust-builder', 'local-expert', 'conversion-focus'], { image: IMG, description: 'Comprehensive water testing panels for lead, bacteria, hardness, and more.' }, ['water testing', 'water quality test', 'water test', 'water analysis']),
]

export const WATER_TREATMENT_INDUSTRY: IndustryDef = {
  slug: 'water-treatment', label: 'Water Treatment',
  keywords: ['water treatment', 'water softener', 'water filtration', 'reverse osmosis', 'water testing', 'iron filter', 'hard water'],
  serviceGroups: ['Softeners', 'Filtration', 'Disinfection', 'Testing'],
  defaultThemes: ['fresh-clean', 'minimalist-zen', 'modern-office', 'classic-warm'],
  defaultLayouts: ['trust-report', 'process-steps', 'trust-builder', 'conversion-focus'],
  services: WATER_TREATMENT_SERVICES,
}
