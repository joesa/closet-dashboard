import type { IndustryDef } from '@/lib/catalog/types'
import { CUSTOM_CLOSETS_GROUPS, CUSTOM_CLOSETS_SERVICES } from '@/lib/catalog/industries/custom-closets'
import { PLUMBING_INDUSTRY } from '@/lib/catalog/industries/plumbing'
import { HVAC_INDUSTRY } from '@/lib/catalog/industries/hvac'
import { LANDSCAPING_INDUSTRY } from '@/lib/catalog/industries/landscaping'
import { TOWING_INDUSTRY } from '@/lib/catalog/industries/towing'
import { ROOFING_INDUSTRY } from '@/lib/catalog/industries/roofing'
import { ELECTRICAL_INDUSTRY } from '@/lib/catalog/industries/electrical'
import { PEST_CONTROL_INDUSTRY } from '@/lib/catalog/industries/pest-control'
import { PRESSURE_WASHING_INDUSTRY } from '@/lib/catalog/industries/pressure-washing'
import { TREE_SERVICE_INDUSTRY } from '@/lib/catalog/industries/tree-service'
import { PAINTING_INDUSTRY } from '@/lib/catalog/industries/painting'
import { CLEANING_INDUSTRY } from '@/lib/catalog/industries/cleaning'
import { HANDYMAN_INDUSTRY } from '@/lib/catalog/industries/handyman'
import { FLOORING_INDUSTRY } from '@/lib/catalog/industries/flooring'
import { CARPENTRY_INDUSTRY } from '@/lib/catalog/industries/carpentry'
import { APPLIANCE_REPAIR_INDUSTRY } from '@/lib/catalog/industries/appliance-repair'
import { LOCKSMITH_INDUSTRY } from '@/lib/catalog/industries/locksmith'
import { MOVING_INDUSTRY } from '@/lib/catalog/industries/moving'
import { MOBILE_AUTO_INDUSTRY } from '@/lib/catalog/industries/mobile-auto'
import { JUNK_REMOVAL_INDUSTRY } from '@/lib/catalog/industries/junk-removal'
import { CONCRETE_MASONRY_INDUSTRY } from '@/lib/catalog/industries/concrete-masonry'
import { POOL_SPA_INDUSTRY } from '@/lib/catalog/industries/pool-spa'
import { GARAGE_DOOR_INDUSTRY } from '@/lib/catalog/industries/garage-door'
import { GUTTERS_INDUSTRY } from '@/lib/catalog/industries/gutters'
import { CHIMNEY_FIREPLACE_INDUSTRY } from '@/lib/catalog/industries/chimney-fireplace'
import { HOME_INSPECTION_INDUSTRY } from '@/lib/catalog/industries/home-inspection'
import { SECURITY_SYSTEMS_INDUSTRY } from '@/lib/catalog/industries/security-systems'
import { IRRIGATION_INDUSTRY } from '@/lib/catalog/industries/irrigation'
import { SOLAR_INDUSTRY } from '@/lib/catalog/industries/solar'
import { PET_SERVICES_INDUSTRY } from '@/lib/catalog/industries/pet-services'
import { WINDOWS_DOORS_INDUSTRY } from '@/lib/catalog/industries/windows-doors'
// Third-wave industries (wave 3 — 50 new slugs)
import { INSULATION_INDUSTRY } from '@/lib/catalog/industries/insulation'
import { DRYWALL_INDUSTRY } from '@/lib/catalog/industries/drywall'
import { WATERPROOFING_INDUSTRY, FOUNDATION_REPAIR_INDUSTRY } from '@/lib/catalog/industries/waterproofing-foundation'
import { SIDING_INDUSTRY } from '@/lib/catalog/industries/siding'
import { FENCING_INDUSTRY } from '@/lib/catalog/industries/fencing'
import { SNOW_REMOVAL_INDUSTRY } from '@/lib/catalog/industries/snow-removal'
import { GENERATOR_SERVICES_INDUSTRY } from '@/lib/catalog/industries/generator-services'
import { COUNTERTOPS_INDUSTRY } from '@/lib/catalog/industries/countertops'
import { CABINET_PAINTING_INDUSTRY } from '@/lib/catalog/industries/cabinet-painting'
import { BATHROOM_REMODEL_INDUSTRY, KITCHEN_REMODEL_INDUSTRY } from '@/lib/catalog/industries/remodeling'
import { EPOXY_FLOORING_INDUSTRY } from '@/lib/catalog/industries/epoxy-flooring'
import { OUTDOOR_LIGHTING_INDUSTRY } from '@/lib/catalog/industries/outdoor-lighting'
import { DECK_MAINTENANCE_INDUSTRY } from '@/lib/catalog/industries/deck-maintenance'
import { SEPTIC_SERVICES_INDUSTRY, WELL_SERVICES_INDUSTRY } from '@/lib/catalog/industries/septic-well'
import { WATER_TREATMENT_INDUSTRY } from '@/lib/catalog/industries/water-treatment'
import { GLASS_MIRROR_INDUSTRY, BLINDS_SHUTTERS_INDUSTRY } from '@/lib/catalog/industries/glass-blinds'
import { MOLD_REMEDIATION_INDUSTRY, FIRE_RESTORATION_INDUSTRY } from '@/lib/catalog/industries/restoration'
import { DUCT_CLEANING_INDUSTRY, TILE_GROUT_CLEANING_INDUSTRY } from '@/lib/catalog/industries/duct-tile-cleaning'
import { FIRE_PROTECTION_INDUSTRY } from '@/lib/catalog/industries/fire-protection'
import { COMMERCIAL_REFRIGERATION_INDUSTRY, RESTAURANT_EQUIPMENT_INDUSTRY } from '@/lib/catalog/industries/commercial-kitchen'
import { PARKING_LOT_INDUSTRY, SIGNAGE_WRAPS_INDUSTRY, WELDING_FABRICATION_INDUSTRY, ELEVATOR_SERVICES_INDUSTRY } from '@/lib/catalog/industries/commercial-specialty'
import { MOBILE_NOTARY_INDUSTRY, PERSONAL_TRAINING_INDUSTRY, MASSAGE_THERAPY_INDUSTRY, TUTORING_INDUSTRY } from '@/lib/catalog/industries/personal-services'
import { CATERING_CHEF_INDUSTRY } from '@/lib/catalog/industries/catering-chef'
import { PHOTOGRAPHY_VIDEO_INDUSTRY, DRONE_SERVICES_INDUSTRY, HOME_STAGING_INDUSTRY } from '@/lib/catalog/industries/creative-media'
import { COURIER_DELIVERY_INDUSTRY, MEDICAL_TRANSPORT_INDUSTRY, LIMO_SHUTTLE_INDUSTRY, HOTSHOT_TRUCKING_INDUSTRY, RV_BOAT_SERVICE_INDUSTRY } from '@/lib/catalog/industries/transport-logistics'
import { EVENT_RENTALS_INDUSTRY, DJ_ENTERTAINMENT_INDUSTRY, BOUNCE_HOUSE_INDUSTRY, FOOD_TRUCK_INDUSTRY } from '@/lib/catalog/industries/events-entertainment'
import { IT_COMPUTER_REPAIR_INDUSTRY } from '@/lib/catalog/industries/it-computer-repair'
import { AUTO_BODY_INDUSTRY } from '@/lib/catalog/industries/auto-body'
// Fourth-wave industries (30 new slugs — Hospitality/Leisure, Professional
// Services, Personal & Wellness, Healthcare & Education, FIRE, Logistics)
import {
  HOTEL_LODGING_INDUSTRY,
  RESTAURANTS_BARS_INDUSTRY,
  TOURISM_TRAVEL_INDUSTRY,
  EVENT_PLANNING_INDUSTRY,
  RECREATION_ENTERTAINMENT_INDUSTRY,
  ARTS_CULTURE_INDUSTRY,
} from '@/lib/catalog/industries/hospitality-leisure'
import {
  LEGAL_SERVICES_INDUSTRY,
  FINANCIAL_PROFESSIONALS_INDUSTRY,
  BUSINESS_CONSULTING_INDUSTRY,
  MARKETING_ADVERTISING_INDUSTRY,
  IT_SERVICES_INDUSTRY,
  ARCHITECTURE_ENGINEERING_INDUSTRY,
  RESEARCH_SERVICES_INDUSTRY,
} from '@/lib/catalog/industries/professional-services'
import {
  BEAUTY_SALON_INDUSTRY,
  SPA_WELLNESS_INDUSTRY,
  FITNESS_STUDIO_INDUSTRY,
  LIFE_SERVICES_INDUSTRY,
  LAUNDRY_SERVICES_INDUSTRY,
} from '@/lib/catalog/industries/personal-wellness'
import {
  MEDICAL_CLINIC_INDUSTRY,
  THERAPY_REHAB_INDUSTRY,
  SENIOR_CARE_INDUSTRY,
  EDUCATION_FORMAL_INDUSTRY,
  ENRICHMENT_EDUCATION_INDUSTRY,
} from '@/lib/catalog/industries/healthcare-education'
import {
  BANKING_LENDING_INDUSTRY,
  INVESTMENT_SERVICES_INDUSTRY,
  INSURANCE_SERVICES_INDUSTRY,
  REAL_ESTATE_SERVICES_INDUSTRY,
} from '@/lib/catalog/industries/finance-realestate'
import {
  PASSENGER_TRANSPORT_INDUSTRY,
  FREIGHT_LOGISTICS_INDUSTRY,
  WASTE_MANAGEMENT_INDUSTRY,
} from '@/lib/catalog/industries/logistics-utilities'

