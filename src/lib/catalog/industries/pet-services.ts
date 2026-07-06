import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const PET_IMG = 'https://images.unsplash.com/photo-1587300003388-59208cc962cb'
const GROOM_IMG = 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7'
const CAT_IMG = 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba'

function pet(
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
    industry: 'pet-services',
    keywords,
    widgetCategory: label,
    recommendedThemes: themes,
    recommendedLayouts: layouts,
    catalog,
  }
}

const PET_THEMES = ['pastoral-pet', 'playful-kids', 'classic-warm', 'care-comfort'] as const
const PET_LAYOUTS = ['storyteller', 'trust-builder', 'local-expert', 'gallery-showcase'] as const

export const PET_SERVICES_SERVICES: ServiceDef[] = [
  pet(
    'Dog Walking',
    'Walking',
    [...PET_THEMES],
    [...PET_LAYOUTS, 'standard'],
    { image: PET_IMG, description: 'Reliable daily and on-demand dog walks with GPS updates.' },
    ['dog walking', 'dog walker', 'daily walks', 'pet walking']
  ),
  pet(
    'Pet Sitting & Drop-In Visits',
    'Sitting',
    ['pastoral-pet', 'care-comfort', 'classic-warm', 'playful-kids'],
    ['trust-builder', 'storyteller', 'local-expert', 'standard'],
    { image: CAT_IMG, description: 'In-home pet sitting and drop-in visits so pets stay in their comfort zone.' },
    ['pet sitting', 'pet sitter', 'drop in visit', 'cat sitting', 'pet care']
  ),
  pet(
    'Dog Boarding',
    'Boarding',
    ['pastoral-pet', 'care-comfort', 'playful-kids', 'classic-warm'],
    ['trust-builder', 'gallery-showcase', 'storyteller', 'local-expert'],
    { image: PET_IMG, description: 'Home-style dog boarding — your dog stays with a sitter, not in a cage.' },
    ['dog boarding', 'overnight dog care', 'dog hotel', 'pet boarding']
  ),
  pet(
    'Mobile Pet Grooming',
    'Grooming',
    ['pastoral-pet', 'fresh-clean', 'classic-warm', 'playful-kids'],
    ['gallery-showcase', 'before-after', 'trust-builder', 'local-expert'],
    { image: GROOM_IMG, description: 'Full grooming in a mobile salon van — no cages, no waiting.' },
    ['mobile grooming', 'pet grooming', 'dog grooming', 'mobile dog groomer', 'grooming van']
  ),
  pet(
    'Salon Pet Grooming',
    'Grooming',
    ['pastoral-pet', 'fresh-clean', 'classic-warm', 'elegant-dressing'],
    ['gallery-showcase', 'before-after', 'trust-builder', 'local-expert'],
    { image: GROOM_IMG, description: 'Full-service grooming salon — baths, haircuts, nail trims, and more.' },
    ['pet grooming salon', 'dog haircut', 'bath and brush', 'nail trim', 'groomer']
  ),
  pet(
    'Dog Training',
    'Training',
    ['pastoral-pet', 'playful-kids', 'care-comfort', 'classic-warm'],
    ['process-steps', 'trust-builder', 'storyteller', 'local-expert'],
    { image: PET_IMG, description: 'Obedience, puppy, and behavior correction training in your home.' },
    ['dog training', 'dog trainer', 'obedience training', 'puppy training', 'behavior training']
  ),
  pet(
    'Doggy Daycare',
    'Daycare',
    ['pastoral-pet', 'playful-kids', 'classic-warm', 'care-comfort'],
    ['gallery-showcase', 'trust-builder', 'storyteller', 'standard'],
    { image: PET_IMG, description: 'Supervised daycare with play, socialization, and enrichment activities.' },
    ['doggy daycare', 'dog daycare', 'dog day care', 'pet daycare']
  ),
  pet(
    'Pet Taxi & Transport',
    'Transport',
    ['pastoral-pet', 'swift-mobile', 'care-comfort', 'classic-warm'],
    ['compact-quote', 'trust-builder', 'local-expert', 'conversion-focus'],
    { image: PET_IMG, description: 'Safe, stress-free pet transport to vets, groomers, and beyond.' },
    ['pet taxi', 'pet transport', 'pet shuttle', 'vet transport', 'cat transport']
  ),
]

export const PET_SERVICES_INDUSTRY: IndustryDef = {
  slug: 'pet-services',
  label: 'Pet Services',
  keywords: ['dog', 'grooming', 'dog walking', 'pet sitting', 'dog boarding', 'pet care', 'doggy daycare', 'pet grooming', 'cat sitting', 'cat grooming', 'cat boarding'],
  serviceGroups: ['Walking', 'Sitting', 'Boarding', 'Grooming', 'Training', 'Daycare', 'Transport'],
  defaultThemes: ['pastoral-pet', 'playful-kids', 'classic-warm', 'care-comfort'],
  defaultLayouts: ['storyteller', 'trust-builder', 'local-expert', 'gallery-showcase'],
  services: PET_SERVICES_SERVICES,
}
