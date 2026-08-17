import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13'

function mk(label: string, group: string, industry: 'parking-lot' | 'signage-wraps' | 'welding-fabrication' | 'elevator-services', themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry, keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const CT = ['commercial-pro', 'brutalist', 'functional-utility', 'stone-masonry'] as const
const CL = ['before-after', 'trust-builder', 'compact-quote', 'local-expert'] as const

export const PARKING_LOT_SERVICES: ServiceDef[] = [
  mk('Parking Lot Seal Coating', 'Sealing', 'parking-lot', [...CT], [...CL, 'seasonal-cta'], { image: IMG, description: 'Asphalt seal coating to protect and restore parking lots and driveways.' }, ['seal coating', 'parking lot sealing', 'asphalt sealer', 'driveway seal coat']),
  mk('Line Striping & Marking', 'Striping', 'parking-lot', [...CT], ['before-after', 'trust-builder', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'Parking stall, fire lane, and ADA-compliant striping for any lot.' }, ['line striping', 'parking lot striping', 'lot marking', 'fire lane striping', 'ada marking']),
  mk('Pothole & Crack Repair', 'Repair', 'parking-lot', [...CT], ['before-after', 'emergency-first', 'trust-builder', 'compact-quote'], { image: IMG, description: 'Infrared and cut-and-patch asphalt repair for potholes and pavement failures.' }, ['pothole repair', 'asphalt repair', 'crack fill', 'pavement repair', 'asphalt patch']),
  mk('Speed Bumps & Curb Stops', 'Accessories', 'parking-lot', [...CT], ['compact-quote', 'trust-builder', 'conversion-focus', 'local-expert'], { image: IMG, description: 'Rubber, asphalt, and concrete speed bumps and parking curb stops installed.' }, ['speed bump', 'speed bumps install', 'curb stop', 'wheel stop']),
]

export const SIGNAGE_WRAPS_SERVICES: ServiceDef[] = [
  mk('Vehicle Wrap', 'Wraps', 'signage-wraps', ['commercial-pro', 'swift-mobile', 'modern-office', 'brutalist'], ['portfolio-first', 'gallery-showcase', 'visual-impact', 'before-after'], { image: IMG, description: 'Full and partial vinyl vehicle wraps for cars, vans, and fleet trucks.' }, ['vehicle wrap', 'car wrap', 'fleet wrap', 'truck wrap', 'van wrap']),
  mk('Business Signage', 'Signs', 'signage-wraps', ['commercial-pro', 'modern-office', 'classic-warm', 'brutalist'], ['portfolio-first', 'gallery-showcase', 'visual-impact', 'conversion-focus'], { image: IMG, description: 'Channel letters, monument signs, window graphics, and LED signage.' }, ['business sign', 'channel letters', 'monument sign', 'storefront sign', 'led sign']),
  mk('Window & Wall Graphics', 'Graphics', 'signage-wraps', ['commercial-pro', 'modern-office', 'bold-remodel', 'brutalist'], ['before-after', 'portfolio-first', 'gallery-showcase', 'conversion-focus'], { image: IMG, description: 'Vinyl window graphics, frosted privacy film, and large-format wall murals.' }, ['window graphics', 'wall mural', 'vinyl wrap wall', 'privacy film', 'wall decal']),
  mk('Channel Letter & Lit Signs', 'Signs', 'signage-wraps', ['commercial-pro', 'brutalist', 'functional-utility', 'modern-office'], ['trust-builder', 'conversion-focus', 'compact-quote', 'standard'], { image: IMG, description: 'Illuminated channel letters and lightbox signs, fabricated and permitted.' }, ['channel letters', 'lighted sign', 'led sign', 'illuminated sign', 'sign maker']),
  mk('Monument & Pylon Signs', 'Signs', 'signage-wraps', ['commercial-pro', 'brutalist', 'functional-utility', 'modern-office'], ['trust-builder', 'conversion-focus', 'compact-quote', 'standard'], { image: IMG, description: 'Freestanding monument and pylon signage from footing to face.' }, ['monument sign', 'pylon sign', 'freestanding sign', 'sign makers']),
  mk('Banners & Trade Show Displays', 'Graphics', 'signage-wraps', ['commercial-pro', 'brutalist', 'functional-utility', 'modern-office'], ['trust-builder', 'conversion-focus', 'compact-quote', 'standard'], { image: IMG, description: 'Vinyl banners, retractable stands, and booth graphics on short lead times.' }, ['banners', 'trade show display', 'custom banner', 'event signage']),
  mk('ADA & Wayfinding Signage', 'Signs', 'signage-wraps', ['commercial-pro', 'brutalist', 'functional-utility', 'modern-office'], ['trust-builder', 'conversion-focus', 'compact-quote', 'standard'], { image: IMG, description: 'Braille room signs, directories, and code-compliant wayfinding sets.' }, ['ada signs', 'wayfinding', 'braille signage', 'directory sign']),
  mk('Sign Repair & Maintenance', 'Signs', 'signage-wraps', ['commercial-pro', 'brutalist', 'functional-utility', 'modern-office'], ['trust-builder', 'conversion-focus', 'compact-quote', 'standard'], { image: IMG, description: 'Lamp and LED replacement, face swaps, and storm damage sign repair.' }, ['sign repair', 'sign maintenance', 'sign service', 'fix sign']),
]

export const WELDING_FABRICATION_SERVICES: ServiceDef[] = [
  mk('Custom Gates & Railings', 'Ornamental', 'welding-fabrication', ['artisan-wood', 'brutalist', 'stone-masonry', 'garage-industrial'], ['portfolio-first', 'gallery-showcase', 'visual-impact', 'before-after'], { image: IMG, description: 'Custom steel gates, handrails, and ornamental ironwork fabricated on-site.' }, ['custom gates', 'steel gate', 'custom railing', 'ornamental iron', 'wrought iron gate']),
  mk('Structural Welding', 'Structural', 'welding-fabrication', ['functional-utility', 'commercial-pro', 'brutalist', 'stone-masonry'], ['trust-builder', 'process-steps', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'AWS-certified structural welding for steel construction and repair projects.' }, ['structural welding', 'steel welding', 'metal fabrication', 'certified welder']),
  mk('Mobile Welding Service', 'Mobile', 'welding-fabrication', ['swift-mobile', 'brutalist', 'garage-industrial', 'functional-utility'], ['emergency-first', 'compact-quote', 'trust-builder', 'local-expert'], { image: IMG, description: 'Field welding service. We come to your job site or farm.' }, ['mobile welding', 'on-site welding', 'field welding', 'mobile welder']),
  mk('Ornamental Iron & Wrought Iron', 'Ornamental', 'welding-fabrication', ['commercial-pro', 'brutalist', 'functional-utility', 'modern-office'], ['trust-builder', 'conversion-focus', 'compact-quote', 'standard'], { image: IMG, description: 'Wrought iron gates, window guards, and decorative ironwork, built to measure.' }, ['wrought iron', 'ornamental iron', 'iron work', 'iron gates', 'blacksmith']),
  mk('Metal Fabrication', 'Structural', 'welding-fabrication', ['commercial-pro', 'brutalist', 'functional-utility', 'modern-office'], ['trust-builder', 'conversion-focus', 'compact-quote', 'standard'], { image: IMG, description: 'Custom metal fabrication from your shop drawings: brackets, frames, and assemblies.' }, ['metal fabrication', 'metal fabricator', 'custom metal', 'fabrication shop']),
  mk('Aluminum & Stainless Welding', 'Structural', 'welding-fabrication', ['commercial-pro', 'brutalist', 'functional-utility', 'modern-office'], ['trust-builder', 'conversion-focus', 'compact-quote', 'standard'], { image: IMG, description: 'TIG and MIG welding in aluminum and stainless for food, marine, and industrial work.' }, ['aluminum welding', 'stainless welding', 'tig welding', 'mig welding']),
  mk('Trailer & Equipment Repair Welding', 'Mobile', 'welding-fabrication', ['commercial-pro', 'brutalist', 'functional-utility', 'modern-office'], ['trust-builder', 'conversion-focus', 'compact-quote', 'standard'], { image: IMG, description: 'Cracked frames, hitches, buckets, and equipment repaired on site or in the shop.' }, ['trailer repair', 'equipment welding', 'frame repair', 'welding repair']),
  mk('Handrail & Stair Fabrication', 'Ornamental', 'welding-fabrication', ['commercial-pro', 'brutalist', 'functional-utility', 'modern-office'], ['trust-builder', 'conversion-focus', 'compact-quote', 'standard'], { image: IMG, description: 'Code-height handrails, guardrails, and steel stair stringers fabricated and set.' }, ['handrail fabrication', 'steel railing', 'metal handrail', 'stair railing']),
]

export const ELEVATOR_SERVICES_SERVICES: ServiceDef[] = [
  mk('Elevator Inspection & Certification', 'Inspection', 'elevator-services', ['commercial-pro', 'modern-office', 'functional-utility', 'classic-warm'], ['trust-report', 'trust-builder', 'compact-quote', 'process-steps'], { image: IMG, description: 'Annual elevator and escalator safety inspections per ASME A17.1.' }, ['elevator inspection', 'elevator certification', 'lift inspection', 'escalator inspection']),
  mk('Elevator Maintenance Contract', 'Maintenance', 'elevator-services', ['commercial-pro', 'modern-office', 'functional-utility', 'classic-warm'], ['trust-report', 'trust-builder', 'compact-quote', 'local-expert'], { image: IMG, description: 'Full-maintenance contracts with 24/7 emergency callback and monthly PM.' }, ['elevator maintenance', 'elevator service contract', 'lift maintenance', 'elevator pm']),
  mk('Elevator Repair', 'Repair', 'elevator-services', ['commercial-pro', 'swift-mobile', 'functional-utility', 'modern-office'], ['emergency-first', 'trust-builder', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'Emergency and scheduled elevator repair for all brands and vintages.' }, ['elevator repair', 'elevator stuck', 'elevator breakdown', 'lift repair']),
  mk('Elevator Modernization', 'Modernization', 'elevator-services', ['commercial-pro', 'modern-office', 'functional-utility', 'bold-remodel'], ['process-steps', 'trust-report', 'trust-builder', 'conversion-focus'], { image: IMG, description: 'Controller, cab interior, and drive modernization to extend equipment life.' }, ['elevator modernization', 'elevator upgrade', 'elevator controller upgrade', 'cab renovation']),
]

export const PARKING_LOT_INDUSTRY: IndustryDef = {
  slug: 'parking-lot', label: 'Parking Lot Services',
  keywords: ['parking lot', 'seal coating', 'line striping', 'pothole repair', 'asphalt sealing', 'lot striping'],
  serviceGroups: ['Sealing', 'Striping', 'Repair', 'Accessories'],
  defaultThemes: ['commercial-pro', 'brutalist', 'functional-utility', 'stone-masonry'],
  defaultLayouts: ['before-after', 'trust-builder', 'compact-quote', 'local-expert'],
  services: PARKING_LOT_SERVICES,
}

export const SIGNAGE_WRAPS_INDUSTRY: IndustryDef = {
  slug: 'signage-wraps', label: 'Signage & Vehicle Wraps',
  keywords: ['vehicle wrap', 'business sign', 'signage', 'car wrap', 'channel letters', 'window graphics', 'sign maker', 'sign makers', 'custom signs', 'sign installation'],
  serviceGroups: ['Wraps', 'Signs', 'Graphics'],
  defaultThemes: ['commercial-pro', 'modern-office', 'brutalist', 'swift-mobile'],
  defaultLayouts: ['portfolio-first', 'gallery-showcase', 'visual-impact', 'before-after'],
  services: SIGNAGE_WRAPS_SERVICES,
}

export const WELDING_FABRICATION_INDUSTRY: IndustryDef = {
  slug: 'welding-fabrication', label: 'Welding & Metal Fabrication',
  keywords: ['welding', 'metal fabrication', 'custom gates', 'structural welding', 'mobile welding', 'ironwork', 'welder', 'welders', 'metal fabricator', 'wrought iron', 'ornamental iron', 'blacksmith'],
  serviceGroups: ['Ornamental', 'Structural', 'Mobile'],
  defaultThemes: ['artisan-wood', 'brutalist', 'garage-industrial', 'stone-masonry'],
  defaultLayouts: ['portfolio-first', 'gallery-showcase', 'visual-impact', 'trust-builder'],
  services: WELDING_FABRICATION_SERVICES,
}

export const ELEVATOR_SERVICES_INDUSTRY: IndustryDef = {
  slug: 'elevator-services', label: 'Elevator Services',
  keywords: ['elevator', 'elevator inspection', 'elevator repair', 'elevator maintenance', 'lift service', 'escalator'],
  serviceGroups: ['Inspection', 'Maintenance', 'Repair', 'Modernization'],
  defaultThemes: ['commercial-pro', 'modern-office', 'functional-utility', 'classic-warm'],
  defaultLayouts: ['trust-report', 'trust-builder', 'compact-quote', 'process-steps'],
  services: ELEVATOR_SERVICES_SERVICES,
}
