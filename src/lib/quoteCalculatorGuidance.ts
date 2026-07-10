import { resolveIndustrySlug, getIndustry, getEngagementModel, isLowConfidenceResolution } from '@/lib/catalog/serviceCatalog'
import type { IndustrySlug } from '@/lib/catalog/types'

export type SuggestedPricingModel = 'linear_ft' | 'fixed' | 'base_plus_distance'

export type BaseQuoteCalculatorGuidance = {
  tradeLabel: string
  recommendedPricingModel: SuggestedPricingModel
  recommendationReason: string
  /** The specific facts/measurements the quote calculator should capture for
   *  this trade to produce an accurate, "quotable" price. */
  quoteVariables: string[]
  serviceExamples: string[]
  pricingExamples: string[]
  tierExamples: string[]
  addOnExamples: string[]
  finishExamples: string[]
  calculatorNotesPrompt: string
  calculatorNotesExample: string
}

export type QuoteCalculatorGuidance = BaseQuoteCalculatorGuidance & {
  engagementModel: 'quote' | 'order' | 'booking' | 'ticket'
  terminology: {
    pricingSectionTitle: string
    pricingFixedLabel: string
    pricingFixedSub: string
    pricingLinearLabel: string
    pricingLinearSub: string
    tiersLabel: string
    seedLabel: string
    seedSub: string
  }
}

type GuidancePreset = BaseQuoteCalculatorGuidance & {
  /**
   * Resolved via resolveIndustrySlug() rather than matched against raw text
   * (see the removed `match: RegExp` field) — a bare regex like /clean/i
   * matched "Emergency Storm CLEANup" for a tree-service business, silently
   * overriding the correct, more specific catalog guidance. Reusing the same
   * scored/deduped catalog resolution everywhere avoids that whole class of
   * substring-collision bug.
   */
  industrySlug: IndustrySlug
}

const PRESETS: GuidancePreset[] = [
  {
    industrySlug: 'plumbing',
    tradeLabel: 'plumbing',
    recommendedPricingModel: 'fixed',
    recommendationReason: 'Most plumbing quotes are sold per visit, repair, or install instead of by measured quantity.',
    quoteVariables: ['job type (repair vs. install)', 'fixture or unit count', 'tank vs. tankless (water heaters)', 'after-hours/emergency timing'],
    serviceExamples: ['Drain cleaning', 'Water heater install', 'Leak detection & repair'],
    pricingExamples: ['$249-$399 for drain cleaning', '$1,800-$3,500 for water heater replacement', '$325+ for leak diagnostics'],
    tierExamples: ['Good', 'Better', 'Best'],
    addOnExamples: ['After-hours service', 'Old unit haul-away', 'Expansion tank upgrade'],
    finishExamples: ['Standard install', 'Premium fixture package', 'Tankless upgrade'],
    calculatorNotesPrompt: 'What should make this quote go up or down?',
    calculatorNotesExample: 'Example: Drain cleaning is a flat service call. Water heater installs should price as tank vs tankless, plus optional code upgrades and haul-away.',
  },
  {
    industrySlug: 'hvac',
    tradeLabel: 'HVAC',
    recommendedPricingModel: 'fixed',
    recommendationReason: 'HVAC jobs are usually quoted per service call, repair, or system install rather than by slider-based quantity.',
    quoteVariables: ['home square footage / system tonnage', 'repair vs. full system replacement', 'equipment efficiency tier (SEER)', 'ductwork condition'],
    serviceExamples: ['AC repair', 'Furnace replacement', 'Duct cleaning & sealing'],
    pricingExamples: ['$129 diagnostic visit', '$6,500+ for full system replacement', '$900+ for duct cleaning'],
    tierExamples: ['Repair', 'Replace', 'High-efficiency'],
    addOnExamples: ['Thermostat upgrade', 'Indoor air quality kit', 'Extended labor warranty'],
    finishExamples: ['Builder-grade equipment', 'Mid-efficiency system', 'Premium high-SEER system'],
    calculatorNotesPrompt: 'Which service details should affect the quote?',
    calculatorNotesExample: 'Example: AC replacements should be quoted as complete system packages, while maintenance plans stay flat per visit or per season.',
  },
  {
    industrySlug: 'towing',
    tradeLabel: 'towing / roadside',
    recommendedPricingModel: 'base_plus_distance',
    recommendationReason: 'Towing commonly uses a base hookup fee plus mileage or distance.',
    quoteVariables: ['distance to be towed', 'vehicle type/weight', 'service type (tow, jump, lockout, winch)', 'time of day (after-hours)'],
    serviceExamples: ['Light-duty tow', 'Jump start', 'Winch-out'],
    pricingExamples: ['$95 hookup + $4 per mile', '$85 jump start', '$150+ for winch-out recovery'],
    tierExamples: ['Local', 'Extended', 'Recovery'],
    addOnExamples: ['After-hours dispatch', 'Second vehicle stop', 'Priority arrival'],
    finishExamples: ['Standard roadside', 'Long-distance tow', 'Heavy recovery'],
    calculatorNotesPrompt: 'How should distance or difficulty affect price?',
    calculatorNotesExample: 'Example: Tows should include a base dispatch fee plus mileage, while jump starts and lockouts stay flat-rate services.',
  },
  {
    industrySlug: 'landscaping',
    tradeLabel: 'landscaping',
    recommendedPricingModel: 'linear_ft',
    recommendationReason: 'Landscaping often scales by area, linear footage, or property size.',
    quoteVariables: ['yard/bed square footage', 'material type (sod, mulch, pavers)', 'property size band', 'recurring vs. one-time service'],
    serviceExamples: ['Sod installation', 'Mulch refresh', 'Patio build'],
    pricingExamples: ['$2-$5 per sq ft for sod', '$85+ per cubic yard of mulch', '$18+ per sq ft for patios'],
    tierExamples: ['Refresh', 'Upgrade', 'Full transformation'],
    addOnExamples: ['Seasonal cleanup', 'Landscape lighting', 'Irrigation tune-up'],
    finishExamples: ['Basic materials', 'Premium pavers', 'Designer planting package'],
    calculatorNotesPrompt: 'What size or scope measurement should the calculator use?',
    calculatorNotesExample: 'Example: Sod and patios should scale by area, while recurring lawn care can stay flat per visit for a standard property band.',
  },
  {
    industrySlug: 'cleaning',
    tradeLabel: 'cleaning',
    recommendedPricingModel: 'linear_ft',
    recommendationReason: 'Cleaning often scales by rooms, square footage, or visit frequency.',
    quoteVariables: ['home square footage / room count', 'clean type (standard, deep, move-out)', 'frequency (one-time vs. recurring)', 'pets/add-on areas'],
    serviceExamples: ['Standard home cleaning', 'Deep clean', 'Move-out clean'],
    pricingExamples: ['$149+ for small homes', '$0.12-$0.25 per sq ft for deep cleaning', '$75+ for add-on interior appliances'],
    tierExamples: ['Basic clean', 'Deep clean', 'Move-out'],
    addOnExamples: ['Inside fridge', 'Inside oven', 'Same-day service'],
    finishExamples: ['Standard package', 'Premium detail package', 'Recurring discount plan'],
    calculatorNotesPrompt: 'What makes a cleaning quote larger or smaller?',
    calculatorNotesExample: 'Example: Base pricing should change by number of rooms or sq ft, with add-ons for appliances, windows, or same-day scheduling.',
  },
  {
    industrySlug: 'custom-closets',
    tradeLabel: 'custom storage',
    recommendedPricingModel: 'linear_ft',
    recommendationReason: 'Storage and millwork quotes usually scale by measured size plus material tier.',
    quoteVariables: ['linear footage of cabinetry', 'room type (closet, pantry, garage)', 'material/finish tier', 'accessory count (drawers, lighting)'],
    serviceExamples: ['Walk-in closets', 'Garage storage', 'Pantry systems'],
    pricingExamples: ['$45-$120 per linear ft depending on finish tier', '$800+ for wall bed upgrades', '$250+ for drawers and specialty hardware'],
    tierExamples: ['Basic', 'Standard', 'Premium'],
    addOnExamples: ['LED lighting', 'Soft-close drawers', 'Valet rod'],
    finishExamples: ['White melamine', 'Textured wood', 'Custom paint'],
    calculatorNotesPrompt: 'Which upgrades or room types should the quote calculator distinguish?',
    calculatorNotesExample: 'Example: Pantry pricing should use lower per-foot rates than dressing rooms, while drawers, hampers, and lighting act as add-ons.',
  },
]

