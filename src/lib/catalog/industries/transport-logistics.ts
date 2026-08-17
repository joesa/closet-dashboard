import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64'

function tr(label: string, group: string, industry: 'courier-delivery' | 'medical-transport' | 'limo-shuttle' | 'hotshot-trucking' | 'rv-boat-service', themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry, keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const FT = ['fleet-logistics', 'swift-mobile', 'modern-office', 'commercial-pro'] as const
const FL = ['service-zones', 'minimalist-lead', 'compact-quote', 'trust-builder'] as const

export const COURIER_DELIVERY_SERVICES: ServiceDef[] = [
  tr('Same-Day Local Delivery', 'Delivery', 'courier-delivery', [...FT], [...FL, 'conversion-focus'], { image: IMG, description: 'Same-day courier delivery anywhere in the metro. We pick up and deliver.' }, ['same day delivery', 'courier service', 'local delivery', 'package delivery', 'courier']),
  tr('Medical Specimen Transport', 'Medical', 'courier-delivery', ['fleet-logistics', 'commercial-pro', 'modern-office', 'home-guardian'], ['trust-report', 'service-zones', 'trust-builder', 'compact-quote'], { image: IMG, description: 'HIPAA-compliant lab specimen and medical supply courier service.' }, ['medical courier', 'specimen transport', 'medical delivery', 'lab courier', 'hipaa courier']),
  tr('Legal Document Delivery', 'Legal', 'courier-delivery', ['fleet-logistics', 'commercial-pro', 'modern-office', 'swift-mobile'], ['trust-report', 'compact-quote', 'service-zones', 'trust-builder'], { image: IMG, description: 'Time-stamped legal document delivery with proof of service.' }, ['legal courier', 'document delivery', 'court filing', 'legal document service']),
  tr('Business & Office Courier', 'Business', 'courier-delivery', [...FT], [...FL], { image: IMG, description: 'Scheduled and on-demand inter-office and client delivery routes.' }, ['business courier', 'office courier', 'corporate delivery', 'b2b courier']),
  tr('Route & Scheduled Delivery', 'Delivery', 'courier-delivery', ['fleet-logistics', 'swift-mobile', 'modern-office', 'commercial-pro'], ['service-zones', 'minimalist-lead', 'compact-quote', 'trust-builder'], { image: IMG, description: 'Recurring daily and weekly routes run on a fixed schedule.' }, ['route delivery', 'scheduled delivery', 'recurring courier', 'daily route']),
  tr('Pharmacy & Prescription Delivery', 'Medical', 'courier-delivery', ['fleet-logistics', 'swift-mobile', 'modern-office', 'commercial-pro'], ['service-zones', 'minimalist-lead', 'compact-quote', 'trust-builder'], { image: IMG, description: 'HIPAA-aware prescription runs from pharmacy to patient.' }, ['pharmacy delivery', 'prescription delivery', 'medication courier']),
  tr('Freight & Pallet Courier', 'Business', 'courier-delivery', ['fleet-logistics', 'swift-mobile', 'modern-office', 'commercial-pro'], ['service-zones', 'minimalist-lead', 'compact-quote', 'trust-builder'], { image: IMG, description: 'Pallets and oversized parcels moved with a liftgate.' }, ['pallet delivery', 'freight courier', 'liftgate delivery', 'oversized delivery']),
  tr('Rush & After-Hours Courier', 'Delivery', 'courier-delivery', ['fleet-logistics', 'swift-mobile', 'modern-office', 'commercial-pro'], ['service-zones', 'minimalist-lead', 'compact-quote', 'trust-builder'], { image: IMG, description: 'Direct-drive pickups nights, weekends, and holidays.' }, ['rush courier', 'after hours delivery', 'emergency courier', 'direct drive']),
]

export const MEDICAL_TRANSPORT_SERVICES: ServiceDef[] = [
  tr('Non-Emergency Medical Transport', 'NEMT', 'medical-transport', ['fleet-logistics', 'care-comfort', 'commercial-pro', 'classic-warm'], ['trust-builder', 'service-zones', 'compact-quote', 'local-expert'], { image: IMG, description: 'Reliable NEMT for dialysis, doctor visits, and hospital discharge.' }, ['nemt', 'non emergency medical transport', 'medical transport', 'dialysis transport']),
  tr('Wheelchair Van Transport', 'Wheelchair', 'medical-transport', ['fleet-logistics', 'care-comfort', 'commercial-pro', 'classic-warm'], ['trust-builder', 'service-zones', 'compact-quote', 'local-expert'], { image: IMG, description: 'ADA wheelchair-accessible van service for all mobility needs.' }, ['wheelchair transport', 'wheelchair van', 'handicap transport', 'accessible transport']),
  tr('Airport Medical Transport', 'Airport', 'medical-transport', ['fleet-logistics', 'swift-mobile', 'commercial-pro', 'care-comfort'], ['compact-quote', 'trust-builder', 'service-zones', 'minimalist-lead'], { image: IMG, description: 'Medical transport to and from airports for patients requiring assistance.' }, ['airport medical transport', 'medical airport ride', 'airport transport disabled']),
  tr('Stretcher & Gurney Transport', 'NEMT', 'medical-transport', ['fleet-logistics', 'commercial-pro', 'functional-utility', 'swift-mobile'], ['service-zones', 'trust-builder', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'Bed-to-bed stretcher transport between home, hospital, and facility.' }, ['stretcher transport', 'gurney transport', 'bed to bed transport']),
  tr('Dialysis & Treatment Rides', 'NEMT', 'medical-transport', ['fleet-logistics', 'commercial-pro', 'functional-utility', 'swift-mobile'], ['service-zones', 'trust-builder', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'Standing schedule rides to dialysis, infusion, and radiation appointments.' }, ['dialysis transport', 'treatment transport', 'recurring medical rides']),
  tr('Hospital Discharge Transport', 'NEMT', 'medical-transport', ['fleet-logistics', 'commercial-pro', 'functional-utility', 'swift-mobile'], ['service-zones', 'trust-builder', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'Same-day discharge rides home or to a rehab facility, door through door.' }, ['hospital discharge transport', 'discharge ride', 'facility transfer']),
  tr('Long-Distance Medical Transport', 'NEMT', 'medical-transport', ['fleet-logistics', 'commercial-pro', 'functional-utility', 'swift-mobile'], ['service-zones', 'trust-builder', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'Out-of-state patient transport with a driver and attendant on board.' }, ['long distance medical transport', 'out of state patient transport']),
  tr('Bariatric Patient Transport', 'Wheelchair', 'medical-transport', ['fleet-logistics', 'commercial-pro', 'functional-utility', 'swift-mobile'], ['service-zones', 'trust-builder', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'Equipment and staffing rated for bariatric patients.' }, ['bariatric transport', 'heavy duty patient transport']),
]

export const LIMO_SHUTTLE_SERVICES: ServiceDef[] = [
  tr('Airport Transfer', 'Airport', 'limo-shuttle', ['fleet-logistics', 'luxury-minimal', 'commercial-pro', 'modern-office'], ['compact-quote', 'service-zones', 'minimalist-lead', 'trust-builder'], { image: IMG, description: 'Professional airport pickup and drop-off. Flight tracking, on time every time.' }, ['airport transfer', 'airport ride', 'airport limo', 'airport shuttle', 'airport transportation']),
  tr('Wedding & Event Limousine', 'Events', 'limo-shuttle', ['luxury-minimal', 'event-festive', 'elegant-dressing', 'sophisticated-wine'], ['event-booking', 'gallery-showcase', 'storyteller', 'conversion-focus'], { image: IMG, description: 'Stretch limos, SUVs, and party buses for weddings and special events.' }, ['wedding limo', 'event limo', 'stretch limo', 'prom limo', 'party bus']),
  tr('Corporate Shuttle Service', 'Corporate', 'limo-shuttle', ['commercial-pro', 'fleet-logistics', 'modern-office', 'functional-utility'], ['trust-builder', 'compact-quote', 'service-zones', 'conversion-focus'], { image: IMG, description: 'Executive sedan and shuttle service for corporate travel and employee transport.' }, ['corporate shuttle', 'executive car service', 'business limo', 'employee shuttle']),
  tr('Party Bus Rental', 'Events', 'limo-shuttle', ['fleet-logistics', 'commercial-pro', 'functional-utility', 'swift-mobile'], ['service-zones', 'trust-builder', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'Party bus with sound and lighting for groups, by the hour.' }, ['party bus', 'party bus rental', 'group party transport']),
  tr('Prom & Homecoming Transport', 'Events', 'limo-shuttle', ['fleet-logistics', 'commercial-pro', 'functional-utility', 'swift-mobile'], ['service-zones', 'trust-builder', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'Chaperoned school-dance transport with a fixed itinerary.' }, ['prom limo', 'homecoming limo', 'school dance transport']),
  tr('Wine Tour & Brewery Runs', 'Events', 'limo-shuttle', ['fleet-logistics', 'commercial-pro', 'functional-utility', 'swift-mobile'], ['service-zones', 'trust-builder', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'Designated-driver tours to wineries, breweries, and distilleries.' }, ['wine tour transport', 'brewery tour', 'winery shuttle']),
  tr('Funeral & Memorial Transport', 'Events', 'limo-shuttle', ['fleet-logistics', 'commercial-pro', 'functional-utility', 'swift-mobile'], ['service-zones', 'trust-builder', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'Family cars and procession transport coordinated with the funeral home.' }, ['funeral transport', 'funeral limo', 'procession transport']),
  tr('Hourly Chauffeur Service', 'Corporate', 'limo-shuttle', ['fleet-logistics', 'commercial-pro', 'functional-utility', 'swift-mobile'], ['service-zones', 'trust-builder', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'A car and driver held for the day or evening, as directed.' }, ['chauffeur service', 'hourly car service', 'private driver', 'black car service']),
]

export const HOTSHOT_TRUCKING_SERVICES: ServiceDef[] = [
  tr('Hot Shot Freight', 'Freight', 'hotshot-trucking', ['fleet-logistics', 'functional-utility', 'commercial-pro', 'brutalist'], ['service-zones', 'compact-quote', 'minimalist-lead', 'trust-builder'], { image: IMG, description: 'Expedited hotshot trucking for time-critical loads. Same day or next day.' }, ['hotshot trucking', 'hot shot delivery', 'expedited freight', 'hotshot loads', 'same day freight']),
  tr('Dedicated Freight Service', 'Freight', 'hotshot-trucking', ['fleet-logistics', 'commercial-pro', 'functional-utility', 'modern-office'], ['trust-builder', 'compact-quote', 'service-zones', 'conversion-focus'], { image: IMG, description: 'Dedicated flatbed, gooseneck, and enclosed trailer transport.' }, ['dedicated freight', 'flatbed freight', 'gooseneck trailer', 'freight service']),
  tr('Expedited & Emergency Freight', 'Freight', 'hotshot-trucking', ['fleet-logistics', 'commercial-pro', 'functional-utility', 'swift-mobile'], ['service-zones', 'trust-builder', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'Load picked up now and driven straight through to the consignee.' }, ['expedited freight', 'emergency freight', 'rush freight', 'straight through delivery']),
  tr('Flatbed & Oversize Loads', 'Freight', 'hotshot-trucking', ['fleet-logistics', 'commercial-pro', 'functional-utility', 'swift-mobile'], ['service-zones', 'trust-builder', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'Flatbed, step deck, and permitted oversize hauls.' }, ['flatbed hauling', 'oversize load', 'step deck', 'heavy haul']),
  tr('Equipment & Machinery Transport', 'Freight', 'hotshot-trucking', ['fleet-logistics', 'commercial-pro', 'functional-utility', 'swift-mobile'], ['service-zones', 'trust-builder', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'Skid steers, tractors, and job-site equipment moved between sites.' }, ['equipment transport', 'machinery hauling', 'tractor transport']),
  tr('LTL & Partial Loads', 'Freight', 'hotshot-trucking', ['fleet-logistics', 'commercial-pro', 'functional-utility', 'swift-mobile'], ['service-zones', 'trust-builder', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'Partial truckloads priced by the space they actually take.' }, ['ltl freight', 'partial load', 'less than truckload']),
  tr('Construction Material Delivery', 'Freight', 'hotshot-trucking', ['fleet-logistics', 'commercial-pro', 'functional-utility', 'swift-mobile'], ['service-zones', 'trust-builder', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'Steel, lumber, and building material runs to the job site.' }, ['material delivery', 'construction delivery', 'steel hauling', 'lumber delivery']),
  tr('Vehicle & Trailer Transport', 'Freight', 'hotshot-trucking', ['fleet-logistics', 'commercial-pro', 'functional-utility', 'swift-mobile'], ['service-zones', 'trust-builder', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'Cars, trailers, and non-running units moved on a gooseneck.' }, ['vehicle transport', 'trailer transport', 'car hauling']),
]

export const RV_BOAT_SERVICE_SERVICES: ServiceDef[] = [
  tr('Mobile RV Repair', 'RV', 'rv-boat-service', ['fleet-logistics', 'functional-utility', 'swift-mobile', 'classic-warm'], ['emergency-first', 'compact-quote', 'trust-builder', 'local-expert'], { image: IMG, description: 'Mobile RV repair and maintenance. We come to your campsite or storage.' }, ['mobile rv repair', 'rv repair', 'mobile rv technician', 'rv service', 'rv mechanic']),
  tr('Boat Transport', 'Marine', 'rv-boat-service', ['fleet-logistics', 'coastal-climate', 'functional-utility', 'classic-warm'], ['compact-quote', 'service-zones', 'trust-builder', 'conversion-focus'], { image: IMG, description: 'Licensed and insured boat trailer transport to marinas, storage, or shows.' }, ['boat transport', 'boat hauling', 'boat trailer service', 'marine transport']),
  tr('Marine Mobile Detailing', 'Marine', 'rv-boat-service', ['coastal-climate', 'fleet-logistics', 'pool-resort', 'functional-utility'], ['before-after', 'gallery-showcase', 'compact-quote', 'local-expert'], { image: IMG, description: 'Boat washing, hull polishing, and interior detailing at the marina.' }, ['boat detailing', 'marine detailing', 'boat cleaning', 'hull cleaning']),
  tr('RV Roof & Sealant Service', 'RV', 'rv-boat-service', ['fleet-logistics', 'commercial-pro', 'functional-utility', 'swift-mobile'], ['service-zones', 'trust-builder', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'Roof reseal, lap sealant, and leak tracing before the wet season.' }, ['rv roof repair', 'rv resealing', 'rv leak repair', 'rv roof coating']),
  tr('RV Appliance & Systems Repair', 'RV', 'rv-boat-service', ['fleet-logistics', 'commercial-pro', 'functional-utility', 'swift-mobile'], ['service-zones', 'trust-builder', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'Fridge, furnace, water heater, and converter work at your site.' }, ['rv appliance repair', 'rv furnace repair', 'rv fridge repair', 'rv water heater']),
  tr('Boat Engine Service', 'Marine', 'rv-boat-service', ['fleet-logistics', 'commercial-pro', 'functional-utility', 'swift-mobile'], ['service-zones', 'trust-builder', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'Outboard and inboard service, winterization, and impeller work.' }, ['boat engine repair', 'outboard service', 'marine engine repair', 'boat winterization']),
  tr('Marine Electronics & Rigging', 'Marine', 'rv-boat-service', ['fleet-logistics', 'commercial-pro', 'functional-utility', 'swift-mobile'], ['service-zones', 'trust-builder', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'Sonar, radios, and rigging installed and troubleshot dockside.' }, ['marine electronics', 'boat wiring', 'sonar install', 'boat rigging']),
  tr('Winterization & Storage Prep', 'RV', 'rv-boat-service', ['fleet-logistics', 'commercial-pro', 'functional-utility', 'swift-mobile'], ['service-zones', 'trust-builder', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'Antifreeze, stabilizer, battery pull, and cover fitting for the off season.' }, ['winterization', 'rv winterizing', 'boat storage prep', 'off season prep']),
]

export const COURIER_DELIVERY_INDUSTRY: IndustryDef = {
  slug: 'courier-delivery', label: 'Courier & Delivery',
  keywords: ['courier', 'delivery service', 'same day delivery', 'medical courier', 'legal delivery', 'messenger'],
  serviceGroups: ['Delivery', 'Medical', 'Legal', 'Business'],
  defaultThemes: ['fleet-logistics', 'swift-mobile', 'modern-office', 'commercial-pro'],
  defaultLayouts: ['service-zones', 'minimalist-lead', 'compact-quote', 'trust-builder'],
  services: COURIER_DELIVERY_SERVICES,
}

export const MEDICAL_TRANSPORT_INDUSTRY: IndustryDef = {
  slug: 'medical-transport', label: 'Medical Transport (NEMT)',
  keywords: ['medical transport', 'nemt', 'non emergency medical', 'dialysis transport', 'wheelchair van', 'medical ride'],
  serviceGroups: ['NEMT', 'Wheelchair', 'Airport'],
  defaultThemes: ['fleet-logistics', 'care-comfort', 'commercial-pro', 'classic-warm'],
  defaultLayouts: ['trust-builder', 'service-zones', 'compact-quote', 'local-expert'],
  services: MEDICAL_TRANSPORT_SERVICES,
}

export const LIMO_SHUTTLE_INDUSTRY: IndustryDef = {
  slug: 'limo-shuttle', label: 'Limousine & Shuttle Service',
  keywords: ['limo', 'limousine', 'shuttle', 'airport transfer', 'party bus', 'black car service', 'car service'],
  serviceGroups: ['Airport', 'Events', 'Corporate'],
  defaultThemes: ['fleet-logistics', 'luxury-minimal', 'commercial-pro', 'event-festive'],
  defaultLayouts: ['compact-quote', 'service-zones', 'trust-builder', 'event-booking'],
  services: LIMO_SHUTTLE_SERVICES,
}

export const HOTSHOT_TRUCKING_INDUSTRY: IndustryDef = {
  slug: 'hotshot-trucking', label: 'Hot Shot & Freight',
  keywords: ['hotshot', 'hotshot trucking', 'expedited freight', 'same day freight', 'dedicated freight', 'hotshot load'],
  serviceGroups: ['Freight'],
  defaultThemes: ['fleet-logistics', 'functional-utility', 'commercial-pro', 'brutalist'],
  defaultLayouts: ['service-zones', 'compact-quote', 'minimalist-lead', 'trust-builder'],
  services: HOTSHOT_TRUCKING_SERVICES,
}

export const RV_BOAT_SERVICE_INDUSTRY: IndustryDef = {
  slug: 'rv-boat-service', label: 'RV & Boat Services',
  keywords: ['rv repair', 'mobile rv', 'boat transport', 'boat detailing', 'rv service', 'marine service'],
  serviceGroups: ['RV', 'Marine'],
  defaultThemes: ['fleet-logistics', 'coastal-climate', 'functional-utility', 'classic-warm'],
  defaultLayouts: ['emergency-first', 'compact-quote', 'trust-builder', 'service-zones'],
  services: RV_BOAT_SERVICE_SERVICES,
}
