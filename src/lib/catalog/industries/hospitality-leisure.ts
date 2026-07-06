import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1556910103-1c02745a872f'
const ARTS_IMG = 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5'

function hl(
  label: string,
  group: string,
  industry: 'hotel-lodging' | 'restaurants-bars' | 'tourism-travel' | 'event-planning' | 'recreation-entertainment' | 'arts-culture',
  themes: ServiceDef['recommendedThemes'],
  layouts: ServiceDef['recommendedLayouts'],
  catalog: ServiceDef['catalog'],
  keywords: string[] = []
): ServiceDef {
  return { label, group, industry, keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const HOTEL_T = ['luxury-minimal', 'coastal-climate', 'classic-warm', 'sleek-entertainment'] as const
const HOTEL_L = ['gallery-showcase', 'visual-impact', 'event-booking', 'storyteller'] as const

export const HOTEL_LODGING_SERVICES: ServiceDef[] = [
  hl('Hotel & Resort Booking', 'Accommodations', 'hotel-lodging', [...HOTEL_T], [...HOTEL_L], { image: IMG, description: 'Full-service hotel and resort rooms with amenities booked instantly online.' }, ['hotel booking', 'resort reservation', 'hotel room', 'resort stay']),
  hl('Bed & Breakfast Stay', 'Accommodations', 'hotel-lodging', ['classic-warm', 'cozy-library', 'coastal-climate', 'luxury-minimal'], ['storyteller', 'gallery-showcase', 'trust-builder', 'event-booking'], { image: IMG, description: 'Charming, locally-owned bed & breakfast rooms with home-cooked breakfast included.' }, ['bed and breakfast', 'b&b', 'inn stay', 'guesthouse']),
  hl('Hostel & Budget Stay', 'Accommodations', 'hotel-lodging', ['modern-office', 'playful-kids', 'coastal-climate', 'functional-utility'], ['compact-quote', 'gallery-showcase', 'standard', 'local-expert'], { image: IMG, description: 'Affordable shared and private hostel rooms for travelers on a budget.' }, ['hostel', 'budget lodging', 'shared room', 'backpacker stay']),
  hl('Campground & RV Site', 'Accommodations', 'hotel-lodging', ['rustic-pantry', 'coastal-climate', 'functional-utility', 'classic-warm'], ['gallery-showcase', 'service-zones', 'local-expert', 'compact-quote'], { image: IMG, description: 'Tent, cabin, and RV hookup sites with full campground amenities.' }, ['campground', 'rv park', 'campsite booking', 'rv hookup']),
]

const REST_T = ['gourmet-warm', 'sleek-entertainment', 'classic-warm', 'media-theater'] as const
const REST_L = ['gallery-showcase', 'visual-impact', 'event-booking', 'storyteller'] as const

export const RESTAURANTS_BARS_SERVICES: ServiceDef[] = [
  hl('Restaurant Dining', 'Dining', 'restaurants-bars', [...REST_T], [...REST_L], { image: IMG, description: 'Full-service restaurant dining with reservations, private events, and takeout.' }, ['restaurant', 'fine dining', 'dinner reservation', 'restaurant booking']),
  hl('Bar & Cocktail Lounge', 'Nightlife', 'restaurants-bars', ['sleek-entertainment', 'media-theater', 'brutalist', 'gourmet-warm'], ['gallery-showcase', 'event-booking', 'visual-impact', 'storyteller'], { image: IMG, description: 'Craft cocktail bar and lounge with happy hour, live music, and private events.' }, ['bar', 'cocktail lounge', 'happy hour', 'wine bar']),
  hl('Cafe & Coffee Shop', 'Cafe', 'restaurants-bars', ['gourmet-warm', 'classic-warm', 'rustic-pantry', 'cozy-library'], ['gallery-showcase', 'local-expert', 'storyteller', 'standard'], { image: IMG, description: 'Neighborhood cafe serving coffee, pastries, and light bites all day.' }, ['cafe', 'coffee shop', 'espresso bar', 'bakery cafe']),
  hl('Nightclub & Live Venue', 'Nightlife', 'restaurants-bars', ['sleek-entertainment', 'media-theater', 'brutalist', 'event-festive'], ['event-booking', 'visual-impact', 'gallery-showcase', 'storyteller'], { image: ARTS_IMG, description: 'Nightclub and live music venue with bottle service, DJs, and private events.' }, ['nightclub', 'live music venue', 'dance club', 'dj night']),
]

const TOUR_T = ['coastal-climate', 'luxury-gallery', 'media-creative', 'classic-warm'] as const
const TOUR_L = ['gallery-showcase', 'storyteller', 'event-booking', 'visual-impact'] as const

export const TOURISM_TRAVEL_SERVICES: ServiceDef[] = [
  hl('Travel Agency Booking', 'Travel', 'tourism-travel', [...TOUR_T], [...TOUR_L], { image: IMG, description: 'Full-service travel planning — flights, hotels, and custom itineraries.' }, ['travel agency', 'trip planning', 'vacation booking', 'travel agent']),
  hl('Guided Tours', 'Tours', 'tourism-travel', ['coastal-climate', 'classic-warm', 'media-creative', 'luxury-gallery'], ['storyteller', 'gallery-showcase', 'local-expert', 'event-booking'], { image: IMG, description: 'Local guided tours — walking, historical, food, and adventure tours.' }, ['guided tour', 'walking tour', 'sightseeing tour', 'tour guide']),
  hl('Cruise Booking', 'Cruises', 'tourism-travel', ['coastal-climate', 'luxury-gallery', 'luxury-minimal', 'classic-warm'], ['gallery-showcase', 'visual-impact', 'event-booking', 'storyteller'], { image: IMG, description: 'Ocean and river cruise packages with cabin selection and shore excursions.' }, ['cruise booking', 'cruise line', 'cruise vacation', 'cruise package']),
  hl('Adventure & Outdoor Tours', 'Tours', 'tourism-travel', ['coastal-climate', 'rustic-pantry', 'media-creative', 'classic-warm'], ['gallery-showcase', 'storyteller', 'local-expert', 'event-booking'], { image: IMG, description: 'Hiking, kayaking, and outdoor adventure tours led by local experts.' }, ['adventure tour', 'outdoor tour', 'hiking tour', 'excursion booking']),
]

const EVENT_T = ['event-festive', 'luxury-gallery', 'elegant-dressing', 'media-creative'] as const
const EVENT_L = ['event-booking', 'gallery-showcase', 'storyteller', 'portfolio-first'] as const

export const EVENT_PLANNING_SERVICES: ServiceDef[] = [
  hl('Wedding Planning', 'Weddings', 'event-planning', [...EVENT_T], [...EVENT_L], { image: IMG, description: 'Full-service wedding planning and day-of coordination for your dream day.' }, ['wedding planner', 'wedding planning', 'wedding coordinator', 'wedding day of']),
  hl('Corporate Event & Conference Planning', 'Corporate', 'event-planning', ['commercial-pro', 'event-festive', 'modern-office', 'luxury-gallery'], ['event-booking', 'trust-builder', 'storyteller', 'gallery-showcase'], { image: IMG, description: 'Corporate conferences, retreats, and product launches planned start to finish.' }, ['corporate event planning', 'conference planning', 'corporate retreat', 'event coordinator']),
  hl('Concert & Festival Production', 'Live Events', 'event-planning', ['event-festive', 'media-theater', 'sleek-entertainment', 'brutalist'], ['event-booking', 'visual-impact', 'gallery-showcase', 'storyteller'], { image: ARTS_IMG, description: 'Concert and festival production — logistics, vendors, and stage management.' }, ['concert production', 'festival planning', 'event production', 'festival organizer']),
  hl('Private Party & Celebration Planning', 'Celebrations', 'event-planning', ['event-festive', 'playful-kids', 'elegant-dressing', 'classic-warm'], ['event-booking', 'gallery-showcase', 'storyteller', 'local-expert'], { image: IMG, description: 'Birthdays, anniversaries, and milestone celebrations planned and styled.' }, ['party planner', 'celebration planning', 'birthday party planning', 'anniversary party']),
]

const REC_T = ['playful-kids', 'sleek-entertainment', 'event-festive', 'media-theater'] as const
const REC_L = ['gallery-showcase', 'visual-impact', 'event-booking', 'local-expert'] as const

export const RECREATION_ENTERTAINMENT_SERVICES: ServiceDef[] = [
  hl('Amusement Park Admission', 'Parks', 'recreation-entertainment', [...REC_T], [...REC_L], { image: IMG, description: 'Amusement park tickets, season passes, and group/party packages.' }, ['amusement park', 'theme park tickets', 'park admission', 'season pass']),
  hl('Arcade & Family Entertainment', 'Arcade', 'recreation-entertainment', ['playful-kids', 'sleek-entertainment', 'event-festive', 'media-theater'], ['gallery-showcase', 'event-booking', 'local-expert', 'standard'], { image: IMG, description: 'Arcade games, laser tag, and family entertainment center packages.' }, ['arcade', 'family entertainment center', 'laser tag', 'game center']),
  hl('Bowling Alley', 'Bowling', 'recreation-entertainment', ['playful-kids', 'sleek-entertainment', 'brutalist', 'event-festive'], ['gallery-showcase', 'event-booking', 'local-expert', 'compact-quote'], { image: IMG, description: 'Bowling lanes, leagues, and party packages for all ages.' }, ['bowling alley', 'bowling lanes', 'bowling party', 'bowling league']),
  hl('Golf Course & Driving Range', 'Golf', 'recreation-entertainment', ['coastal-climate', 'luxury-minimal', 'classic-warm', 'commercial-pro'], ['gallery-showcase', 'local-expert', 'event-booking', 'standard'], { image: IMG, description: 'Golf course tee times, memberships, and driving range access.' }, ['golf course', 'tee time', 'driving range', 'golf membership']),
]

const ARTS_T = ['luxury-gallery', 'media-theater', 'sleek-entertainment', 'historic-classic'] as const
const ARTS_L = ['gallery-showcase', 'portfolio-first', 'visual-impact', 'event-booking'] as const

export const ARTS_CULTURE_SERVICES: ServiceDef[] = [
  hl('Museum Admission & Exhibits', 'Museums', 'arts-culture', [...ARTS_T], [...ARTS_L], { image: ARTS_IMG, description: 'Museum tickets, memberships, and rotating exhibit access.' }, ['museum', 'museum tickets', 'exhibit admission', 'museum membership']),
  hl('Theater & Live Performance', 'Theater', 'arts-culture', ['media-theater', 'luxury-gallery', 'historic-classic', 'sleek-entertainment'], ['event-booking', 'gallery-showcase', 'visual-impact', 'storyteller'], { image: ARTS_IMG, description: 'Live theater performances, plays, and musicals with seat selection.' }, ['theater tickets', 'live performance', 'play tickets', 'musical theater']),
  hl('Cinema & Movie Screening', 'Cinema', 'arts-culture', ['media-theater', 'sleek-entertainment', 'brutalist', 'luxury-gallery'], ['gallery-showcase', 'event-booking', 'visual-impact', 'standard'], { image: ARTS_IMG, description: 'Movie showtimes, premium screenings, and private theater rentals.' }, ['cinema', 'movie tickets', 'movie theater', 'private screening']),
  hl('Art Gallery & Casino', 'Gallery & Gaming', 'arts-culture', ['luxury-gallery', 'historic-classic', 'sleek-entertainment', 'media-theater'], ['gallery-showcase', 'portfolio-first', 'event-booking', 'visual-impact'], { image: ARTS_IMG, description: 'Art gallery showings, artist events, and casino gaming floor access.' }, ['art gallery', 'gallery opening', 'casino', 'gaming floor']),
]

export const HOTEL_LODGING_INDUSTRY: IndustryDef = {
  slug: 'hotel-lodging', label: 'Hotels & Lodging',
  keywords: ['hotel', 'motel', 'resort', 'bed and breakfast', 'hostel', 'campground', 'lodging', 'accommodations'],
  serviceGroups: ['Accommodations'],
  defaultThemes: [...HOTEL_T],
  defaultLayouts: [...HOTEL_L],
  services: HOTEL_LODGING_SERVICES,
}

export const RESTAURANTS_BARS_INDUSTRY: IndustryDef = {
  slug: 'restaurants-bars', label: 'Restaurants, Bars & Cafes',
  keywords: ['restaurant', 'bar service', 'cocktail bar', 'cafe', 'coffee shop', 'nightclub', 'cocktail lounge', 'dining'],
  serviceGroups: ['Dining', 'Nightlife', 'Cafe'],
  defaultThemes: [...REST_T],
  defaultLayouts: [...REST_L],
  services: RESTAURANTS_BARS_SERVICES,
  // Customers browse a menu of individually-priced items and place an order —
  // "get a quote" doesn't fit a restaurant/cafe/bar the way it fits a project
  // trade. See EngagementModel in @/lib/catalog/types.
  engagementModel: 'order',
}

export const TOURISM_TRAVEL_INDUSTRY: IndustryDef = {
  slug: 'tourism-travel', label: 'Tourism & Travel',
  keywords: ['travel agency', 'tour operator', 'cruise line', 'tour guide', 'travel planning', 'vacation booking'],
  serviceGroups: ['Travel', 'Tours', 'Cruises'],
  defaultThemes: [...TOUR_T],
  defaultLayouts: [...TOUR_L],
  services: TOURISM_TRAVEL_SERVICES,
}

export const EVENT_PLANNING_INDUSTRY: IndustryDef = {
  slug: 'event-planning', label: 'Event Planning',
  keywords: ['event planner', 'wedding planner', 'conference planning', 'festival planning', 'party planner'],
  serviceGroups: ['Weddings', 'Corporate', 'Live Events', 'Celebrations'],
  defaultThemes: [...EVENT_T],
  defaultLayouts: [...EVENT_L],
  services: EVENT_PLANNING_SERVICES,
}

export const RECREATION_ENTERTAINMENT_INDUSTRY: IndustryDef = {
  slug: 'recreation-entertainment', label: 'Recreation & Entertainment Venues',
  keywords: ['amusement park', 'arcade', 'bowling alley', 'golf course', 'family entertainment center'],
  serviceGroups: ['Parks', 'Arcade', 'Bowling', 'Golf'],
  defaultThemes: [...REC_T],
  defaultLayouts: [...REC_L],
  services: RECREATION_ENTERTAINMENT_SERVICES,
}

export const ARTS_CULTURE_INDUSTRY: IndustryDef = {
  slug: 'arts-culture', label: 'Arts, Culture & Casinos',
  keywords: ['museum', 'theater', 'cinema', 'art gallery', 'casino', 'live performance'],
  serviceGroups: ['Museums', 'Theater', 'Cinema', 'Gallery & Gaming'],
  defaultThemes: [...ARTS_T],
  defaultLayouts: [...ARTS_L],
  services: ARTS_CULTURE_SERVICES,
}