const GENERIC_GUIDANCE: BaseQuoteCalculatorGuidance = {
  tradeLabel: 'service business',
  recommendedPricingModel: 'fixed',
  recommendationReason: 'If you mostly sell projects or service calls, a flat job quote is usually the safest starting point.',
  quoteVariables: ['project size or scope', 'material or service tier', 'urgency or access difficulty'],
  serviceExamples: ['Primary service', 'Higher-ticket service', 'Emergency or specialty service'],
  pricingExamples: ['$199 diagnostic visit', '$1,500+ replacement project', '$75+ emergency surcharge'],
  tierExamples: ['Standard', 'Premium', 'Signature'],
  addOnExamples: ['Rush service', 'Extended warranty', 'Premium materials'],
  finishExamples: ['Entry package', 'Mid-tier package', 'Top-tier package'],
  calculatorNotesPrompt: 'What should the quote calculator ask so the estimate feels realistic?',
  calculatorNotesExample: 'Example: Customers choose the exact service first, then optional upgrades, urgency, or material tier. The price should feel like how your team quotes jobs today.',
}

/** Compact builder for the ~75 industries not covered by the hand-tuned
 *  PRESETS above. `serviceExamples` is intentionally left empty here — it's
 *  filled in at lookup time straight from the industry's real service
 *  catalog (see inferQuoteCalculatorGuidance), so this table only needs to
 *  hold the parts that catalog can't derive automatically. */
function qp(
  tradeLabel: string,
  recommendedPricingModel: SuggestedPricingModel,
  recommendationReason: string,
  quoteVariables: string[],
  pricingExamples: string[],
  addOnExamples: string[],
  finishExamples: string[] = ['Standard package', 'Upgraded package', 'Premium package'],
  tierExamples: string[] = ['Good', 'Better', 'Best']
): BaseQuoteCalculatorGuidance {
  return {
    tradeLabel,
    recommendedPricingModel,
    recommendationReason,
    quoteVariables,
    serviceExamples: [],
    pricingExamples,
    tierExamples,
    addOnExamples,
    finishExamples,
    calculatorNotesPrompt: `What details make a ${tradeLabel} quote go up or down?`,
    calculatorNotesExample: `Example: Price should mainly scale with ${quoteVariables.slice(0, 2).join(' and ')}${quoteVariables[2] ? `, plus ${quoteVariables[2]}` : ''}.`,
  }
}

/** Industry-specific quoting guidance for every industry in the full
 *  catalog (`src/lib/catalog/industries`) that isn't already covered by the
 *  hand-tuned PRESETS above (plumbing/hvac/towing/landscaping/cleaning/
 *  custom-closets). This is what lets the calculator recognize, e.g., that
 *  roofing needs square footage + stories + pitch instead of falling back
 *  to a generic "service business" recommendation. */
