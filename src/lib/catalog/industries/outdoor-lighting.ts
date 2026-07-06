import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13'

function ol(label: string, group: string, themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry: 'outdoor-lighting', keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['luxury-minimal', 'pool-resort', 'classic-warm', 'coastal-climate'] as const
const L = ['gallery-showcase', 'visual-impact', 'portfolio-first', 'seasonal-cta'] as const

export const OUTDOOR_LIGHTING_SERVICES: ServiceDef[] = [
  ol('Landscape Lighting Installation', 'Landscape', [...T, 'artisan-wood'], [...L, 'storyteller'], { image: IMG, description: 'Pathway, uplighting, and accent lighting that showcases your home after dark.' }, ['landscape lighting', 'outdoor lighting install', 'garden lighting', 'pathway lights']),
  ol('Holiday & Event Lighting', 'Seasonal', ['event-festive', 'classic-warm', 'pool-resort', 'kids-playful'], ['seasonal-cta', 'gallery-showcase', 'visual-impact', 'event-booking'], { image: IMG, description: 'Professional holiday light installation — fully managed, stored off-season.' }, ['holiday lights', 'christmas lights install', 'holiday lighting', 'event lights']),
  ol('Security & Flood Lighting', 'Security', ['home-guardian', 'functional-utility', 'modern-office', 'commercial-pro'], ['trust-builder', 'compact-quote', 'conversion-focus', 'local-expert'], { image: IMG, description: 'Motion-activated flood lights, dusk-to-dawn lighting, and perimeter security.' }, ['security lighting', 'flood light install', 'motion light', 'dusk to dawn light']),
  ol('Smart Outdoor Lighting', 'Smart', ['modern-office', 'luxury-minimal', 'sleek-entertainment', 'minimalist-zen'], ['compact-quote', 'process-steps', 'trust-builder', 'conversion-focus'], { image: IMG, description: 'App-controlled color-changing and scheduled outdoor lighting systems.' }, ['smart outdoor lights', 'wifi lights', 'app controlled lighting', 'color outdoor lights']),
  ol('Pool & Patio Lighting', 'Entertainment', ['pool-resort', 'luxury-minimal', 'coastal-climate', 'sophisticated-wine'], ['gallery-showcase', 'visual-impact', 'portfolio-first', 'storyteller'], { image: IMG, description: 'Pool perimeter, deck, pergola, and patio lighting for outdoor entertaining.' }, ['pool lighting', 'patio lights', 'deck lighting', 'pergola lights']),
  ol('Commercial Outdoor Lighting', 'Commercial', ['commercial-pro', 'modern-office', 'functional-utility', 'brutalist'], ['trust-builder', 'compact-quote', 'local-expert', 'conversion-focus'], { image: IMG, description: 'Parking lot, storefront, and signage lighting for commercial properties.' }, ['commercial lighting', 'parking lot lights', 'storefront lighting', 'led commercial lights']),
]

export const OUTDOOR_LIGHTING_INDUSTRY: IndustryDef = {
  slug: 'outdoor-lighting', label: 'Outdoor Lighting',
  keywords: ['outdoor lighting', 'landscape lighting', 'holiday lights', 'security lighting', 'pool lighting', 'exterior lights'],
  serviceGroups: ['Landscape', 'Seasonal', 'Security', 'Smart', 'Entertainment', 'Commercial'],
  defaultThemes: ['luxury-minimal', 'pool-resort', 'classic-warm', 'coastal-climate'],
  defaultLayouts: ['gallery-showcase', 'visual-impact', 'portfolio-first', 'seasonal-cta'],
  services: OUTDOOR_LIGHTING_SERVICES,
}
