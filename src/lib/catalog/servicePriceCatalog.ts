/**
 * Per-service mid-market US price seeds for engagement quote engines.
 * Keyed by canonical ServiceDef.label via matchServiceDef; fallback chain:
 * matched label → industry engineProfiles.serviceDefaults[0] → generic trade.
 */
import type { IndustrySlug } from '@/lib/catalog/types'
import { matchServiceDef } from '@/lib/catalog/serviceCatalog'
import { getEngineProfile } from '@/lib/catalog/engineProfiles'

export type ServicePriceEntry = {
  basic?: number
  standard: number
  premium?: number
  unitLabel?: string
  pricingModelHint?: 'per_unit' | 'flat_tiered' | 'base_plus_distance'
}

export type TierDefaults = { basic: number; standard: number; premium: number }

/** Concrete mid-market ranges — not round $100/$200 placeholders. */
const BY_LABEL: Record<string, ServicePriceEntry> = {
  // Auto body / wraps
  'Collision Repair': { basic: 890, standard: 2450, premium: 6850, pricingModelHint: 'flat_tiered' },
  'Auto Painting': { basic: 420, standard: 1850, premium: 4200, pricingModelHint: 'flat_tiered' },
  'Paintless Dent Repair (PDR)': { basic: 125, standard: 385, premium: 980, pricingModelHint: 'flat_tiered' },
  'Scratch & Chip Repair': { basic: 95, standard: 275, premium: 640, pricingModelHint: 'flat_tiered' },
  'Frame & Structural Repair': { basic: 1250, standard: 3800, premium: 9200, pricingModelHint: 'flat_tiered' },
  'Bumper Repair & Replacement': { basic: 285, standard: 725, premium: 1450, pricingModelHint: 'flat_tiered' },
  'Glass & Windshield': { basic: 165, standard: 385, premium: 720, pricingModelHint: 'flat_tiered' },
  'Auto Wrapping': { basic: 1450, standard: 3250, premium: 5800, pricingModelHint: 'flat_tiered' },

  // Mobile auto / detailing
  'Mobile Auto Detailing': { basic: 125, standard: 249, premium: 475, pricingModelHint: 'flat_tiered' },
  'Ceramic Coating': { basic: 650, standard: 1450, premium: 2850, pricingModelHint: 'flat_tiered' },
  'Paint Correction': { basic: 350, standard: 850, premium: 1650, pricingModelHint: 'flat_tiered' },
  'Interior Detailing': { basic: 95, standard: 185, premium: 325, pricingModelHint: 'flat_tiered' },

  // Plumbing
  'Drain Cleaning': { basic: 129, standard: 249, premium: 485, pricingModelHint: 'flat_tiered' },
  'Water Heater Repair & Install': { basic: 285, standard: 1250, premium: 2850, pricingModelHint: 'flat_tiered' },
  'Leak Detection & Repair': { basic: 175, standard: 425, premium: 980, pricingModelHint: 'flat_tiered' },
  'Fixture Install & Repair': { basic: 145, standard: 325, premium: 685, pricingModelHint: 'flat_tiered' },
  'Sewer Line Service': { basic: 385, standard: 1450, premium: 4850, pricingModelHint: 'flat_tiered' },
  'Repiping & Pipe Replacement': { basic: 850, standard: 4500, premium: 12500, pricingModelHint: 'flat_tiered' },
  'Bathroom Remodel Plumbing': { basic: 2200, standard: 6500, premium: 14500, pricingModelHint: 'flat_tiered' },
  'Kitchen Plumbing': { basic: 450, standard: 1450, premium: 3800, pricingModelHint: 'flat_tiered' },
  'Gas Line Install & Repair': { basic: 225, standard: 685, premium: 1650, pricingModelHint: 'flat_tiered' },
  'Emergency Plumbing': { basic: 195, standard: 385, premium: 750, pricingModelHint: 'flat_tiered' },
  'Water Filtration & Softeners': { basic: 485, standard: 1450, premium: 3200, pricingModelHint: 'flat_tiered' },
  'Commercial Plumbing': { basic: 350, standard: 950, premium: 2800, pricingModelHint: 'flat_tiered' },

  // HVAC
  'AC Repair & Service': { basic: 129, standard: 285, premium: 685, pricingModelHint: 'flat_tiered' },
  'AC Installation & Replacement': { basic: 3200, standard: 5850, premium: 9800, pricingModelHint: 'flat_tiered' },
  'Furnace Repair & Service': { basic: 145, standard: 325, premium: 750, pricingModelHint: 'flat_tiered' },
  'Furnace Installation & Replacement': { basic: 2800, standard: 4850, premium: 8200, pricingModelHint: 'flat_tiered' },
  'Heat Pump Service': { basic: 165, standard: 385, premium: 890, pricingModelHint: 'flat_tiered' },
  'Duct Cleaning & Sealing': { basic: 285, standard: 525, premium: 980, pricingModelHint: 'flat_tiered' },
  'Indoor Air Quality': { basic: 225, standard: 685, premium: 1850, pricingModelHint: 'flat_tiered' },
  'Thermostat & Smart Home': { basic: 145, standard: 325, premium: 685, pricingModelHint: 'flat_tiered' },
  'Commercial HVAC': { basic: 385, standard: 1250, premium: 4500, pricingModelHint: 'flat_tiered' },
  'Emergency HVAC': { basic: 195, standard: 425, premium: 850, pricingModelHint: 'flat_tiered' },
  'Maintenance Plans': { basic: 89, standard: 179, premium: 329, pricingModelHint: 'flat_tiered' },

  // Cleaning
  'Regular House Cleaning': { basic: 115, standard: 175, premium: 265, unitLabel: 'per visit' },
  'Deep Cleaning': { basic: 185, standard: 325, premium: 525, pricingModelHint: 'flat_tiered' },
  'Move-In / Move-Out Cleaning': { basic: 225, standard: 385, premium: 625, pricingModelHint: 'flat_tiered' },
  'Carpet & Upholstery Cleaning': { basic: 95, standard: 185, premium: 345, unitLabel: 'per room' },
  'Window Cleaning': { basic: 125, standard: 245, premium: 425, pricingModelHint: 'flat_tiered' },
  'Post-Construction Cleaning': { basic: 285, standard: 585, premium: 1150, pricingModelHint: 'flat_tiered' },
  'Commercial Office Cleaning': { basic: 0.12, standard: 0.18, premium: 0.28, unitLabel: 'per sq ft' },
  'Exterior / Pressure Washing': { basic: 185, standard: 385, premium: 750, pricingModelHint: 'flat_tiered' },
  'Airbnb / Short-Term Rental Cleaning': { basic: 95, standard: 145, premium: 225, pricingModelHint: 'flat_tiered' },

  // Landscaping
  'Lawn Care & Mowing': { basic: 45, standard: 75, premium: 125, unitLabel: 'per visit' },
  'Landscape Design & Install': { basic: 1850, standard: 6500, premium: 18500, pricingModelHint: 'flat_tiered' },
  'Hardscaping & Patios': { basic: 2800, standard: 8500, premium: 22000, pricingModelHint: 'flat_tiered' },
  'Irrigation & Sprinklers': { basic: 385, standard: 1450, premium: 4200, pricingModelHint: 'flat_tiered' },
  'Tree & Shrub Care': { basic: 185, standard: 485, premium: 1250, pricingModelHint: 'flat_tiered' },
  'Mulching & Bed Maintenance': { basic: 225, standard: 485, premium: 980, pricingModelHint: 'flat_tiered' },
  'Outdoor Lighting': { basic: 650, standard: 1850, premium: 4500, pricingModelHint: 'flat_tiered' },
  'Sod & Turf Installation': { basic: 0.85, standard: 1.45, premium: 2.85, unitLabel: 'per sq ft' },
  'Seasonal Cleanup': { basic: 185, standard: 385, premium: 750, pricingModelHint: 'flat_tiered' },
  'Commercial Landscaping': { basic: 285, standard: 685, premium: 1850, pricingModelHint: 'flat_tiered' },

  // Roofing
  'Roof Replacement': { basic: 6500, standard: 12500, premium: 24500, pricingModelHint: 'flat_tiered' },
  'Roof Repair': { basic: 285, standard: 685, premium: 1850, pricingModelHint: 'flat_tiered' },
  'Storm & Hail Damage': { basic: 450, standard: 2850, premium: 9800, pricingModelHint: 'flat_tiered' },
  'Shingle Roofing': { basic: 4.85, standard: 7.25, premium: 11.5, unitLabel: 'per sq ft' },
  'Metal Roofing': { basic: 8.5, standard: 12.75, premium: 18.5, unitLabel: 'per sq ft' },
  'Flat & Commercial Roofing': { basic: 5.25, standard: 8.5, premium: 14.25, unitLabel: 'per sq ft' },
  'Gutter Install & Repair': { basic: 8.5, standard: 14.5, premium: 24, unitLabel: 'per linear ft' },
  'Roof Inspection': { basic: 125, standard: 225, premium: 385, pricingModelHint: 'flat_tiered' },
  'Skylight Install & Repair': { basic: 650, standard: 1450, premium: 3200, pricingModelHint: 'flat_tiered' },
  'Roof Ventilation & Insulation': { basic: 485, standard: 1450, premium: 3850, pricingModelHint: 'flat_tiered' },

  // Electrical
  'Panel Upgrade & Service': { basic: 850, standard: 1850, premium: 3850, pricingModelHint: 'flat_tiered' },
  'Outlet & Switch Install': { basic: 125, standard: 225, premium: 385, pricingModelHint: 'flat_tiered' },
  'Lighting Design & Install': { basic: 285, standard: 850, premium: 2450, pricingModelHint: 'flat_tiered' },
  'EV Charger Installation': { basic: 650, standard: 1250, premium: 2450, pricingModelHint: 'flat_tiered' },
  'Whole-Home Rewiring': { basic: 8500, standard: 16500, premium: 32000, pricingModelHint: 'flat_tiered' },
  'Ceiling Fan Install': { basic: 145, standard: 245, premium: 385, pricingModelHint: 'flat_tiered' },
  'Generator Install & Hookup': { basic: 2800, standard: 6500, premium: 14500, pricingModelHint: 'flat_tiered' },
  'Smart Home & Automation': { basic: 385, standard: 1250, premium: 4500, pricingModelHint: 'flat_tiered' },
  'Commercial Electrical': { basic: 285, standard: 850, premium: 2800, pricingModelHint: 'flat_tiered' },
  'Emergency Electrical': { basic: 195, standard: 385, premium: 750, pricingModelHint: 'flat_tiered' },
  'Surge Protection & Safety': { basic: 225, standard: 485, premium: 980, pricingModelHint: 'flat_tiered' },

  // Towing
  'Light-Duty Towing': { basic: 85, standard: 125, premium: 185, unitLabel: 'hookup + per mile', pricingModelHint: 'base_plus_distance' },
  'Heavy-Duty Towing': { basic: 185, standard: 325, premium: 550, unitLabel: 'hookup + per mile', pricingModelHint: 'base_plus_distance' },
  'Roadside Assistance': { basic: 65, standard: 95, premium: 145, pricingModelHint: 'flat_tiered' },
  'Accident Recovery': { basic: 145, standard: 285, premium: 485, pricingModelHint: 'flat_tiered' },
  'Winch-Out & Off-Road Recovery': { basic: 125, standard: 225, premium: 385, pricingModelHint: 'flat_tiered' },
  'Flatbed Transport': { basic: 95, standard: 155, premium: 245, unitLabel: 'hookup + per mile', pricingModelHint: 'base_plus_distance' },
  'Motorcycle Towing': { basic: 85, standard: 135, premium: 195, pricingModelHint: 'flat_tiered' },
  'Fleet & Commercial Towing': { basic: 125, standard: 225, premium: 385, pricingModelHint: 'base_plus_distance' },
  'Impound & Private Property Towing': { basic: 95, standard: 145, premium: 225, pricingModelHint: 'flat_tiered' },
  'Long-Distance Towing': { basic: 1.85, standard: 2.85, premium: 4.25, unitLabel: 'per mile', pricingModelHint: 'base_plus_distance' },
  // Fifth wave (Angi coverage gap). Per the coverage plan, new industries ship
  // WITHOUT researched prices and inherit the engine profile's generic tiers —
  // except these four, whose price shape is not "tiered per job" and would read
  // as nonsense at a generic number: material by the load, a trip fee plus
  // exclusion work, flat per device, and per linear foot of roofline.
  'Topsoil & Fill Dirt Delivery': { basic: 165, standard: 385, premium: 720, unitLabel: 'per load', pricingModelHint: 'per_unit' },
  'Gravel, Sand & Stone Delivery': { basic: 185, standard: 420, premium: 850, unitLabel: 'per load', pricingModelHint: 'per_unit' },
  'Site Excavation': { basic: 850, standard: 3200, premium: 9500, pricingModelHint: 'flat_tiered' },
  'Raccoon & Opossum Removal': { basic: 185, standard: 385, premium: 750, unitLabel: 'per trip', pricingModelHint: 'flat_tiered' },
  'Bat Removal & Exclusion': { basic: 450, standard: 1450, premium: 3800, pricingModelHint: 'flat_tiered' },
  'Attic Cleanup & Damage Repair': { basic: 650, standard: 1850, premium: 4500, pricingModelHint: 'flat_tiered' },
  'Phone Screen Replacement': { basic: 79, standard: 149, premium: 289, unitLabel: 'per device', pricingModelHint: 'per_unit' },
  'Phone Battery & Port Repair': { basic: 59, standard: 95, premium: 165, unitLabel: 'per device', pricingModelHint: 'per_unit' },
  'TV Repair': { basic: 95, standard: 225, premium: 485, unitLabel: 'per device', pricingModelHint: 'per_unit' },
  'Christmas Light Installation': { basic: 385, standard: 950, premium: 2400, unitLabel: 'per linear foot of roofline', pricingModelHint: 'per_unit' },
  'Commercial Holiday Lighting': { basic: 1250, standard: 3800, premium: 9500, pricingModelHint: 'flat_tiered' },
  'Custom Home Building': { basic: 185000, standard: 385000, premium: 750000, pricingModelHint: 'flat_tiered' },
  'Home Additions': { basic: 32000, standard: 78000, premium: 165000, pricingModelHint: 'flat_tiered' },
  'Whole-House Remodeling': { basic: 45000, standard: 125000, premium: 285000, pricingModelHint: 'flat_tiered' },
  'Basement Finishing': { basic: 18500, standard: 38000, premium: 72000, pricingModelHint: 'flat_tiered' },
  'Garage Building & Conversion': { basic: 14500, standard: 32000, premium: 68000, pricingModelHint: 'flat_tiered' },
  'House Leveling & Structural Repair': { basic: 4800, standard: 12500, premium: 28000, pricingModelHint: 'flat_tiered' },
  'Modular & Manufactured Home Setup': { basic: 6500, standard: 14500, premium: 32000, pricingModelHint: 'flat_tiered' },
  'Construction Management': { basic: 3800, standard: 9500, premium: 24000, pricingModelHint: 'flat_tiered' },
  'Shed Building & Installation': { basic: 2850, standard: 6200, premium: 14500, pricingModelHint: 'flat_tiered' },
  'Gazebo & Pergola Construction': { basic: 3400, standard: 8500, premium: 19500, pricingModelHint: 'flat_tiered' },
  'Dock Building & Repair': { basic: 4200, standard: 14500, premium: 38000, pricingModelHint: 'flat_tiered' },
  'Greenhouse Construction': { basic: 3800, standard: 11500, premium: 28000, pricingModelHint: 'flat_tiered' },
  'Pole Barn & Metal Building': { basic: 12500, standard: 32000, premium: 78000, pricingModelHint: 'flat_tiered' },
  'Carport & Awning Structures': { basic: 2400, standard: 5800, premium: 13500, pricingModelHint: 'flat_tiered' },
  'Storm Shelter Installation': { basic: 4500, standard: 8900, premium: 16500, pricingModelHint: 'flat_tiered' },
  'Playhouse & Treehouse Building': { basic: 1850, standard: 5400, premium: 14500, pricingModelHint: 'flat_tiered' },
  'Furniture Reupholstery': { basic: 485, standard: 1250, premium: 3200, unitLabel: 'per piece', pricingModelHint: 'per_unit' },
  'Furniture Repair': { basic: 145, standard: 385, premium: 850, unitLabel: 'per piece', pricingModelHint: 'per_unit' },
  'Wood Furniture Refinishing': { basic: 285, standard: 685, premium: 1650, unitLabel: 'per piece', pricingModelHint: 'per_unit' },
  'Antique Restoration': { basic: 350, standard: 950, premium: 2850, unitLabel: 'per piece', pricingModelHint: 'per_unit' },
  'Leather Furniture Repair': { basic: 195, standard: 495, premium: 1250, unitLabel: 'per piece', pricingModelHint: 'per_unit' },
  'Recliner & Mechanism Repair': { basic: 125, standard: 285, premium: 585, unitLabel: 'per piece', pricingModelHint: 'per_unit' },
  'Cane, Rush & Wicker Repair': { basic: 165, standard: 385, premium: 780, unitLabel: 'per piece', pricingModelHint: 'per_unit' },
  'Lamp Repair & Rewiring': { basic: 55, standard: 115, premium: 245, unitLabel: 'per piece', pricingModelHint: 'per_unit' },
  'Squirrel & Rodent Removal': { basic: 225, standard: 485, premium: 985, unitLabel: 'per trip', pricingModelHint: 'flat_tiered' },
  'Bird Control & Nest Removal': { basic: 285, standard: 650, premium: 1650, pricingModelHint: 'flat_tiered' },
  'Snake Removal': { basic: 145, standard: 285, premium: 525, unitLabel: 'per trip', pricingModelHint: 'flat_tiered' },
  'Bee & Wasp Removal': { basic: 165, standard: 385, premium: 850, unitLabel: 'per trip', pricingModelHint: 'flat_tiered' },
  'Skunk Removal & Odor Treatment': { basic: 245, standard: 525, premium: 1100, unitLabel: 'per trip', pricingModelHint: 'flat_tiered' },
  'Retractable Awning Installation': { basic: 1850, standard: 3800, premium: 7500, pricingModelHint: 'flat_tiered' },
  'Fixed & Metal Awnings': { basic: 850, standard: 2200, premium: 4800, pricingModelHint: 'flat_tiered' },
  'Awning Repair & Recover': { basic: 285, standard: 850, premium: 2200, pricingModelHint: 'flat_tiered' },
  'Sunroom Construction': { basic: 18500, standard: 42000, premium: 92000, pricingModelHint: 'flat_tiered' },
  'Screen Room & Porch Enclosure': { basic: 4200, standard: 11500, premium: 24000, pricingModelHint: 'flat_tiered' },
  'Patio & Deck Covers': { basic: 3200, standard: 8500, premium: 19500, pricingModelHint: 'flat_tiered' },
  'Hurricane Shutters & Film': { basic: 2400, standard: 6800, premium: 16500, pricingModelHint: 'flat_tiered' },
  'Balcony & Railing Enclosure': { basic: 1850, standard: 4800, premium: 11500, pricingModelHint: 'flat_tiered' },
  'Playground & Play Set Installation': { basic: 385, standard: 850, premium: 1850, pricingModelHint: 'flat_tiered' },
  'Playground Repair & Inspection': { basic: 225, standard: 485, premium: 1150, pricingModelHint: 'flat_tiered' },
  'Basketball Hoop Installation': { basic: 395, standard: 725, premium: 1450, pricingModelHint: 'flat_tiered' },
  'Trampoline Assembly & Anchoring': { basic: 185, standard: 345, premium: 625, pricingModelHint: 'flat_tiered' },
  'Sport Court & Tennis Court Construction': { basic: 22000, standard: 48000, premium: 95000, pricingModelHint: 'flat_tiered' },
  'Batting Cage & Practice Nets': { basic: 1450, standard: 3800, premium: 9500, pricingModelHint: 'flat_tiered' },
  'Grill & Outdoor Kitchen Assembly': { basic: 145, standard: 325, premium: 785, pricingModelHint: 'flat_tiered' },
  'Grill & Outdoor Equipment Repair': { basic: 95, standard: 245, premium: 525, pricingModelHint: 'flat_tiered' },
  'Pond Construction': { basic: 3800, standard: 9500, premium: 24000, pricingModelHint: 'flat_tiered' },
  'Koi Pond Design & Build': { basic: 6500, standard: 15500, premium: 38000, pricingModelHint: 'flat_tiered' },
  'Waterfall & Stream Installation': { basic: 3200, standard: 8500, premium: 21000, pricingModelHint: 'flat_tiered' },
  'Fountain Installation': { basic: 850, standard: 2400, premium: 6800, pricingModelHint: 'flat_tiered' },
  'Fountain & Pump Repair': { basic: 165, standard: 425, premium: 985, pricingModelHint: 'flat_tiered' },
  'Pond Cleaning & Maintenance': { basic: 285, standard: 585, premium: 1250, unitLabel: 'per visit', pricingModelHint: 'flat_tiered' },
  'Algae & Water Quality Treatment': { basic: 145, standard: 325, premium: 750, unitLabel: 'per visit', pricingModelHint: 'flat_tiered' },
  'Aquarium Setup & Service': { basic: 125, standard: 285, premium: 685, unitLabel: 'per visit', pricingModelHint: 'flat_tiered' },
  'Land Clearing & Brush Removal': { basic: 1450, standard: 4800, premium: 14500, unitLabel: 'per acre', pricingModelHint: 'per_unit' },
  'Grading & Drainage Correction': { basic: 1250, standard: 3800, premium: 9500, pricingModelHint: 'flat_tiered' },
  'Driveway Grading & Gravel': { basic: 685, standard: 1850, premium: 4500, pricingModelHint: 'flat_tiered' },
  'Pond & Basin Digging': { basic: 3200, standard: 9500, premium: 28000, pricingModelHint: 'flat_tiered' },
  'Demolition & Debris Hauling': { basic: 1850, standard: 6500, premium: 18500, pricingModelHint: 'flat_tiered' },
  'Home Theater Installation': { basic: 1850, standard: 5400, premium: 14500, pricingModelHint: 'flat_tiered' },
  'Whole-Home Audio': { basic: 1450, standard: 4200, premium: 11500, pricingModelHint: 'flat_tiered' },
  'TV Mounting & Wire Concealment': { basic: 165, standard: 325, premium: 685, unitLabel: 'per TV', pricingModelHint: 'per_unit' },
  'Home Audio Equipment Repair': { basic: 125, standard: 285, premium: 625, unitLabel: 'per unit', pricingModelHint: 'per_unit' },
  'TV Antenna Installation': { basic: 285, standard: 525, premium: 985, pricingModelHint: 'flat_tiered' },
  'Satellite TV Installation': { basic: 185, standard: 385, premium: 750, pricingModelHint: 'flat_tiered' },
  'Home Network & WiFi Installation': { basic: 385, standard: 950, premium: 2400, pricingModelHint: 'flat_tiered' },
  'Phone & Intercom Wiring': { basic: 225, standard: 585, premium: 1450, pricingModelHint: 'flat_tiered' },
  'Wheelchair Ramp Installation': { basic: 1450, standard: 3400, premium: 8500, pricingModelHint: 'flat_tiered' },
  'Stair Lift Installation': { basic: 3200, standard: 5400, premium: 12500, pricingModelHint: 'flat_tiered' },
  'Vertical Platform Lift': { basic: 6500, standard: 12500, premium: 24000, pricingModelHint: 'flat_tiered' },
  'Accessible Bathroom Conversion': { basic: 8500, standard: 18500, premium: 38000, pricingModelHint: 'flat_tiered' },
  'Walk-In Tub Installation': { basic: 6200, standard: 11500, premium: 19500, pricingModelHint: 'flat_tiered' },
  'Grab Bar & Safety Rail Installation': { basic: 145, standard: 385, premium: 850, pricingModelHint: 'flat_tiered' },
  'Handrail & Stair Railing Installation': { basic: 485, standard: 1250, premium: 3200, pricingModelHint: 'flat_tiered' },
  'Stair Construction & Repair': { basic: 1450, standard: 4200, premium: 11500, pricingModelHint: 'flat_tiered' },
  'Asbestos Testing & Inspection': { basic: 285, standard: 550, premium: 1150, pricingModelHint: 'flat_tiered' },
  'Asbestos Abatement': { basic: 1850, standard: 5400, premium: 18500, pricingModelHint: 'flat_tiered' },
  'Popcorn Ceiling & Floor Tile Abatement': { basic: 1250, standard: 3800, premium: 9500, pricingModelHint: 'flat_tiered' },
  'Lead Paint Testing': { basic: 245, standard: 485, premium: 950, pricingModelHint: 'flat_tiered' },
  'Lead Paint Abatement': { basic: 1650, standard: 5800, premium: 16500, pricingModelHint: 'flat_tiered' },
  'Radon Testing & Mitigation': { basic: 185, standard: 1450, premium: 3200, pricingModelHint: 'flat_tiered' },
  'Vermiculite & Insulation Removal': { basic: 2200, standard: 6500, premium: 15500, pricingModelHint: 'flat_tiered' },
  'Hazardous Material Disposal': { basic: 385, standard: 1250, premium: 4200, pricingModelHint: 'flat_tiered' },
  'Bathtub Refinishing': { basic: 425, standard: 585, premium: 950, unitLabel: 'per tub', pricingModelHint: 'per_unit' },
  'Tile & Shower Reglazing': { basic: 585, standard: 1150, premium: 2400, pricingModelHint: 'flat_tiered' },
  'Sink Refinishing': { basic: 195, standard: 325, premium: 585, unitLabel: 'per sink', pricingModelHint: 'per_unit' },
  'Countertop Resurfacing': { basic: 685, standard: 1650, premium: 3800, pricingModelHint: 'flat_tiered' },
  'Cabinet Refacing': { basic: 4200, standard: 9500, premium: 18500, pricingModelHint: 'flat_tiered' },
  'Door Refinishing': { basic: 285, standard: 685, premium: 1450, unitLabel: 'per door', pricingModelHint: 'per_unit' },
  'Chip & Scratch Repair': { basic: 145, standard: 245, premium: 425, pricingModelHint: 'flat_tiered' },
  'Commercial Tub & Surface Refinishing': { basic: 285, standard: 485, premium: 850, unitLabel: 'per unit', pricingModelHint: 'per_unit' },
  'Water Damage Recovery': { basic: 89, standard: 165, premium: 325, unitLabel: 'per device', pricingModelHint: 'per_unit' },
  'Tablet Repair': { basic: 95, standard: 185, premium: 349, unitLabel: 'per device', pricingModelHint: 'per_unit' },
  'Laptop & Computer Screen Repair': { basic: 145, standard: 265, premium: 485, unitLabel: 'per device', pricingModelHint: 'per_unit' },
  'Game Console Repair': { basic: 89, standard: 165, premium: 315, unitLabel: 'per device', pricingModelHint: 'per_unit' },
  'Data Transfer & Device Setup': { basic: 49, standard: 95, premium: 185, unitLabel: 'per device', pricingModelHint: 'per_unit' },
  'Emergency Water Extraction': { basic: 685, standard: 2400, premium: 6500, pricingModelHint: 'flat_tiered' },
  'Structural Drying & Dehumidification': { basic: 850, standard: 2850, premium: 7500, pricingModelHint: 'flat_tiered' },
  'Burst Pipe & Appliance Leak Cleanup': { basic: 950, standard: 3200, premium: 8500, pricingModelHint: 'flat_tiered' },
  'Basement Flood Cleanup': { basic: 1250, standard: 4200, premium: 11500, pricingModelHint: 'flat_tiered' },
  'Sewage & Category 3 Cleanup': { basic: 1850, standard: 5800, premium: 15500, pricingModelHint: 'flat_tiered' },
  'Storm & Roof Leak Damage': { basic: 1150, standard: 3800, premium: 10500, pricingModelHint: 'flat_tiered' },
  'Moisture Inspection & Documentation': { basic: 285, standard: 585, premium: 1150, pricingModelHint: 'flat_tiered' },
  'Reconstruction After Water Damage': { basic: 4500, standard: 14500, premium: 42000, pricingModelHint: 'flat_tiered' },
  'Whole-Home Organizing': { basic: 685, standard: 1850, premium: 4800, pricingModelHint: 'flat_tiered' },
  'Kitchen & Pantry Organizing': { basic: 385, standard: 850, premium: 1950, pricingModelHint: 'flat_tiered' },
  'Closet & Wardrobe Editing': { basic: 425, standard: 950, premium: 2400, pricingModelHint: 'flat_tiered' },
  'Decluttering & Donation Coordination': { basic: 285, standard: 685, premium: 1650, pricingModelHint: 'flat_tiered' },
  'Downsizing & Senior Move Management': { basic: 1250, standard: 3400, premium: 8500, pricingModelHint: 'flat_tiered' },
  'Unpacking & Move-In Setup': { basic: 585, standard: 1450, premium: 3600, pricingModelHint: 'flat_tiered' },
  'Interior Styling & Space Planning': { basic: 485, standard: 1450, premium: 4200, unitLabel: 'per room', pricingModelHint: 'per_unit' },
  'Feng Shui & Energy Consultation': { basic: 285, standard: 585, premium: 1250, pricingModelHint: 'flat_tiered' },
  'Holiday Decor Design & Install': { basic: 485, standard: 1250, premium: 3400, pricingModelHint: 'flat_tiered' },
  'Tree Setup & Interior Decorating': { basic: 285, standard: 750, premium: 2200, pricingModelHint: 'flat_tiered' },
  'Takedown, Removal & Storage': { basic: 185, standard: 425, premium: 985, pricingModelHint: 'flat_tiered' },
  'Lighting Repair & Maintenance': { basic: 125, standard: 285, premium: 585, pricingModelHint: 'flat_tiered' },
  'Event & Party Lighting': { basic: 585, standard: 1650, premium: 4500, pricingModelHint: 'flat_tiered' },
  'Seasonal & Fall Decorating': { basic: 285, standard: 685, premium: 1650, pricingModelHint: 'flat_tiered' },
}