const INDUSTRY_PROFILES: Partial<Record<IndustrySlug, BaseQuoteCalculatorGuidance>> = {
  roofing: qp(
    'roofing',
    'linear_ft',
    'Roofing is typically priced per square (100 sq ft) of roof area, adjusted for pitch, stories, and material.',
    ['roof square footage (in "squares")', 'number of stories', 'roof pitch/steepness', 'roofing material (shingle, metal, flat/TPO)', 'layers of old roofing to remove'],
    ['$350-$550 per square for asphalt shingle', '$800+ per square for metal roofing', '$150+ per square for tear-off & haul-away'],
    ['Skylight flashing', 'Extra layer tear-off', 'Gutter replacement bundle'],
    ['3-tab shingle', 'Architectural shingle', 'Standing-seam metal']
  ),
  electrical: qp(
    'electrical',
    'fixed',
    'Electrical work is usually quoted per job or per fixture/circuit rather than by measured area.',
    ['panel amperage / service size', 'number of circuits or fixtures', 'age of home / existing wiring', 'permit requirements'],
    ['$150-$300 service call', '$1,800+ panel upgrade', '$200+ per added circuit'],
    ['Permit & inspection', 'Surge protector', 'EV charger install']
  ),
  'pest-control': qp(
    'pest control',
    'fixed',
    'Pest control is typically sold as a flat treatment or recurring plan priced by home size and pest type.',
    ['home square footage', 'pest type / infestation severity', 'treatment frequency (one-time vs. recurring)', 'residential vs. commercial'],
    ['$100-$300 one-time treatment', '$40-$60/mo recurring plan', '$400+ termite treatment'],
    ['Termite bond', 'Rodent exclusion', 'Mosquito yard treatment']
  ),
  'pressure-washing': qp(
    'pressure washing',
    'linear_ft',
    'Pressure washing scales by measured surface area and surface type.',
    ['square footage of surface', 'surface type (driveway, siding, roof, deck)', 'number of stories', 'level of grime/staining'],
    ['$0.15-$0.35 per sq ft driveway/concrete', '$250+ house wash', '$0.25+ per sq ft roof soft-wash'],
    ['Sealant application', 'Gutter brightening', 'Rust/stain treatment']
  ),
  'tree-service': qp(
    'tree service',
    'fixed',
    'Tree work is usually quoted per tree based on size and access difficulty, not by measured area.',
    ['tree height / trunk diameter', 'number of trees', 'proximity to structures/power lines', 'stump grinding needed'],
    ['$300-$1,200 per tree removal', '$150+ trimming per tree', '$100-$300 stump grinding'],
    ['Stump grinding', 'Debris haul-away', 'Emergency/storm response']
  ),
  painting: qp(
    'painting',
    'linear_ft',
    'Painting is typically priced per square footage or per room, adjusted for prep and coats.',
    ['square footage / number of rooms', 'interior vs. exterior', 'number of coats', 'surface prep needed (drywall repair, pressure washing)'],
    ['$2-$4 per sq ft interior', '$2.50-$5 per sq ft exterior', '$300+ per room'],
    ['Drywall repair', 'Cabinet painting', 'Accent wall / faux finish']
  ),
  handyman: qp(
    'handyman',
    'fixed',
    'Handyman work is usually billed hourly or per task rather than by measured area.',
    ['task type / list of jobs', 'estimated hours', 'who supplies materials', 'number of separate tasks in one visit'],
    ['$75-$125/hr', '$150+ minimum service call', '$50+ per small task bundled'],
    ['Same-day service', 'Multi-task bundle discount', 'Materials run/pickup']
  ),
  flooring: qp(
    'flooring',
    'linear_ft',
    'Flooring is priced per square foot of material and installation, adjusted for material type and prep.',
    ['square footage', 'flooring material (hardwood, tile, LVP, carpet)', 'subfloor condition / old floor removal', 'room layout complexity'],
    ['$3-$8 per sq ft LVP install', '$6-$14 per sq ft hardwood', '$2+ per sq ft old floor removal'],
    ['Old floor removal & haul-away', 'Subfloor repair', 'Furniture moving']
  ),
  carpentry: qp(
    'carpentry',
    'linear_ft',
    'Carpentry commonly scales by linear footage or project size, plus material grade.',
    ['project type (built-in, trim, framing, repair)', 'linear footage or square footage', 'wood/material grade', 'custom design complexity'],
    ['$25-$75 per linear ft trim/molding', '$1,500+ built-ins', '$500+ custom shelving'],
    ['Custom stain/finish', 'Hardware upgrade', 'Design consultation']
  ),
  'appliance-repair': qp(
    'appliance repair',
    'fixed',
    'Appliance repair is quoted per service call plus parts, not by area.',
    ['appliance type', 'brand/model', 'age of appliance', 'in-home repair vs. part replacement'],
    ['$89-$129 diagnostic visit', '$150-$400 repair + parts', '$75+ trip fee'],
    ['Extended warranty', 'Same-day service', 'Parts expedite fee']
  ),
  locksmith: qp(
    'locksmith',
    'fixed',
    'Locksmith work is priced per service or per lock rather than by area.',
    ['service type (lockout, rekey, install)', 'number of locks/doors', 'lock type (standard, smart, commercial)', 'time of day (after-hours)'],
    ['$75-$150 lockout service', '$40-$80 per lock rekey', '$150+ smart lock install'],
    ['After-hours emergency fee', 'Smart lock upgrade', 'Master key system']
  ),
  moving: qp(
    'moving',
    'base_plus_distance',
    'Moving is typically priced by crew size/hours plus distance for long-distance moves.',
    ['home size (bedrooms) or item count', 'distance of move', 'number of movers/trucks needed', 'stairs/elevator access'],
    ['$100-$150/hr for 2 movers + truck', '$1,500+ long-distance move', '$300+ packing service'],
    ['Packing/unpacking service', 'Furniture disassembly', 'Storage in transit']
  ),
  'mobile-auto': qp(
    'mobile auto services',
    'base_plus_distance',
    'Mobile auto services often add a trip/travel fee on top of the service price.',
    ['vehicle make/model/year', 'service type (repair, detailing, tint)', 'on-site travel distance', 'parts availability'],
    ['$80-$150 mobile service call', '$150+ parts & labor', '$50 travel fee outside service area'],
    ['Travel fee waived in-zone', 'Parts delivery rush', 'Fleet/multi-vehicle discount']
  ),
  'junk-removal': qp(
    'junk removal',
    'fixed',
    'Junk removal is usually priced by truckload volume, not measured area.',
    ['volume (truckload fraction)', 'item type (furniture, appliances, construction debris)', 'access (stairs, distance to truck)', 'disposal/recycling fees'],
    ['$99-$250 quarter to half load', '$400-$600 full load', '$75+ single large item'],
    ['Same-day pickup', 'Heavy item surcharge', 'Donation/recycling sort']
  ),
  'concrete-masonry': qp(
    'concrete & masonry',
    'linear_ft',
    'Concrete and masonry work scales by measured area or linear footage, plus finish and prep.',
    ['square footage or linear footage', 'slab thickness / reinforcement', 'finish type (stamped, stained, broom)', 'demo of existing concrete needed'],
    ['$6-$12 per sq ft standard slab', '$10-$18 per sq ft stamped/decorative', '$3+ per sq ft demo/removal'],
    ['Decorative stamping/staining', 'Rebar reinforcement', 'Old concrete removal']
  ),
  'pool-spa': qp(
    'pool & spa services',
    'fixed',
    'Pool and spa services are usually quoted per visit or per project, not measured area.',
    ['pool size/gallons', 'service type (cleaning, repair, install)', 'equipment type (pump, heater, liner)', 'in-ground vs. above-ground'],
    ['$100-$180/mo weekly service', '$300-$800 equipment repair', '$3,500+ liner replacement'],
    ['Opening/closing service', 'Chemical balancing plan', 'Equipment upgrade']
  ),
  'garage-door': qp(
    'garage door services',
    'fixed',
    'Garage door work is priced per door/service call rather than by area.',
    ['door size (single/double)', 'material (steel, wood, insulated)', 'service type (repair, spring replace, full install)', 'opener/smart features'],
    ['$150-$350 spring replacement', '$800-$2,500 full door install', '$99 service call'],
    ['Smart opener upgrade', 'Insulated panel upgrade', 'Same-day emergency repair']
  ),
  gutters: qp(
    'gutter services',
    'linear_ft',
    'Gutter installation and repair scale by linear footage and building height.',
    ['linear footage of gutters', 'number of stories', 'gutter type (K-style, half-round, seamless)', 'gutter guard add-on'],
    ['$6-$12 per linear ft install', '$150+ repair visit', '$4-$9 per linear ft gutter guards'],
    ['Gutter guards/leaf protection', 'Downspout extensions', 'Cleaning add-on']
  ),
  'chimney-fireplace': qp(
    'chimney & fireplace services',
    'fixed',
    'Chimney and fireplace services are priced per service call, adjusted for height and complexity.',
    ['chimney height / stories', 'service type (sweep, repair, liner, cap)', 'fireplace type (wood, gas, insert)', 'inspection level needed'],
    ['$150-$300 chimney sweep', '$500+ liner repair', '$250+ cap/crown repair'],
    ['Level 2 video inspection', 'Damper repair', 'Cap/screen install']
  ),
  'home-inspection': qp(
    'home inspection',
    'linear_ft',
    'Home inspections are commonly priced by home square footage and inspection scope.',
    ['home square footage', 'home age', 'inspection type (standard, radon, mold, pool)', 'number of stories/outbuildings'],
    ['$300-$500 standard home', '$100+ radon add-on', '$75+ per outbuilding'],
    ['Radon testing', 'Mold/air quality testing', 'Pool/spa inspection']
  ),
  'security-systems': qp(
    'security systems',
    'fixed',
    'Security system installs are priced per device/zone plus an optional monitoring plan.',
    ['number of doors/windows/cameras', 'monitoring plan (self vs. professional)', 'new install vs. existing system', 'smart home integration'],
    ['$99-$299 install per system', '$20-$60/mo monitoring', '$100+ per added camera'],
    ['Professional monitoring plan', 'Smart lock integration', 'Extra camera zones']
  ),
  irrigation: qp(
    'irrigation & sprinklers',
    'linear_ft',
    'Irrigation systems scale by yard size and number of zones.',
    ['yard/lawn square footage', 'number of zones', 'new install vs. repair', 'smart controller upgrade'],
    ['$0.50-$1 per sq ft new system', '$100-$250 repair visit', '$150+ per added zone'],
    ['Smart Wi-Fi controller', 'Drip line for beds', 'Spring start-up / winterization']
  ),
  solar: qp(
    'solar & clean energy',
    'fixed',
    'Solar is quoted as a system project sized to energy usage and roof space, not a flat per-job rate.',
    ['roof square footage / usable area', 'average energy usage (kWh)', 'roof type/pitch', 'battery storage add-on'],
    ['$15,000-$30,000 typical residential system', '$8,000-$15,000 battery storage add-on', '$100+ per panel add-on'],
    ['Battery storage', 'EV charger integration', 'Roof reinforcement']
  ),
  'pet-services': qp(
    'pet services',
    'fixed',
    'Pet services are priced per pet/session rather than by area.',
    ['pet size/breed', 'service type (grooming, boarding, walking, training)', 'session length/frequency', 'number of pets'],
    ['$40-$90 grooming session', '$20-$35 per dog walk', '$45-$75/night boarding'],
    ['Nail trim add-on', 'Multi-pet discount', 'Pickup/drop-off service']
  ),
  'windows-doors': qp(
    'windows & doors',
    'fixed',
    'Windows and doors are quoted per unit installed, not by measured area.',
    ['number of windows/doors', 'material (vinyl, wood, fiberglass)', 'size/custom dimensions', 'energy-efficiency / glass upgrade'],
    ['$400-$900 per window installed', '$800-$2,000 per exterior door', '$150+ per storm door'],
    ['Energy-efficient glass upgrade', 'Custom trim/casing', 'Old unit haul-away']
  ),
  insulation: qp(
    'insulation services',
    'linear_ft',
    'Insulation is priced by square footage and material/method.',
    ['square footage', 'area (attic, walls, crawlspace)', 'insulation type (blown-in, spray foam, batt)', 'existing insulation removal'],
    ['$1-$1.50 per sq ft blown-in attic', '$3-$7 per sq ft spray foam', '$1+ per sq ft old insulation removal'],
    ['Air sealing', 'Old insulation removal', 'Attic hatch/door insulation']
  ),
  drywall: qp(
    'drywall services',
    'linear_ft',
    'Drywall work scales by square footage, with flat rates for small patch repairs.',
    ['square footage', 'new install vs. repair/patch', 'texture type', 'ceiling vs. wall'],
    ['$1.50-$3 per sq ft new install', '$150-$400 small patch repair', '$1-$2 per sq ft texture match'],
    ['Texture matching', 'Popcorn ceiling removal', 'Paint after repair']
  ),
  waterproofing: qp(
    'waterproofing',
    'linear_ft',
    'Waterproofing is priced by linear footage of foundation treated plus method.',
    ['linear footage of foundation', 'severity of water intrusion', 'interior vs. exterior waterproofing', 'sump pump needed'],
    ['$50-$150 per linear ft interior system', '$3,000+ exterior excavation waterproofing', '$1,000+ sump pump install'],
    ['Sump pump install/backup', 'French drain', 'Dehumidifier system']
  ),
  'foundation-repair': qp(
    'foundation repair',
    'fixed',
    'Foundation repair is priced per pier/point rather than by area.',
    ['number of piers/points needed', 'foundation type (slab, crawlspace, basement)', 'severity of settlement/cracking', 'soil conditions'],
    ['$300-$600 per pier', '$3,000-$10,000+ typical project', '$500+ crack injection repair'],
    ['Drainage correction', 'Crawlspace encapsulation', 'Warranty/transferability']
  ),
  siding: qp(
    'siding installation & repair',
    'linear_ft',
    'Siding is priced per square foot of exterior wall area, adjusted for material and prep.',
    ['square footage of exterior walls', 'siding material (vinyl, fiber cement, wood)', 'old siding removal needed', 'number of stories'],
    ['$4-$9 per sq ft vinyl siding', '$8-$14 per sq ft fiber cement', '$1+ per sq ft old siding removal'],
    ['Old siding removal & haul-away', 'Trim/soffit replacement', 'Insulated house wrap upgrade']
  ),
  fencing: qp(
    'fencing',
    'linear_ft',
    'Fencing is priced per linear foot, adjusted for material and height.',
    ['linear footage of fence', 'material (wood, vinyl, chain-link, aluminum)', 'height', 'number of gates needed'],
    ['$20-$45 per linear ft wood', '$25-$50 per linear ft vinyl', '$300+ per gate'],
    ['Gate & hardware upgrade', 'Old fence removal', 'Staining/sealing']
  ),
  'snow-removal': qp(
    'snow removal',
    'fixed',
    'Snow removal is typically sold as a flat per-visit fee or seasonal contract by property size.',
    ['driveway/lot square footage', 'per-visit vs. seasonal contract', 'snowfall depth trigger', 'salting/de-icing add-on'],
    ['$45-$90 per visit residential', '$400-$900 seasonal contract', '$50+ commercial lot per visit'],
    ['Salt/de-icing application', 'Sidewalk/walkway clearing', 'Priority/on-call service']
  ),
  'generator-services': qp(
    'generator services',
    'fixed',
    'Generator installs are priced as a project based on system size, not measured area.',
    ['generator size (kW)', 'whole-home vs. portable', 'fuel type (propane, natural gas, diesel)', 'transfer switch install needed'],
    ['$3,000-$6,000 standby generator install', '$150+ maintenance visit', '$500+ transfer switch install'],
    ['Annual maintenance plan', 'Extended warranty', 'Remote monitoring']
  ),
  countertops: qp(
    'countertop installation',
    'linear_ft',
    'Countertops are priced per square foot of material and fabrication.',
    ['square footage', 'material (granite, quartz, laminate, butcher block)', 'edge profile', 'old countertop removal needed'],
    ['$40-$100 per sq ft quartz', '$50-$120 per sq ft granite', '$20-$40 per sq ft laminate'],
    ['Undermount sink cutout', 'Custom edge profile', 'Old countertop removal']
  ),
  'cabinet-painting': qp(
    'cabinet painting & refacing',
    'fixed',
    'Cabinet painting/refacing is quoted per door/drawer count or per kitchen, not measured area.',
    ['number of cabinet doors/drawers', 'kitchen size', 'paint vs. refacing', 'hardware replacement'],
    ['$100-$200 per door painted', '$3,500-$7,000 full kitchen', '$5-$15 per hardware swap'],
    ['Hardware upgrade', 'Interior cabinet painting', 'Soft-close hinge upgrade']
  ),
  'bathroom-remodel': qp(
    'bathroom remodeling',
    'fixed',
    'Bathroom remodels are quoted as a project based on scope and finish level, not per square foot alone.',
    ['bathroom square footage', 'scope (refresh vs. full gut)', 'fixture count', 'tile/material selections'],
    ['$8,000-$15,000 mid-range remodel', '$20,000+ full gut remodel', '$3,000+ shower/tub conversion'],
    ['Walk-in shower conversion', 'Heated flooring', 'Double vanity upgrade']
  ),
  'kitchen-remodel': qp(
    'kitchen remodeling',
    'fixed',
    'Kitchen remodels are quoted as a project scaled by scope and finish level.',
    ['kitchen square footage', 'scope (cabinet refresh vs. full gut)', 'appliance package', 'layout changes (moving plumbing/electrical)'],
    ['$15,000-$30,000 mid-range remodel', '$40,000+ full gut remodel', '$5,000+ cabinet refacing only'],
    ['Island addition', 'Appliance package upgrade', 'Layout/plumbing changes']
  ),
  'epoxy-flooring': qp(
    'epoxy flooring',
    'linear_ft',
    'Epoxy flooring is priced per square foot of coated surface.',
    ['square footage', 'surface condition (cracks, oil stains)', 'coating type (flake, metallic, solid)', 'garage vs. commercial floor'],
    ['$3-$7 per sq ft standard epoxy', '$7-$12 per sq ft metallic/decorative', '$1+ per sq ft crack repair prep'],
    ['Decorative flake upgrade', 'Crack/oil-stain repair prep', 'Anti-slip additive']
  ),
  'outdoor-lighting': qp(
    'outdoor lighting',
    'fixed',
    'Outdoor lighting is priced per fixture installed, not by measured area.',
    ['number of fixtures', 'yard/property size', 'lighting type (path, uplighting, string)', 'smart control/timer add-on'],
    ['$100-$200 per fixture installed', '$1,500-$4,000 full property package', '$150+ smart control add-on'],
    ['Smart app control/timers', 'Seasonal/holiday lighting', 'Transformer upgrade']
  ),
  'deck-maintenance': qp(
    'deck maintenance & staining',
    'linear_ft',
    'Deck maintenance is priced by square footage plus material and service type.',
    ['deck square footage', 'material (wood, composite)', 'service type (staining, sealing, repair)', 'railing/stairs included'],
    ['$2-$4 per sq ft staining/sealing', '$150+ repair visit', '$1+ per sq ft power washing'],
    ['Railing/baluster repair', 'Board replacement', 'Annual maintenance plan']
  ),
  'septic-services': qp(
    'septic services',
    'fixed',
    'Septic services are priced per service visit based on tank size and system type.',
    ['tank size (gallons)', 'service type (pump, inspect, install)', 'system type (conventional, aerobic)', 'last service date'],
    ['$300-$500 tank pumping', '$150-$300 inspection', '$5,000+ new system install'],
    ['Riser/lid upgrade', 'Aerobic system maintenance plan', 'Emergency service']
  ),
  'well-services': qp(
    'water well services',
    'fixed',
    'Well services are priced per service call or project based on depth and pump type.',
    ['well depth', 'service type (repair, new drill, pump replace)', 'water quality/flow issues', 'pump type'],
    ['$150-$300 service call', '$1,500+ pump replacement', '$8,000+ new well drilling'],
    ['Pressure tank replacement', 'Water quality testing', 'Emergency/no-water service']
  ),
  'water-treatment': qp(
    'water treatment',
    'fixed',
    'Water treatment systems are quoted per system installed based on water quality and usage.',
    ['household size / water usage', 'water test results (hardness, contaminants)', 'system type (softener, filter, RO)', 'whole-home vs. point-of-use'],
    ['$1,500-$3,000 whole-home softener', '$300-$800 under-sink filter/RO', '$75+ water test'],
    ['Annual filter/salt plan', 'Whole-home upgrade', 'Water quality test']
  ),
  'glass-mirror': qp(
    'glass & mirror installation',
    'fixed',
    'Glass and mirror work is priced per piece/install based on size and glass type.',
    ['size/dimensions of glass', 'glass type (tempered, frameless, decorative)', 'install location (shower, mirror, window)', 'custom cut needed'],
    ['$600-$1,500 frameless shower door', '$100-$300 custom mirror', '$150+ glass tabletop'],
    ['Frameless upgrade', 'Etched/decorative glass', 'Hardware finish upgrade']
  ),
  'blinds-shutters': qp(
    'blinds & window treatments',
    'fixed',
    'Blinds and shutters are priced per window based on size and material.',
    ['number of windows', 'window sizes', 'material (faux wood, real wood, fabric)', 'motorization add-on'],
    ['$100-$300 per window blinds', '$300-$700 per window plantation shutters', '$150+ motorization per window'],
    ['Motorized/smart control', 'Cordless upgrade', 'Custom valance']
  ),
  'mold-remediation': qp(
    'mold remediation',
    'linear_ft',
    'Mold remediation is priced by affected square footage and severity.',
    ['affected square footage', 'mold severity/type', 'source of moisture (leak, humidity)', 'containment/air scrubbing needed'],
    ['$500-$1,500 small area', '$3,000+ large-scale remediation', '$300+ mold testing/inspection'],
    ['Air scrubbing/containment', 'Source moisture repair', 'Post-remediation testing']
  ),
  'fire-restoration': qp(
    'fire & water damage restoration',
    'fixed',
    'Fire/water restoration is quoted per project based on damage extent, not a flat rate.',
    ['affected square footage', 'damage severity (smoke, soot, structural)', 'contents cleaning needed', 'insurance claim involved'],
    ['$3,000-$10,000+ typical project', '$500+ initial mitigation/board-up', '$1,000+ contents cleaning'],
    ['Contents pack-out & cleaning', 'Odor/smoke treatment', 'Insurance documentation support']
  ),
  'duct-cleaning': qp(
    'air duct cleaning',
    'fixed',
    'Duct cleaning is typically priced per system/home size rather than per linear foot.',
    ['number of vents/returns', 'home square footage', 'HVAC system count', 'dryer vent included'],
    ['$300-$500 whole-home duct cleaning', '$100+ dryer vent cleaning', '$150+ per added HVAC system'],
    ['Dryer vent cleaning', 'Sanitizing treatment', 'UV light install']
  ),
  'tile-grout-cleaning': qp(
    'tile & grout cleaning',
    'linear_ft',
    'Tile and grout cleaning is priced per square foot of tiled surface.',
    ['square footage of tile', 'grout condition/staining', 'sealing needed', 'floor vs. wall/shower tile'],
    ['$0.75-$1.50 per sq ft cleaning', '$0.50+ per sq ft sealing', '$150+ shower/tub tile detail'],
    ['Grout sealing', 'Grout color sealing/recoloring', 'Shower/tub deep clean']
  ),
  'fire-protection': qp(
    'fire protection services',
    'fixed',
    'Fire protection systems are priced per system/inspection based on building size and code requirements.',
    ['building square footage', 'system type (sprinkler, alarm, extinguisher)', 'inspection vs. install', 'code/compliance requirements'],
    ['$150-$300 annual inspection', '$3,000+ sprinkler system install', '$50+ per extinguisher service'],
    ['Monitoring service', 'Code compliance report', 'Extinguisher recharge/tagging']
  ),
  'commercial-refrigeration': qp(
    'commercial refrigeration',
    'fixed',
    'Commercial refrigeration is priced per unit/service call, not by area.',
    ['unit type (walk-in, reach-in, ice machine)', 'service type (repair, install, maintenance)', 'refrigerant type', 'business downtime urgency'],
    ['$150-$300 service call', '$500-$2,000 repair + parts', '$3,000+ new unit install'],
    ['Preventive maintenance plan', 'After-hours emergency service', 'Refrigerant recharge']
  ),
  'restaurant-equipment': qp(
    'restaurant equipment repair',
    'fixed',
    'Restaurant equipment service is priced per unit/service call.',
    ['equipment type (oven, fryer, dishwasher)', 'service type (repair, install, maintenance)', 'commercial vs. light commercial', 'downtime urgency'],
    ['$150-$300 service call', '$300-$1,200 repair + parts', '$2,000+ new equipment install'],
    ['Preventive maintenance plan', 'After-hours emergency service', 'Multi-unit discount']
  ),
  'parking-lot': qp(
    'parking lot services',
    'linear_ft',
    'Parking lot services scale by square footage, with per-stall pricing for striping.',
    ['lot square footage', 'service type (striping, sealcoating, repair)', 'number of stalls/spaces', 'ADA compliance requirements'],
    ['$0.15-$0.25 per sq ft sealcoating', '$5-$15 per stall striping', '$3+ per sq ft asphalt repair'],
    ['ADA-compliant striping', 'Crack filling', 'Wheel stops/signage']
  ),
  'signage-wraps': qp(
    'signage & vehicle wraps',
    'fixed',
    'Signage and wraps are priced per project based on size and material.',
    ['size of sign/vehicle', 'material (vinyl, channel letters, wrap)', 'design complexity', 'install location (indoor, outdoor, vehicle)'],
    ['$1,500-$3,500 full vehicle wrap', '$200-$600 per storefront sign', '$5-$10 per sq ft banner/vinyl'],
    ['Design/mockup service', 'Illuminated sign upgrade', 'Multi-vehicle fleet discount']
  ),
  'welding-fabrication': qp(
    'welding & metal fabrication',
    'fixed',
    'Welding and fabrication is priced per project based on material and complexity.',
    ['material type (steel, aluminum, stainless)', 'project scope (repair vs. custom fabrication)', 'size/weight of piece', 'on-site vs. shop work'],
    ['$75-$125/hr labor', '$150+ minimum repair visit', '$500+ custom fabrication project'],
    ['On-site/mobile welding fee', 'Custom design/prototyping', 'Powder coat finish']
  ),
  'elevator-services': qp(
    'elevator services',
    'fixed',
    'Elevator services are priced per unit and contract type, not by area.',
    ['number of elevators', 'service type (maintenance, repair, install)', 'residential vs. commercial building', 'code/inspection requirements'],
    ['$150-$400/mo maintenance contract', '$500-$3,000 repair', '$20,000+ new install'],
    ['24/7 emergency callback plan', 'Modernization package', 'Code compliance inspection']
  ),
  'mobile-notary': qp(
    'mobile notary services',
    'base_plus_distance',
    'Mobile notary work is priced per appointment plus travel distance.',
    ['number of signers/documents', 'travel distance', 'appointment time (business hours vs. after-hours)', 'document type (loan signing, POA, etc.)'],
    ['$75-$150 standard appointment', '$150-$250 loan signing package', '$0.50+ per mile travel fee'],
    ['After-hours/weekend fee', 'Additional signer/document', 'Rush/same-day appointment']
  ),
  'personal-training': qp(
    'personal training',
    'fixed',
    'Personal training is sold per session or package, not by measured area.',
    ['session length', 'number of sessions (single vs. package)', 'in-home, gym, or virtual', 'group vs. 1-on-1'],
    ['$60-$100 per session', '$400+ 10-session package', '$25+ small group discount per person'],
    ['Nutrition coaching add-on', 'In-home travel fee', 'Package/membership discount']
  ),
  'massage-therapy': qp(
    'massage therapy',
    'fixed',
    'Massage therapy is priced per session length and type.',
    ['session length (30/60/90 min)', 'massage type (Swedish, deep tissue, sports)', 'in-studio vs. mobile/in-home', 'package/membership vs. single session'],
    ['$70-$100 60-min session', '$100-$140 90-min session', '$20+ mobile travel fee'],
    ['Hot stone add-on', 'Membership/package discount', 'Couples session upgrade']
  ),
  tutoring: qp(
    'tutoring & test prep',
    'fixed',
    'Tutoring is priced per hour/session based on subject and format.',
    ['subject/grade level', 'session length', 'in-person vs. virtual', 'individual vs. group'],
    ['$40-$80/hr individual', '$25+ per student group session', '$300+ test-prep package'],
    ['Test-prep package', 'Group session discount', 'Progress report add-on']
  ),
  'catering-chef': qp(
    'catering & personal chef',
    'fixed',
    'Catering is priced per guest, adjusted for menu and service style.',
    ['guest count', 'menu type/complexity', 'service style (drop-off vs. plated)', 'staffing needed'],
    ['$25-$45 per guest drop-off', '$60-$100 per guest plated service', '$200+ staffing fee'],
    ['Bartending/staffing add-on', 'Premium menu upgrade', 'Rental equipment (tables/linens)']
  ),
  'photography-video': qp(
    'photography & videography',
    'fixed',
    'Photography/video is priced per session or package based on coverage hours and deliverables.',
    ['event/session type', 'hours of coverage', 'number of photographers/videographers', 'deliverables (prints, album, edited video)'],
    ['$300-$800 portrait session', '$2,000-$4,000 full-day event coverage', '$150+ per added hour'],
    ['Second shooter/videographer', 'Album/print package', 'Rush editing turnaround']
  ),
  'drone-services': qp(
    'drone services',
    'fixed',
    'Drone services are priced per project/session based on scope and deliverables.',
    ['project type (real estate, inspection, event)', 'flight time/area coverage', 'deliverables (photos, video, mapping data)', 'FAA airspace restrictions'],
    ['$150-$300 real estate package', '$300-$800 inspection/mapping project', '$100+ per added flight'],
    ['4K video add-on', 'Rush turnaround', 'Mapping/3D model deliverable']
  ),
  'home-staging': qp(
    'home staging',
    'linear_ft',
    'Home staging is priced by square footage/room count and rental duration.',
    ['home square footage', 'number of rooms staged', 'vacant vs. occupied staging', 'rental furniture duration'],
    ['$300-$600 per room initial staging', '$500+/mo furniture rental', '$150+ consultation only'],
    ['Extended rental month', 'Design consultation only', 'Move-out destage service']
  ),
  'courier-delivery': qp(
    'courier & delivery',
    'base_plus_distance',
    'Courier and delivery services are priced by base fee plus distance and speed.',
    ['distance', 'package size/weight', 'delivery speed (same-day, rush)', 'number of stops'],
    ['$15-$25 base + per-mile', '$10+ rush/same-day surcharge', '$5+ per added stop'],
    ['Same-day rush delivery', 'Signature/proof of delivery', 'Multi-stop route discount']
  ),
  'medical-transport': qp(
    'medical transport (NEMT)',
    'base_plus_distance',
    'Medical transport is priced by base fee plus mileage and mobility level.',
    ['distance', 'mobility level (ambulatory, wheelchair, stretcher)', 'one-way vs. round-trip', 'scheduled vs. urgent'],
    ['$40-$75 base + per-mile', '$25+ wheelchair/stretcher surcharge', '$50+ urgent/same-day surcharge'],
    ['Round-trip discount', 'Wait-and-return service', 'Recurring appointment plan']
  ),
  'limo-shuttle': qp(
    'limousine & shuttle service',
    'base_plus_distance',
    'Limo and shuttle service is priced by hours or distance based on vehicle type.',
    ['vehicle type/passenger count', 'hours booked', 'distance/route', 'event type (wedding, airport, corporate)'],
    ['$75-$150/hr sedan/SUV', '$150-$300/hr limo/party bus', '$100+ flat airport transfer'],
    ['Extra hour add-on', 'Red carpet/champagne service', 'Multi-stop itinerary']
  ),
  'hotshot-trucking': qp(
    'hot shot & freight',
    'base_plus_distance',
    'Hotshot trucking is priced by base rate plus mileage and load specifics.',
    ['distance', 'load weight/dimensions', 'trailer type needed', 'standard vs. expedited timeframe'],
    ['$2-$3.50 per mile', '$150+ base loading fee', '$200+ expedited surcharge'],
    ['Expedited/same-day delivery', 'Multi-stop route', 'Oversize load permit fee']
  ),
  'rv-boat-service': qp(
    'RV & boat services',
    'fixed',
    'RV and boat services are priced per project based on size and service type.',
    ['vehicle type/size', 'service type (detailing, repair, winterization)', 'mobile vs. in-shop', 'storage duration if applicable'],
    ['$150-$400 detailing', '$300+ winterization', '$75+ mobile service travel fee'],
    ['Mobile/on-site service fee', 'Storage add-on', 'Seasonal maintenance plan']
  ),
  'event-rentals': qp(
    'event rentals',
    'fixed',
    'Event rentals are priced per item/package based on guest count and duration.',
    ['guest count', 'item list (tables, tents, linens)', 'event date/duration', 'delivery & setup distance'],
    ['$10-$20 per chair/table setup', '$300-$1,000 tent rental', '$150+ delivery & setup fee'],
    ['Delivery & setup', 'Multi-day rental discount', 'Linens/decor package']
  ),
  'dj-entertainment': qp(
    'DJ & entertainment',
    'fixed',
    'DJ and entertainment services are priced per event based on hours and equipment.',
    ['event type/length', 'guest count', 'equipment needs (lighting, MC, sound)', 'travel distance'],
    ['$500-$1,200 standard event package', '$150+ per added hour', '$200+ lighting/MC add-on'],
    ['Uplighting package', 'MC services', 'Extra hour of coverage']
  ),
  'bounce-house': qp(
    'bounce house & inflatable rentals',
    'fixed',
    'Bounce house and inflatable rentals are priced per unit and rental duration.',
    ['unit size/type', 'rental duration (hours/full day)', 'delivery distance', 'indoor/outdoor & power access'],
    ['$150-$300 per unit per day', '$50+ delivery/setup fee', '$50+ generator rental if no power'],
    ['Generator rental', 'Multi-unit combo discount', 'Extended rental hours']
  ),
  'food-truck': qp(
    'food truck',
    'fixed',
    'Food truck catering is priced per guest/event based on menu and travel.',
    ['guest count', 'menu selection/complexity', 'event length', 'travel distance'],
    ['$15-$25 per guest', '$500+ event minimum', '$1+ per mile travel fee beyond zone'],
    ['Premium menu upgrade', 'Extended service time', 'Staffing add-on']
  ),
  'it-computer-repair': qp(
    'IT support & computer repair',
    'fixed',
    'IT/computer repair is priced per service call or hourly rate, not by area.',
    ['device type (PC, Mac, server, network)', 'issue type (hardware, software, virus, data recovery)', 'on-site vs. remote', 'business vs. residential'],
    ['$75-$125/hr', '$99+ diagnostic fee', '$150+ data recovery'],
    ['On-site travel fee', 'Data backup/recovery', 'Managed IT monthly plan']
  ),
  'auto-body': qp(
    'auto body & collision repair',
    'fixed',
    'Auto body repair is priced per damage assessment, not measured area.',
    ['damage severity/panel count', 'vehicle make/model', 'paint match complexity', 'insurance claim vs. out-of-pocket'],
    ['$300-$800 per panel repair', '$1,500+ paint job', '$500+ frame/alignment work'],
    ['Paintless dent repair', 'Rental car coordination', 'Insurance claim assistance']
  ),
}

