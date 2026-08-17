import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81'

function lu(
  label: string,
  group: string,
  industry: 'passenger-transport' | 'freight-logistics' | 'waste-management',
  themes: ServiceDef['recommendedThemes'],
  layouts: ServiceDef['recommendedLayouts'],
  catalog: ServiceDef['catalog'],
  keywords: string[] = []
): ServiceDef {
  return { label, group, industry, keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const PAX_T = ['swift-mobile', 'fleet-logistics', 'commercial-pro', 'modern-office'] as const
const PAX_L = ['service-zones', 'compact-quote', 'conversion-focus', 'standard'] as const

export const PASSENGER_TRANSPORT_SERVICES: ServiceDef[] = [
  lu('Rideshare Service', 'Rideshare', 'passenger-transport', [...PAX_T], [...PAX_L], { image: IMG, description: 'On-demand rideshare booking with upfront pricing and live tracking.' }, ['rideshare', 'ride hailing', 'ride booking', 'car service']),
  lu('Taxi Service', 'Taxi', 'passenger-transport', ['swift-mobile', 'fleet-logistics', 'functional-utility', 'commercial-pro'], ['service-zones', 'emergency-first', 'compact-quote', 'standard'], { image: IMG, description: 'Licensed taxi dispatch and airport transfer service.' }, ['taxi service', 'taxi dispatch', 'airport taxi', 'cab service']),
  lu('Public Transit Passes', 'Transit', 'passenger-transport', ['commercial-pro', 'modern-office', 'functional-utility', 'fleet-logistics'], ['service-zones', 'standard', 'compact-quote', 'trust-report'], { image: IMG, description: 'Public transit passes, route planning, and fare information.' }, ['public transit', 'bus pass', 'transit authority', 'commuter pass']),
  lu('Airline Booking', 'Airlines', 'passenger-transport', ['commercial-pro', 'luxury-minimal', 'modern-office', 'coastal-climate'], ['conversion-focus', 'gallery-showcase', 'standard', 'service-zones'], { image: IMG, description: 'Flight booking, check-in, and travel schedule management.' }, ['airline booking', 'flight booking', 'airline tickets', 'flight schedule']),
  lu('Non-Emergency Medical Rides', 'Rideshare', 'passenger-transport', ['swift-mobile', 'fleet-logistics', 'commercial-pro', 'modern-office'], ['service-zones', 'compact-quote', 'conversion-focus', 'standard'], { image: IMG, description: 'Scheduled rides to appointments for riders who need assistance.' }, ['medical rides', 'appointment transport', 'non emergency rides']),
  lu('School & Student Transport', 'Transit', 'passenger-transport', ['swift-mobile', 'fleet-logistics', 'commercial-pro', 'modern-office'], ['service-zones', 'compact-quote', 'conversion-focus', 'standard'], { image: IMG, description: 'Contracted routes and activity trips for schools and districts.' }, ['school transport', 'student transportation', 'school bus service']),
  lu('Charter Bus & Group Transport', 'Transit', 'passenger-transport', ['swift-mobile', 'fleet-logistics', 'commercial-pro', 'modern-office'], ['service-zones', 'compact-quote', 'conversion-focus', 'standard'], { image: IMG, description: 'Motorcoach charters for teams, tours, and corporate groups.' }, ['charter bus', 'motorcoach', 'group transport', 'bus charter']),
  lu('Paratransit & Accessible Transport', 'Rideshare', 'passenger-transport', ['swift-mobile', 'fleet-logistics', 'commercial-pro', 'modern-office'], ['service-zones', 'compact-quote', 'conversion-focus', 'standard'], { image: IMG, description: 'Wheelchair-accessible vehicles on scheduled and on-demand runs.' }, ['paratransit', 'accessible transport', 'wheelchair van service']),
]

const FRT_T = ['fleet-logistics', 'garage-industrial', 'commercial-pro', 'functional-utility'] as const
const FRT_L = ['service-zones', 'trust-report', 'standard', 'conversion-focus'] as const

export const FREIGHT_LOGISTICS_SERVICES: ServiceDef[] = [
  lu('Trucking & Freight Hauling', 'Trucking', 'freight-logistics', ['fleet-logistics', 'garage-industrial', 'brutalist', 'commercial-pro'], ['service-zones', 'trust-report', 'compact-quote', 'standard'], { image: IMG, description: 'Full truckload and LTL freight hauling with real-time tracking.' }, ['trucking company', 'freight hauling', 'ltl freight', 'truckload shipping']),
  lu('Warehousing & Fulfillment', 'Warehousing', 'freight-logistics', ['garage-industrial', 'functional-utility', 'commercial-pro', 'fleet-logistics'], ['trust-report', 'service-zones', 'standard', 'conversion-focus'], { image: IMG, description: 'Warehousing, pick-and-pack, and order fulfillment services.' }, ['warehousing', 'fulfillment center', 'pick and pack', 'storage and distribution']),
  lu('Freight Forwarding', 'Freight Forwarding', 'freight-logistics', ['fleet-logistics', 'commercial-pro', 'office-executive', 'functional-utility'], ['trust-report', 'trust-builder', 'standard', 'conversion-focus'], { image: IMG, description: 'International freight forwarding, customs, and logistics coordination.' }, ['freight forwarding', 'freight forwarder', 'international shipping', 'customs brokerage']),
  lu('LTL & Partial Truckload', 'Trucking', 'freight-logistics', ['fleet-logistics', 'commercial-pro', 'functional-utility', 'swift-mobile'], ['service-zones', 'trust-builder', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'Less-than-truckload freight consolidated onto scheduled lanes.' }, ['ltl freight', 'partial truckload', 'less than truckload', 'ltl shipping']),
  lu('Refrigerated & Temperature-Controlled', 'Trucking', 'freight-logistics', ['fleet-logistics', 'commercial-pro', 'functional-utility', 'swift-mobile'], ['service-zones', 'trust-builder', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'Reefer freight with continuous temperature logging.' }, ['reefer freight', 'refrigerated trucking', 'cold chain', 'temperature controlled shipping']),
  lu('Final-Mile & White Glove Delivery', 'Warehousing', 'freight-logistics', ['fleet-logistics', 'commercial-pro', 'functional-utility', 'swift-mobile'], ['service-zones', 'trust-builder', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'Appointment delivery into the room, with unpacking and debris removal.' }, ['final mile delivery', 'white glove delivery', 'last mile', 'in home delivery']),
  lu('Customs Brokerage & Import', 'Freight Forwarding', 'freight-logistics', ['fleet-logistics', 'commercial-pro', 'functional-utility', 'swift-mobile'], ['service-zones', 'trust-builder', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'Entry filing, duties, and clearance on inbound containers.' }, ['customs brokerage', 'import clearance', 'customs clearance', 'import documentation']),
  lu('Drayage & Container Transport', 'Trucking', 'freight-logistics', ['fleet-logistics', 'commercial-pro', 'functional-utility', 'swift-mobile'], ['service-zones', 'trust-builder', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'Port and rail-yard container moves with chassis coordination.' }, ['drayage', 'container transport', 'port drayage', 'intermodal transport']),
]

const WASTE_T = ['urban-reclaim', 'garage-industrial', 'fresh-clean', 'functional-utility'] as const
const WASTE_L = ['service-zones', 'compact-quote', 'local-expert', 'standard'] as const

export const WASTE_MANAGEMENT_SERVICES: ServiceDef[] = [
  lu('Residential Trash Collection', 'Collection', 'waste-management', [...WASTE_T], [...WASTE_L], { image: IMG, description: 'Weekly residential trash and recycling pickup with cart rental.' }, ['trash collection', 'garbage pickup', 'waste collection', 'trash service']),
  lu('Commercial Waste Hauling', 'Collection', 'waste-management', ['urban-reclaim', 'garage-industrial', 'commercial-pro', 'functional-utility'], ['service-zones', 'trust-report', 'compact-quote', 'standard'], { image: IMG, description: 'Commercial dumpster service and scheduled waste hauling.' }, ['commercial waste', 'dumpster service', 'waste hauling', 'business trash service']),
  lu('Recycling Center Operations', 'Recycling', 'waste-management', ['fresh-clean', 'urban-reclaim', 'functional-utility', 'commercial-pro'], ['local-expert', 'trust-report', 'service-zones', 'standard'], { image: IMG, description: 'Recycling drop-off and material processing center services.' }, ['recycling center', 'recycling services', 'material recovery', 'recycling drop off']),
  lu('Hazardous Waste Disposal', 'Hazardous Waste', 'waste-management', ['garage-industrial', 'urban-reclaim', 'commercial-pro', 'functional-utility'], ['trust-report', 'emergency-first', 'compact-quote', 'standard'], { image: IMG, description: 'Licensed hazardous and chemical waste disposal and compliance.' }, ['hazardous waste disposal', 'chemical waste', 'hazmat disposal', 'waste compliance']),
  lu('Roll-Off Dumpster Rental', 'Collection', 'waste-management', ['urban-reclaim', 'garage-industrial', 'fresh-clean', 'functional-utility'], ['service-zones', 'compact-quote', 'local-expert', 'standard'], { image: IMG, description: 'Roll-off containers dropped, swapped, and hauled by size.' }, ['roll off dumpster', 'dumpster rental', 'container rental', '20 yard dumpster']),
  lu('Construction & Demolition Debris', 'Collection', 'waste-management', ['urban-reclaim', 'garage-industrial', 'fresh-clean', 'functional-utility'], ['service-zones', 'compact-quote', 'local-expert', 'standard'], { image: IMG, description: 'C and D debris hauled and disposed with weight tickets.' }, ['construction debris', 'demolition debris', 'c and d waste']),
  lu('Document Shredding & Secure Disposal', 'Hazardous Waste', 'waste-management', ['urban-reclaim', 'garage-industrial', 'fresh-clean', 'functional-utility'], ['service-zones', 'compact-quote', 'local-expert', 'standard'], { image: IMG, description: 'On-site shredding with certificates of destruction.' }, ['document shredding', 'paper shredding', 'secure disposal', 'shredding service']),
  lu('Compost & Organics Collection', 'Recycling', 'waste-management', ['urban-reclaim', 'garage-industrial', 'fresh-clean', 'functional-utility'], ['service-zones', 'compact-quote', 'local-expert', 'standard'], { image: IMG, description: 'Food waste and organics collected on a separate route.' }, ['compost collection', 'organics recycling', 'food waste pickup']),
]

export const PASSENGER_TRANSPORT_INDUSTRY: IndustryDef = {
  slug: 'passenger-transport', label: 'Passenger Transport',
  keywords: ['rideshare', 'taxi service', 'public transit', 'airline booking', 'passenger transport'],
  serviceGroups: ['Rideshare', 'Taxi', 'Transit', 'Airlines'],
  defaultThemes: [...PAX_T],
  defaultLayouts: [...PAX_L],
  services: PASSENGER_TRANSPORT_SERVICES,
}

export const FREIGHT_LOGISTICS_INDUSTRY: IndustryDef = {
  slug: 'freight-logistics', label: 'Freight & Logistics',
  keywords: ['trucking company', 'warehousing', 'freight forwarding', 'logistics company'],
  serviceGroups: ['Trucking', 'Warehousing', 'Freight Forwarding'],
  defaultThemes: [...FRT_T],
  defaultLayouts: [...FRT_L],
  services: FREIGHT_LOGISTICS_SERVICES,
}

export const WASTE_MANAGEMENT_INDUSTRY: IndustryDef = {
  slug: 'waste-management', label: 'Waste Management',
  keywords: ['trash collection', 'recycling center', 'hazardous waste disposal', 'waste hauling', 'garbage pickup'],
  serviceGroups: ['Collection', 'Recycling', 'Hazardous Waste'],
  defaultThemes: [...WASTE_T],
  defaultLayouts: [...WASTE_L],
  services: WASTE_MANAGEMENT_SERVICES,
}