const GENERIC_TRADE: TierDefaults = { basic: 89, standard: 175, premium: 385 }

function entryToTiers(entry: ServicePriceEntry): TierDefaults {
  const standard = entry.standard
  const basic =
    entry.basic !== undefined && entry.basic !== null
      ? entry.basic
      : Math.max(0, Math.round(standard * 0.7 * 100) / 100)
  const premium =
    entry.premium !== undefined && entry.premium !== null
      ? entry.premium
      : Math.round(standard * 1.6 * 100) / 100
  return { basic, standard, premium }
}

function engineProfileTiers(slug: IndustrySlug): TierDefaults | null {
  const tiers = getEngineProfile(slug)?.serviceDefaults?.[0]?.tiers ?? []
  if (!tiers.length) return null
  const hintFor = (tier: 'basic' | 'standard' | 'premium') =>
    tiers.find((t) => t.tier === tier)?.priceHint
  const standard = hintFor('standard') ?? tiers[0]?.priceHint ?? GENERIC_TRADE.standard
  const basic = hintFor('basic') ?? Math.max(1, Math.round(standard * 0.7))
  const premium = hintFor('premium') ?? Math.round(standard * 1.6)
  return { basic, standard, premium }
}

/** Lookup catalog entry by free-text service name (via matchServiceDef). */
export function lookupServicePriceEntry(
  serviceName: string,
  industrySlug?: IndustrySlug
): ServicePriceEntry | null {
  const def = matchServiceDef(serviceName, industrySlug)
  if (def?.label && BY_LABEL[def.label]) return BY_LABEL[def.label]
  const exact = BY_LABEL[serviceName.trim()]
  if (exact) return exact
  return null
}