function withTerminology(
  slug: IndustrySlug | null,
  base: BaseQuoteCalculatorGuidance,
  engagementOverride?: 'quote' | 'order' | 'booking' | 'ticket' | null
): QuoteCalculatorGuidance {
  const model = engagementOverride || (slug ? getEngagementModel(slug) : 'quote')
  const isOrder = model === 'order'
  const isBooking = model === 'booking'
  const isTicket = model === 'ticket'
  
  return {
    ...base,
    engagementModel: model,
    terminology: {
      pricingSectionTitle: isOrder ? 'Menu items' : isBooking ? 'Services & Sessions' : isTicket ? 'Events & Admission' : 'How do you price your work?',
      pricingFixedLabel: isOrder ? 'Per Item' : isBooking ? 'Per Session' : isTicket ? 'Per Ticket' : 'Flat Per Job',
      pricingFixedSub: isOrder ? 'One flat price per item ordered' : isBooking ? 'One flat price per booking' : isTicket ? 'One flat price per attendee' : 'One flat project price regardless of size',
      pricingLinearLabel: isOrder ? 'By Weight / Volume' : isBooking ? 'Hourly Rate' : isTicket ? 'Group Rate' : 'Per Unit / Size',
      pricingLinearSub: isOrder ? 'Price scales by weight or volume' : isBooking ? 'Price scales by duration' : isTicket ? 'Price scales by group size' : 'Price scales with size — sq ft, linear ft, hours, or units',
      tiersLabel: isOrder ? 'What do you call your item categories?' : isBooking ? 'What do you call your service types?' : isTicket ? 'What do you call your ticket types?' : 'What do you call your tiers?',
      seedLabel: isOrder ? 'Approximate pricing per category' : isBooking ? 'Approximate pricing per service' : isTicket ? 'Approximate pricing per ticket' : 'Approximate pricing per tier',
      seedSub: isOrder ? '($/item — optional)' : isBooking ? '($/session — optional)' : isTicket ? '($/ticket — optional)' : '($/unit or $/job — optional)'
    }
  }
}

