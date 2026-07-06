import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1595428774223-ef52624120d2'
const CARE_IMG = 'https://images.unsplash.com/photo-1507842217343-583bb7270b66'

function pw(
  label: string,
  group: string,
  industry: 'beauty-salon' | 'spa-wellness' | 'fitness-studio' | 'life-services' | 'laundry-services',
  themes: ServiceDef['recommendedThemes'],
  layouts: ServiceDef['recommendedLayouts'],
  catalog: ServiceDef['catalog'],
  keywords: string[] = []
): ServiceDef {
  return { label, group, industry, keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const BEAUTY_T = ['elegant-dressing', 'playful-kids', 'sleek-entertainment', 'classic-warm'] as const
const BEAUTY_L = ['gallery-showcase', 'portfolio-first', 'local-expert', 'before-after'] as const

export const BEAUTY_SALON_SERVICES: ServiceDef[] = [
  pw('Hair Salon Services', 'Hair', 'beauty-salon', [...BEAUTY_T], [...BEAUTY_L], { image: IMG, description: 'Cuts, color, and styling from experienced stylists in a relaxing salon.' }, ['hair salon', 'haircut', 'hair color', 'hairstylist']),
  pw('Barbershop Services', 'Barber', 'beauty-salon', ['elegant-dressing', 'brutalist', 'classic-warm', 'sleek-entertainment'], ['gallery-showcase', 'local-expert', 'before-after', 'standard'], { image: IMG, description: 'Classic and modern cuts, fades, and hot towel shaves.' }, ['barbershop', 'barber', 'mens haircut', 'fade haircut']),
  pw('Nail Salon Services', 'Nails', 'beauty-salon', ['elegant-dressing', 'playful-kids', 'classic-warm', 'sleek-entertainment'], ['gallery-showcase', 'before-after', 'local-expert', 'standard'], { image: IMG, description: 'Manicures, pedicures, and nail art in a clean, relaxing studio.' }, ['nail salon', 'manicure', 'pedicure', 'nail art']),
  pw('Tattoo Parlor', 'Tattoo', 'beauty-salon', ['brutalist', 'sleek-entertainment', 'media-theater', 'elegant-dressing'], ['portfolio-first', 'gallery-showcase', 'before-after', 'standard'], { image: IMG, description: 'Custom tattoo design and inking by experienced licensed artists.' }, ['tattoo parlor', 'tattoo shop', 'tattoo artist', 'custom tattoo']),
]

const SPA_T = ['wellness-calm', 'elegant-dressing', 'minimalist-zen', 'care-comfort'] as const
const SPA_L = ['storyteller', 'trust-builder', 'gallery-showcase', 'event-booking'] as const

export const SPA_WELLNESS_SERVICES: ServiceDef[] = [
  pw('Day Spa Packages', 'Spa', 'spa-wellness', [...SPA_T], [...SPA_L], { image: IMG, description: 'Full-day spa packages including facials, body treatments, and relaxation.' }, ['day spa', 'spa package', 'spa day', 'spa treatment']),
  pw('Massage Therapy Clinic', 'Massage', 'spa-wellness', ['wellness-calm', 'care-comfort', 'minimalist-zen', 'classic-warm'], ['trust-builder', 'storyteller', 'local-expert', 'standard'], { image: IMG, description: 'Licensed massage therapy clinic offering a full range of modalities.' }, ['massage clinic', 'massage therapy', 'spa massage', 'therapeutic massage']),
  pw('Sauna & Recovery Suite', 'Recovery', 'spa-wellness', ['wellness-calm', 'minimalist-zen', 'elegant-dressing', 'coastal-climate'], ['gallery-showcase', 'trust-builder', 'standard', 'event-booking'], { image: IMG, description: 'Sauna, cold plunge, and recovery suite memberships and drop-ins.' }, ['sauna', 'recovery suite', 'cold plunge', 'wellness recovery']),
]

const FIT_T = ['wellness-calm', 'brutalist', 'modern-office', 'playful-kids'] as const
const FIT_L = ['trust-builder', 'local-expert', 'process-steps', 'gallery-showcase'] as const

export const FITNESS_STUDIO_SERVICES: ServiceDef[] = [
  pw('Gym Membership', 'Gym', 'fitness-studio', [...FIT_T], [...FIT_L], { image: IMG, description: 'Full gym access with strength, cardio, and group class amenities.' }, ['gym membership', 'gym', 'fitness center', 'health club']),
  pw('Yoga Studio Classes', 'Yoga', 'fitness-studio', ['wellness-calm', 'minimalist-zen', 'coastal-climate', 'classic-warm'], ['trust-builder', 'gallery-showcase', 'local-expert', 'standard'], { image: IMG, description: 'Drop-in and membership yoga classes for all levels.' }, ['yoga studio', 'yoga classes', 'yoga membership', 'hot yoga']),
  pw('Personal Training Studio', 'Training', 'fitness-studio', ['wellness-calm', 'brutalist', 'modern-office', 'functional-utility'], ['process-steps', 'trust-builder', 'local-expert', 'standard'], { image: IMG, description: 'One-on-one and small-group personal training at our studio.' }, ['personal training studio', 'training gym', 'strength training studio']),
  pw('Martial Arts School', 'Martial Arts', 'fitness-studio', ['brutalist', 'playful-kids', 'wellness-calm', 'classic-warm'], ['trust-builder', 'process-steps', 'local-expert', 'gallery-showcase'], { image: IMG, description: 'Martial arts classes for kids and adults — belt progression included.' }, ['martial arts school', 'karate classes', 'jiu jitsu', 'self defense classes']),
]

const LIFE_T = ['care-comfort', 'historic-classic', 'classic-warm', 'minimalist-zen'] as const
const LIFE_L = ['storyteller', 'trust-builder', 'standard', 'compact-quote'] as const

export const LIFE_SERVICES_SERVICES: ServiceDef[] = [
  pw('Funeral Home Services', 'Funeral', 'life-services', [...LIFE_T], [...LIFE_L], { image: CARE_IMG, description: 'Compassionate funeral planning, memorial services, and cremation.' }, ['funeral home', 'funeral services', 'memorial service', 'cremation services']),
  pw('Matchmaking Services', 'Matchmaking', 'life-services', ['elegant-dressing', 'classic-warm', 'wellness-calm', 'minimalist-zen'], ['storyteller', 'trust-builder', 'standard', 'compact-quote'], { image: CARE_IMG, description: 'Personalized matchmaking and dating coaching from experienced matchmakers.' }, ['matchmaking', 'matchmaker', 'dating service', 'dating coach']),
  pw('Life Coaching', 'Coaching', 'life-services', ['wellness-calm', 'minimalist-zen', 'classic-warm', 'care-comfort'], ['storyteller', 'trust-builder', 'process-steps', 'standard'], { image: CARE_IMG, description: 'One-on-one life coaching to help you reach personal and career goals.' }, ['life coach', 'life coaching', 'personal coaching', 'goal coaching']),
  pw('Career Counseling', 'Career', 'life-services', ['modern-office', 'wellness-calm', 'commercial-pro', 'minimalist-zen'], ['trust-builder', 'process-steps', 'standard', 'compact-quote'], { image: CARE_IMG, description: 'Career counseling, resume review, and job search coaching.' }, ['career counseling', 'career coach', 'resume review', 'job search coaching']),
]

const LAUNDRY_T = ['laundry-clean', 'fresh-clean', 'functional-utility', 'modern-office'] as const
const LAUNDRY_L = ['local-expert', 'compact-quote', 'standard', 'service-zones'] as const

export const LAUNDRY_SERVICES_SERVICES: ServiceDef[] = [
  pw('Dry Cleaning', 'Dry Cleaning', 'laundry-services', [...LAUNDRY_T], [...LAUNDRY_L], { image: IMG, description: 'Professional dry cleaning with pickup and delivery available.' }, ['dry cleaning', 'dry cleaners', 'garment cleaning', 'suit cleaning']),
  pw('Laundromat Services', 'Laundromat', 'laundry-services', ['laundry-clean', 'fresh-clean', 'functional-utility', 'classic-warm'], ['local-expert', 'compact-quote', 'standard', 'service-zones'], { image: IMG, description: 'Self-service and wash-and-fold laundromat with same-day turnaround.' }, ['laundromat', 'wash and fold', 'coin laundry', 'laundry service']),
  pw('Linen & Alteration Services', 'Alterations', 'laundry-services', ['laundry-clean', 'elegant-dressing', 'classic-warm', 'functional-utility'], ['local-expert', 'trust-builder', 'compact-quote', 'standard'], { image: IMG, description: 'Linen rental, alterations, and tailoring for homes and businesses.' }, ['linen service', 'alterations', 'tailoring', 'linen rental']),
]

export const BEAUTY_SALON_INDUSTRY: IndustryDef = {
  slug: 'beauty-salon', label: 'Beauty & Grooming',
  keywords: ['hair salon', 'barbershop', 'nail salon', 'tattoo parlor', 'beauty salon'],
  serviceGroups: ['Hair', 'Barber', 'Nails', 'Tattoo'],
  defaultThemes: [...BEAUTY_T],
  defaultLayouts: [...BEAUTY_L],
  services: BEAUTY_SALON_SERVICES,
}

export const SPA_WELLNESS_INDUSTRY: IndustryDef = {
  slug: 'spa-wellness', label: 'Wellness & Spa',
  keywords: ['day spa', 'massage clinic', 'sauna', 'wellness spa', 'wellness center'],
  serviceGroups: ['Spa', 'Massage', 'Recovery'],
  defaultThemes: [...SPA_T],
  defaultLayouts: [...SPA_L],
  services: SPA_WELLNESS_SERVICES,
}

export const FITNESS_STUDIO_INDUSTRY: IndustryDef = {
  slug: 'fitness-studio', label: 'Fitness & Sports Studios',
  keywords: ['gym', 'yoga studio', 'martial arts school', 'fitness studio', 'health club'],
  serviceGroups: ['Gym', 'Yoga', 'Training', 'Martial Arts'],
  defaultThemes: [...FIT_T],
  defaultLayouts: [...FIT_L],
  services: FITNESS_STUDIO_SERVICES,
}

export const LIFE_SERVICES_INDUSTRY: IndustryDef = {
  slug: 'life-services', label: 'Life Services',
  keywords: ['funeral home', 'matchmaking', 'life coach', 'career counseling'],
  serviceGroups: ['Funeral', 'Matchmaking', 'Coaching', 'Career'],
  defaultThemes: [...LIFE_T],
  defaultLayouts: [...LIFE_L],
  services: LIFE_SERVICES_SERVICES,
}

export const LAUNDRY_SERVICES_INDUSTRY: IndustryDef = {
  slug: 'laundry-services', label: 'Laundry Services',
  keywords: ['dry cleaners', 'laundromat', 'linen service', 'alterations', 'laundry service'],
  serviceGroups: ['Dry Cleaning', 'Laundromat', 'Alterations'],
  defaultThemes: [...LAUNDRY_T],
  defaultLayouts: [...LAUNDRY_L],
  services: LAUNDRY_SERVICES_SERVICES,
}
