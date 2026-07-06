import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13'

function ins(label: string, group: string, themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry: 'insulation', keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['warm-handyman', 'functional-utility', 'classic-warm', 'modern-office'] as const
const L = ['process-steps', 'trust-builder', 'before-after', 'conversion-focus'] as const

export const INSULATION_SERVICES: ServiceDef[] = [
  ins('Attic Insulation', 'Attic', [...T], [...L, 'compact-quote'], { image: IMG, description: 'Blown-in and batt attic insulation to cut energy bills year-round.' }, ['attic insulation', 'blown in insulation', 'attic air seal', 'fiberglass insulation']),
  ins('Spray Foam Insulation', 'Spray Foam', ['functional-utility', 'modern-office', 'warm-handyman', 'commercial-pro'], ['process-steps', 'trust-builder', 'conversion-focus', 'compact-quote'], { image: IMG, description: 'Open and closed-cell spray foam for maximum air-sealing and R-value.' }, ['spray foam', 'closed cell foam', 'open cell foam', 'foam insulation']),
  ins('Crawl Space Insulation', 'Crawl Space', [...T], [...L], { image: IMG, description: 'Crawl space insulation and encapsulation to prevent moisture and cold floors.' }, ['crawl space insulation', 'under floor insulation', 'vapor barrier']),
  ins('Wall Insulation', 'Walls', ['warm-handyman', 'functional-utility', 'classic-warm', 'historic-classic'], ['trust-builder', 'before-after', 'process-steps', 'conversion-focus'], { image: IMG, description: 'Dense-pack and blown-in wall insulation for existing homes — no major demo required.' }, ['wall insulation', 'dense pack', 'blown in wall', 'wall air seal']),
  ins('Insulation Removal & Replacement', 'Attic', ['warm-handyman', 'functional-utility', 'fresh-clean', 'modern-office'], ['before-after', 'trust-builder', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'Old, pest-contaminated, or damaged insulation removed and replaced.' }, ['insulation removal', 'old insulation', 'replace insulation', 'rodent damage insulation']),
  ins('Commercial Insulation', 'Commercial', ['commercial-pro', 'functional-utility', 'modern-office', 'brutalist'], ['trust-builder', 'compact-quote', 'conversion-focus', 'process-steps'], { image: IMG, description: 'Mechanical, pipe, and building envelope insulation for commercial projects.' }, ['commercial insulation', 'pipe insulation', 'industrial insulation', 'mechanical insulation']),
  ins('Soundproofing Insulation', 'Specialty', ['modern-office', 'media-theater', 'functional-utility', 'minimalist-zen'], ['trust-builder', 'compact-quote', 'conversion-focus', 'standard'], { image: IMG, description: 'Acoustic insulation for home theaters, offices, and shared walls.' }, ['soundproofing', 'acoustic insulation', 'sound dampening', 'noise reduction wall']),
]

export const INSULATION_INDUSTRY: IndustryDef = {
  slug: 'insulation', label: 'Insulation Services',
  keywords: ['insulation', 'spray foam', 'blown in insulation', 'attic insulation', 'insulation install'],
  serviceGroups: ['Attic', 'Spray Foam', 'Crawl Space', 'Walls', 'Commercial', 'Specialty'],
  defaultThemes: ['warm-handyman', 'functional-utility', 'classic-warm', 'modern-office'],
  defaultLayouts: ['process-steps', 'trust-builder', 'before-after', 'conversion-focus'],
  services: INSULATION_SERVICES,
}