export function inferQuoteCalculatorGuidance(input: {
  industry?: string | null
  servicesText?: string | null
  services?: string[] | null
}): QuoteCalculatorGuidance {
  const combined = [
    input.industry || '',
    input.servicesText || '',
    ...(input.services || []),
  ]
    .join(' | ')
    .trim()

  if (!combined) return withTerminology(null, GENERIC_GUIDANCE)

  // Resolve against the FULL industry catalog FIRST via the same scored
  // (and keyword-collision-hardened) matcher used everywhere else in the
  // app, instead of testing hand-tuned regexes against the raw combined
  // text — a bare regex like /clean/i previously matched "Emergency Storm
  // Cleanup" for a tree-service business and silently won before the
  // catalog was ever consulted.
  const payload = {
    industry: input.industry,
    services: input.services,
    other_services: input.servicesText,
  }
  
  if (isLowConfidenceResolution(payload)) {
    return withTerminology(null, GENERIC_GUIDANCE)
  }
  
  const slug = resolveIndustrySlug(payload)

  const preset = PRESETS.find((entry) => entry.industrySlug === slug)
  if (preset) {
    const { industrySlug: _industrySlug, ...guidance } = preset
    return withTerminology(slug, guidance)
  }

  const profile = INDUSTRY_PROFILES[slug]
  if (!profile) return withTerminology(slug, GENERIC_GUIDANCE)

  const industry = getIndustry(slug)
  const serviceExamples = industry.services.slice(0, 3).map((s) => s.label)
  return withTerminology(slug, {
    ...profile,
    serviceExamples: serviceExamples.length > 0 ? serviceExamples : profile.serviceExamples,
  })
}