export const CUSTOM_CLOSETS_INDUSTRY: IndustryDef = {
  slug: 'custom-closets',
  label: 'Custom Closets & Storage',
  keywords: ['closet', 'organization', 'custom closet', 'walk-in closet', 'walk in closet', 'reach-in closet', 'closet organization', 'home storage', 'storage solutions'],
  serviceGroups: [...CUSTOM_CLOSETS_GROUPS],
  defaultThemes: ['luxury-minimal', 'modern-office', 'functional-utility', 'classic-warm'],
  defaultLayouts: ['standard', 'portfolio-first', 'conversion-focus', 'gallery-showcase'],
  services: CUSTOM_CLOSETS_SERVICES,
}

export const INDUSTRIES: IndustryDef[] = [
  CUSTOM_CLOSETS_INDUSTRY,
  PLUMBING_INDUSTRY,
  HVAC_INDUSTRY,
  LANDSCAPING_INDUSTRY,
  TOWING_INDUSTRY,
  ROOFING_INDUSTRY,
  ELECTRICAL_INDUSTRY,
  PEST_CONTROL_INDUSTRY,
  PRESSURE_WASHING_INDUSTRY,
  TREE_SERVICE_INDUSTRY,
  PAINTING_INDUSTRY,
  CLEANING_INDUSTRY,
  HANDYMAN_INDUSTRY,
  FLOORING_INDUSTRY,
  CARPENTRY_INDUSTRY,
  APPLIANCE_REPAIR_INDUSTRY,
  LOCKSMITH_INDUSTRY,
  MOVING_INDUSTRY,
  MOBILE_AUTO_INDUSTRY,
  JUNK_REMOVAL_INDUSTRY,
  CONCRETE_MASONRY_INDUSTRY,
  POOL_SPA_INDUSTRY,
  GARAGE_DOOR_INDUSTRY,
  GUTTERS_INDUSTRY,
  CHIMNEY_FIREPLACE_INDUSTRY,
  HOME_INSPECTION_INDUSTRY,
  SECURITY_SYSTEMS_INDUSTRY,
  IRRIGATION_INDUSTRY,
  SOLAR_INDUSTRY,
  PET_SERVICES_INDUSTRY,
  WINDOWS_DOORS_INDUSTRY,
  // Third-wave industries
  INSULATION_INDUSTRY,
  DRYWALL_INDUSTRY,
  WATERPROOFING_INDUSTRY,
  FOUNDATION_REPAIR_INDUSTRY,
  SIDING_INDUSTRY,
  FENCING_INDUSTRY,
  SNOW_REMOVAL_INDUSTRY,
  GENERATOR_SERVICES_INDUSTRY,
  COUNTERTOPS_INDUSTRY,
  CABINET_PAINTING_INDUSTRY,
  BATHROOM_REMODEL_INDUSTRY,
  KITCHEN_REMODEL_INDUSTRY,
  EPOXY_FLOORING_INDUSTRY,
  OUTDOOR_LIGHTING_INDUSTRY,
  DECK_MAINTENANCE_INDUSTRY,
  SEPTIC_SERVICES_INDUSTRY,
  WELL_SERVICES_INDUSTRY,
  WATER_TREATMENT_INDUSTRY,
  GLASS_MIRROR_INDUSTRY,
  BLINDS_SHUTTERS_INDUSTRY,
  MOLD_REMEDIATION_INDUSTRY,
  FIRE_RESTORATION_INDUSTRY,
  DUCT_CLEANING_INDUSTRY,
  TILE_GROUT_CLEANING_INDUSTRY,
  FIRE_PROTECTION_INDUSTRY,
  COMMERCIAL_REFRIGERATION_INDUSTRY,
  RESTAURANT_EQUIPMENT_INDUSTRY,
  PARKING_LOT_INDUSTRY,
  SIGNAGE_WRAPS_INDUSTRY,
  WELDING_FABRICATION_INDUSTRY,
  ELEVATOR_SERVICES_INDUSTRY,
  MOBILE_NOTARY_INDUSTRY,
  PERSONAL_TRAINING_INDUSTRY,
  MASSAGE_THERAPY_INDUSTRY,
  TUTORING_INDUSTRY,
  CATERING_CHEF_INDUSTRY,
  PHOTOGRAPHY_VIDEO_INDUSTRY,
  DRONE_SERVICES_INDUSTRY,
  HOME_STAGING_INDUSTRY,
  COURIER_DELIVERY_INDUSTRY,
  MEDICAL_TRANSPORT_INDUSTRY,
  LIMO_SHUTTLE_INDUSTRY,
  HOTSHOT_TRUCKING_INDUSTRY,
  RV_BOAT_SERVICE_INDUSTRY,
  EVENT_RENTALS_INDUSTRY,
  DJ_ENTERTAINMENT_INDUSTRY,
  BOUNCE_HOUSE_INDUSTRY,
  FOOD_TRUCK_INDUSTRY,
  IT_COMPUTER_REPAIR_INDUSTRY,
  AUTO_BODY_INDUSTRY,
  // Fourth-wave industries
  HOTEL_LODGING_INDUSTRY,
  RESTAURANTS_BARS_INDUSTRY,
  TOURISM_TRAVEL_INDUSTRY,
  EVENT_PLANNING_INDUSTRY,
  RECREATION_ENTERTAINMENT_INDUSTRY,
  ARTS_CULTURE_INDUSTRY,
  LEGAL_SERVICES_INDUSTRY,
  FINANCIAL_PROFESSIONALS_INDUSTRY,
  BUSINESS_CONSULTING_INDUSTRY,
  MARKETING_ADVERTISING_INDUSTRY,
  IT_SERVICES_INDUSTRY,
  ARCHITECTURE_ENGINEERING_INDUSTRY,
  RESEARCH_SERVICES_INDUSTRY,
  BEAUTY_SALON_INDUSTRY,
  SPA_WELLNESS_INDUSTRY,
  FITNESS_STUDIO_INDUSTRY,
  LIFE_SERVICES_INDUSTRY,
  LAUNDRY_SERVICES_INDUSTRY,
  MEDICAL_CLINIC_INDUSTRY,
  THERAPY_REHAB_INDUSTRY,
  SENIOR_CARE_INDUSTRY,
  EDUCATION_FORMAL_INDUSTRY,
  ENRICHMENT_EDUCATION_INDUSTRY,
  BANKING_LENDING_INDUSTRY,
  INVESTMENT_SERVICES_INDUSTRY,
  INSURANCE_SERVICES_INDUSTRY,
  REAL_ESTATE_SERVICES_INDUSTRY,
  PASSENGER_TRANSPORT_INDUSTRY,
  FREIGHT_LOGISTICS_INDUSTRY,
  WASTE_MANAGEMENT_INDUSTRY,
]

export const ALL_SERVICES = INDUSTRIES.flatMap((i) => i.services)

export const INDUSTRY_BY_SLUG = Object.fromEntries(
  INDUSTRIES.map((i) => [i.slug, i])
) as Record<(typeof INDUSTRIES)[number]['slug'], IndustryDef>
