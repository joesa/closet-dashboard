import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30'

function ev(label: string, group: string, industry: 'event-rentals' | 'dj-entertainment' | 'bounce-house' | 'food-truck', themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry, keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['event-festive', 'playful-kids', 'gourmet-warm', 'classic-warm'] as const
const L = ['event-booking', 'gallery-showcase', 'compact-quote', 'conversion-focus'] as const

export const EVENT_RENTALS_SERVICES: ServiceDef[] = [
  ev('Tent & Canopy Rental', 'Tents', 'event-rentals', [...T, 'rustic-pantry'], [...L, 'trust-builder'], { image: IMG, description: 'Pole, frame, and clear-span tents for weddings, parties, and corporate events.' }, ['tent rental', 'canopy rental', 'event tent', 'party tent', 'wedding tent']),
  ev('Tables, Chairs & Linens', 'Furniture', 'event-rentals', [...T], [...L], { image: IMG, description: 'Round, rectangular, and cocktail tables, folding chairs, and linens delivered.' }, ['table rental', 'chair rental', 'event rentals', 'party rentals', 'linen rental']),
  ev('Stage & Lighting Rental', 'AV', 'event-rentals', ['event-festive', 'sleek-entertainment', 'media-creative', 'brutalist'], ['gallery-showcase', 'event-booking', 'visual-impact', 'conversion-focus'], { image: IMG, description: 'Portable stages, uplighting, string lights, and truss packages for any event.' }, ['stage rental', 'lighting rental', 'uplighting', 'event lighting', 'string lights']),
  ev('Photo Booth Rental', 'Entertainment', 'event-rentals', ['event-festive', 'playful-kids', 'media-creative', 'elegant-dressing'], ['gallery-showcase', 'event-booking', 'visual-impact', 'compact-quote'], { image: IMG, description: 'Open-air and enclosed photo booths with instant prints and digital sharing.' }, ['photo booth rental', 'photo booth', 'wedding photo booth', 'party photo booth']),
]

export const DJ_ENTERTAINMENT_SERVICES: ServiceDef[] = [
  ev('Wedding DJ', 'Weddings', 'dj-entertainment', ['event-festive', 'elegant-dressing', 'luxury-minimal', 'sophisticated-wine'], ['event-booking', 'storyteller', 'gallery-showcase', 'conversion-focus'], { image: IMG, description: 'Professional wedding DJ and MC — ceremony, cocktail hour, and reception.' }, ['wedding dj', 'wedding disc jockey', 'wedding entertainment', 'dj for wedding']),
  ev('Party & Corporate DJ', 'Events', 'dj-entertainment', ['event-festive', 'sleek-entertainment', 'commercial-pro', 'modern-office'], ['event-booking', 'gallery-showcase', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'DJ entertainment for corporate parties, school dances, and private events.' }, ['party dj', 'event dj', 'corporate dj', 'dj service', 'mobile dj']),
  ev('Karaoke DJ', 'Entertainment', 'dj-entertainment', ['event-festive', 'playful-kids', 'classic-warm', 'gourmet-warm'], ['event-booking', 'compact-quote', 'gallery-showcase', 'local-expert'], { image: IMG, description: 'Karaoke systems with tens of thousands of songs — hosted by our DJ.' }, ['karaoke dj', 'karaoke rental', 'karaoke host', 'karaoke night']),
]

export const BOUNCE_HOUSE_SERVICES: ServiceDef[] = [
  ev('Bounce House Rental', 'Inflatables', 'bounce-house', ['playful-kids', 'event-festive', 'classic-warm', 'gourmet-warm'], [...L, 'trust-builder'], { image: IMG, description: 'Delivery, setup, and pickup of bounce houses for backyard and school parties.' }, ['bounce house rental', 'bouncy castle', 'inflatable rental', 'bounce castle', 'jump house']),
  ev('Water Slide Rental', 'Inflatables', 'bounce-house', ['playful-kids', 'pool-resort', 'event-festive', 'coastal-climate'], [...L, 'trust-builder'], { image: IMG, description: 'Giant water slides and splash pads for summer parties and events.' }, ['water slide rental', 'inflatable water slide', 'water slide party']),
  ev('Obstacle Course & Combo Unit', 'Inflatables', 'bounce-house', ['playful-kids', 'event-festive', 'sleek-entertainment', 'brutalist'], [...L], { image: IMG, description: 'Inflatable obstacle courses, combo bounce-slide units, and party packages.' }, ['obstacle course rental', 'combo bounce house', 'inflatable obstacle', 'party package inflatables']),
  ev('Dunk Tank & Carnival Games', 'Entertainment', 'bounce-house', ['playful-kids', 'event-festive', 'classic-warm', 'rustic-pantry'], [...L, 'trust-builder'], { image: IMG, description: 'Dunk tanks, carnival game booths, and concession machines for any event.' }, ['dunk tank rental', 'carnival games', 'concession machine', 'cotton candy machine']),
]

export const FOOD_TRUCK_SERVICES: ServiceDef[] = [
  ev('Food Truck Booking', 'Catering', 'food-truck', ['gourmet-warm', 'event-festive', 'rustic-pantry', 'artisan-wood'], ['event-booking', 'gallery-showcase', 'storyteller', 'conversion-focus'], { image: IMG, description: 'Book our food truck for private parties, corporate events, and festivals.' }, ['food truck', 'food truck catering', 'food truck rental', 'book food truck', 'food truck event']),
  ev('Corporate Lunch Rotation', 'Corporate', 'food-truck', ['gourmet-warm', 'commercial-pro', 'modern-office', 'event-festive'], ['event-booking', 'trust-builder', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'Regular lunch stops at your office or business park — contact us to schedule.' }, ['food truck office', 'corporate food truck', 'office lunch food truck', 'food truck schedule']),
  ev('Festival & Pop-Up Vending', 'Events', 'food-truck', ['gourmet-warm', 'event-festive', 'rustic-pantry', 'media-creative'], ['event-booking', 'gallery-showcase', 'storyteller', 'local-expert'], { image: IMG, description: 'Food truck vending at farmers markets, festivals, and pop-up events.' }, ['food truck festival', 'pop up food', 'food truck market', 'street food vendor']),
]

export const EVENT_RENTALS_INDUSTRY: IndustryDef = {
  slug: 'event-rentals', label: 'Event Rentals',
  keywords: ['event rentals', 'party rentals', 'tent rental', 'table chair rental', 'stage rental', 'photo booth'],
  serviceGroups: ['Tents', 'Furniture', 'AV', 'Entertainment'],
  defaultThemes: ['event-festive', 'playful-kids', 'classic-warm', 'gourmet-warm'],
  defaultLayouts: ['event-booking', 'gallery-showcase', 'compact-quote', 'conversion-focus'],
  services: EVENT_RENTALS_SERVICES,
}

export const DJ_ENTERTAINMENT_INDUSTRY: IndustryDef = {
  slug: 'dj-entertainment', label: 'DJ & Entertainment',
  keywords: ['wedding dj', 'event dj', 'disc jockey', 'party entertainment', 'karaoke'],
  serviceGroups: ['Weddings', 'Events', 'Entertainment'],
  defaultThemes: ['event-festive', 'sleek-entertainment', 'elegant-dressing', 'playful-kids'],
  defaultLayouts: ['event-booking', 'gallery-showcase', 'storyteller', 'conversion-focus'],
  services: DJ_ENTERTAINMENT_SERVICES,
}

export const BOUNCE_HOUSE_INDUSTRY: IndustryDef = {
  slug: 'bounce-house', label: 'Bounce House & Inflatable Rentals',
  engagementModel: 'ticket',
  keywords: ['bounce house', 'inflatable rental', 'water slide rental', 'bouncy castle', 'obstacle course', 'party inflatables'],
  serviceGroups: ['Inflatables', 'Entertainment'],
  defaultThemes: ['playful-kids', 'event-festive', 'classic-warm', 'gourmet-warm'],
  defaultLayouts: ['event-booking', 'gallery-showcase', 'compact-quote', 'trust-builder'],
  services: BOUNCE_HOUSE_SERVICES,
}

export const FOOD_TRUCK_INDUSTRY: IndustryDef = {
  slug: 'food-truck', label: 'Food Truck',
  engagementModel: 'order',
  keywords: ['food truck', 'food truck catering', 'food truck rental', 'food truck events', 'mobile food'],
  serviceGroups: ['Catering', 'Corporate', 'Events'],
  defaultThemes: ['gourmet-warm', 'event-festive', 'rustic-pantry', 'artisan-wood'],
  defaultLayouts: ['event-booking', 'gallery-showcase', 'storyteller', 'conversion-focus'],
  services: FOOD_TRUCK_SERVICES,
}