/**
 * Build calculator/services guidance for a contractor-contributed custom
 * industry (not in the static catalog). Used when the intake form selects
 * or resolves a custom_industries row so we never fall back to closets.
 */
export function guidanceFromCustomIndustry(input: {
  label: string
  services?: string[] | null
  engagementModel?: 'quote' | 'order' | 'booking' | 'ticket' | null
}): QuoteCalculatorGuidance {
  const label = (input.label || 'service business').trim() || 'service business'
  const services = (input.services || []).map((s) => s.trim()).filter(Boolean)
  const engagement = input.engagementModel || 'quote'
  const tradeLabel = label.toLowerCase()

  const recommendedPricingModel: SuggestedPricingModel =
    engagement === 'ticket' || engagement === 'booking' || engagement === 'order'
      ? 'fixed'
      : 'fixed'

  const base: BaseQuoteCalculatorGuidance = {
    tradeLabel,
    recommendedPricingModel,
    recommendationReason:
      engagement === 'order'
        ? `Most ${tradeLabel} businesses sell priced menu/catalog items rather than measured project quotes.`
        : engagement === 'booking'
          ? `Most ${tradeLabel} businesses price by session or appointment.`
          : engagement === 'ticket'
            ? `Most ${tradeLabel} businesses price per ticket or admission.`
            : `Quotes for ${tradeLabel} usually start as a flat job or package, then adjust for scope and options.`,
    quoteVariables:
      engagement === 'order'
        ? ['item selection', 'quantity', 'add-ons or customizations']
        : engagement === 'booking'
          ? ['service type', 'duration / session length', 'provider or room']
          : engagement === 'ticket'
            ? ['event or show', 'ticket type', 'party size']
            : ['project scope', 'material or package tier', 'urgency or access'],
    serviceExamples:
      services.slice(0, 3).length > 0
        ? services.slice(0, 3)
        : [`${label} service`, `${label} package`, `${label} specialty job`],
    pricingExamples: [
      `$199+ starter ${tradeLabel} job`,
      `$750+ mid-tier package`,
      `$1,500+ premium / complex work`,
    ],
    tierExamples:
      engagement === 'ticket'
        ? ['General', 'Preferred', 'VIP']
        : engagement === 'booking'
          ? ['Standard', 'Extended', 'Premium']
          : ['Basic', 'Standard', 'Premium'],
    addOnExamples: ['Rush / priority', 'Premium materials or package', 'Extended support / warranty'],
    finishExamples: ['Standard package', 'Upgraded package', 'Premium package'],
    calculatorNotesPrompt: `What details make a ${tradeLabel} quote go up or down?`,
    calculatorNotesExample: `Example: Customers pick the exact ${tradeLabel} service first, then optional upgrades. Price should feel like how your team quotes jobs today.`,
  }

  return withTerminology(null, base, engagement)
}