/**
 * Resolve tier defaults for one service name.
 * Chain: matched catalog label → industry engine profile → generic trade.
 */
export function resolveServiceTiers(
  serviceName: string,
  industrySlug?: IndustrySlug
): TierDefaults {
  const entry = lookupServicePriceEntry(serviceName, industrySlug)
  if (entry) return entryToTiers(entry)

  if (industrySlug) {
    const fromProfile = engineProfileTiers(industrySlug)
    if (fromProfile) return fromProfile
  }

  const def = matchServiceDef(serviceName, industrySlug)
  if (def?.industry) {
    const fromIndustry = engineProfileTiers(def.industry as IndustrySlug)
    if (fromIndustry) return fromIndustry
  }

  return { ...GENERIC_TRADE }
}

/** Format per-service seed lines for the AI buildWidgetConfig prompt. */
export function formatServiceSeedPricing(
  services: string[],
  industrySlug?: IndustrySlug
): string {
  if (!services.length) return ''
  return services
    .filter((s) => s.trim())
    .map((s) => {
      const t = resolveServiceTiers(s, industrySlug)
      const entry = lookupServicePriceEntry(s, industrySlug)
      const unit = entry?.unitLabel ? ` (${entry.unitLabel})` : ''
      return `- ${s}: basic≈$${t.basic}, standard≈$${t.standard}, premium≈$${t.premium}${unit}`
    })
    .join('\n')
}

export function getCatalogLabelKeys(): string[] {
  return Object.keys(BY_LABEL)
}
