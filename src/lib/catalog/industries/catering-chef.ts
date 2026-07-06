import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1555507036-ab1f4038808a'

function cf(label: string, group: string, themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry: 'catering-chef', keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['gourmet-warm', 'rustic-pantry', 'classic-warm', 'event-festive'] as const
const L = ['event-booking', 'gallery-showcase', 'storyteller', 'conversion-focus'] as const

export const CATERING_CHEF_SERVICES: ServiceDef[] = [
  cf('Full-Service Event Catering', 'Events', [...T], [...L, 'standard'], { image: IMG, description: 'From appetizers to dessert — full-service catering for weddings, parties, and corporate events.' }, ['event catering', 'catering service', 'wedding catering', 'party catering', 'full service catering']),
  cf('Personal Chef Service', 'Personal', ['gourmet-warm', 'luxury-minimal', 'sophisticated-wine', 'classic-warm'], ['storyteller', 'gallery-showcase', 'trust-builder', 'event-booking'], { image: IMG, description: 'A private chef shops, cooks, and cleans in your home — weekly or special occasion.' }, ['personal chef', 'private chef', 'in home chef', 'home chef service']),
  cf('Meal Prep Service', 'Meal Prep', ['gourmet-warm', 'fresh-clean', 'classic-warm', 'minimalist-zen'], ['trust-builder', 'compact-quote', 'storyteller', 'standard'], { image: IMG, description: 'Weekly meal prep and delivery tailored to your dietary needs and preferences.' }, ['meal prep', 'meal prep service', 'weekly meals', 'healthy meal prep', 'meal delivery']),
  cf('Corporate Catering', 'Corporate', ['commercial-pro', 'gourmet-warm', 'modern-office', 'classic-warm'], ['trust-builder', 'event-booking', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'Office lunches, meeting catering, and corporate event food service.' }, ['corporate catering', 'office catering', 'business catering', 'lunch catering']),
  cf('BBQ & Outdoor Catering', 'Specialty', ['gourmet-warm', 'rustic-pantry', 'event-festive', 'artisan-wood'], ['event-booking', 'gallery-showcase', 'storyteller', 'visual-impact'], { image: IMG, description: 'Smoked meats, sides, and full BBQ spreads for backyard parties and reunions.' }, ['bbq catering', 'barbecue catering', 'outdoor catering', 'pig roast', 'bbq party']),
  cf('Dietary-Specific Catering', 'Specialty', ['gourmet-warm', 'wellness-calm', 'minimalist-zen', 'classic-warm'], ['trust-builder', 'storyteller', 'gallery-showcase', 'event-booking'], { image: IMG, description: 'Vegan, gluten-free, Kosher, Halal, and allergy-friendly catering menus.' }, ['vegan catering', 'gluten free catering', 'allergen free catering', 'kosher catering', 'halal catering']),
]

export const CATERING_CHEF_INDUSTRY: IndustryDef = {
  slug: 'catering-chef', label: 'Catering & Personal Chef',
  keywords: ['catering', 'personal chef', 'private chef', 'event catering', 'meal prep', 'wedding catering', 'corporate catering'],
  serviceGroups: ['Events', 'Personal', 'Meal Prep', 'Corporate', 'Specialty'],
  defaultThemes: ['gourmet-warm', 'rustic-pantry', 'classic-warm', 'event-festive'],
  defaultLayouts: ['event-booking', 'gallery-showcase', 'storyteller', 'conversion-focus'],
  services: CATERING_CHEF_SERVICES,
}
