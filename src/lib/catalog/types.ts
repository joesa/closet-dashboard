import type { RoomType } from '@/lib/rooms'
import type { LayoutSlug, ThemeSlug } from '@/lib/catalog/sitePresentationCatalog'

export type IndustrySlug =
  | 'custom-closets'
  | 'plumbing'
  | 'hvac'
  | 'landscaping'
  | 'towing'
  | 'roofing'
  | 'electrical'
  | 'pest-control'
  | 'pressure-washing'
  | 'tree-service'
  | 'painting'
  // New verticals
  | 'cleaning'
  | 'handyman'
  | 'flooring'
  | 'carpentry'
  | 'appliance-repair'
  | 'locksmith'
  | 'moving'
  | 'mobile-auto'
  | 'junk-removal'
  | 'concrete-masonry'
  // Second wave
  | 'pool-spa'
  | 'garage-door'
  | 'gutters'
  | 'chimney-fireplace'
  | 'home-inspection'
  | 'security-systems'
  | 'irrigation'
  | 'solar'
  | 'pet-services'
  | 'windows-doors'
  // Third wave — 50 more
  | 'insulation'
  | 'drywall'
  | 'waterproofing'
  | 'foundation-repair'
  | 'siding'
  | 'fencing'
  | 'snow-removal'
  | 'generator-services'
  | 'countertops'
  | 'cabinet-painting'
  | 'bathroom-remodel'
  | 'kitchen-remodel'
  | 'epoxy-flooring'
  | 'outdoor-lighting'
  | 'deck-maintenance'
  | 'septic-services'
  | 'well-services'
  | 'water-treatment'
  | 'glass-mirror'
  | 'blinds-shutters'
  | 'mold-remediation'
  | 'fire-restoration'
  | 'duct-cleaning'
  | 'tile-grout-cleaning'
  | 'fire-protection'
  | 'commercial-refrigeration'
  | 'restaurant-equipment'
  | 'parking-lot'
  | 'signage-wraps'
  | 'welding-fabrication'
  | 'elevator-services'
  | 'mobile-notary'
  | 'personal-training'
  | 'massage-therapy'
  | 'tutoring'
  | 'catering-chef'
  | 'photography-video'
  | 'drone-services'
  | 'home-staging'
  | 'courier-delivery'
  | 'medical-transport'
  | 'limo-shuttle'
  | 'hotshot-trucking'
  | 'rv-boat-service'
  | 'event-rentals'
  | 'dj-entertainment'
  | 'bounce-house'
  | 'food-truck'
  | 'it-computer-repair'
  | 'auto-body'
  // Fourth wave — Hospitality & Leisure, Professional Services, Personal &
  // Wellness, Healthcare & Education, Finance/Insurance/Real Estate,
  // Logistics/Transport/Utilities (30 more)
  | 'hotel-lodging'
  | 'restaurants-bars'
  | 'tourism-travel'
  | 'event-planning'
  | 'recreation-entertainment'
  | 'arts-culture'
  | 'legal-services'
  | 'financial-professionals'
  | 'business-consulting'
  | 'marketing-advertising'
  | 'it-services'
  | 'architecture-engineering'
  | 'research-services'
  | 'beauty-salon'
  | 'spa-wellness'
  | 'fitness-studio'
  | 'life-services'
  | 'laundry-services'
  | 'medical-clinic'
  | 'therapy-rehab'
  | 'senior-care'
  | 'education-formal'
  | 'enrichment-education'
  | 'banking-lending'
  | 'investment-services'
  | 'insurance-services'
  | 'real-estate-services'
  | 'passenger-transport'
  | 'freight-logistics'
  | 'waste-management'

export type ServiceDef = {
  label: string
  group: string
  industry: IndustrySlug
  /** Extra terms for fuzzy matching free-text service labels. */
  keywords: string[]
  /** Primary widget / calculator category label for this service. */
  widgetCategory: string
  /** Closet vertical only — maps to legacy RoomType when present. */
  widgetRoom?: RoomType
  recommendedThemes: ThemeSlug[]
  recommendedLayouts: LayoutSlug[]
  catalog: { image: string; description: string }
}

/**
 * Which customer-facing interaction model a business's site/widget should
 * use:
 *  - 'quote'  (default) — rooms/services -> price estimate -> lead capture.
 *    Fits project-based trades (roofing, plumbing, closets, catering-FOR-
 *    events, etc.) where price varies per job and a human still scopes it.
 *  - 'order'  — browse a menu/catalog of individually-priced items -> cart ->
 *    submit order. Fits direct-purchase food/retail businesses (a restaurant
 *    or walk-up food truck selling individual meals) where "get a quote"
 *    "get a quote" doesn't make sense — the customer wants an itemized order.
 *  - 'booking' — calendar/time-slot booking for services like massage therapy,
 *    personal training, therapy, or tutoring. The customer picks a service
 *    and a time.
 *  - 'ticket' — event/capacity ticketing for services like tours, bounce house
 *    rentals, limo/shuttle. The customer picks an event/date and number of tickets.
 */
export type EngagementModel = 'quote' | 'order' | 'booking' | 'ticket'

export type IndustryDef = {
  slug: IndustrySlug
  label: string
  /** Match free-text industry / trade fields (e.g. "plumber", "HVAC"). */
  keywords: string[]
  serviceGroups: string[]
  defaultThemes: ThemeSlug[]
  defaultLayouts: LayoutSlug[]
  services: ServiceDef[]
  /**
   * Optional — omitted means 'quote' (the default/status-quo for the other
   * ~110 catalog industries). Only industries that genuinely need a menu +
   * order flow instead of a quote calculator should set this explicitly
   * (currently just `restaurants-bars`). Deliberately NOT an exhaustive
   * `Record<IndustrySlug, EngagementModel>` (unlike INDUSTRY_BEFORE_AFTER_
   * CATEGORY) since the 'order' set is tiny today — revisit as an exhaustive
   * table if it grows past ~10 industries.
   */
  engagementModel?: EngagementModel
}
