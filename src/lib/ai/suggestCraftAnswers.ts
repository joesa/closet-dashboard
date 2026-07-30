import { generateTextWithFallback } from '@/lib/ai/aiTextProvider';

export type SuggestCraftAnswersInput = {
  industry?: string | null;
  businessName?: string | null;
  services?: string[] | null;
  otherServices?: string | null;
  serviceArea?: string | null;
  vibe?: string | null;
  tone?: string | null;
  differentiators?: string[] | null;
  singleField?: string | null;
};

export type CraftAnswers = {
  craftSpec?: string;
  clientArtifact?: string;
  shopRule?: string;
  localConditions?: string;
  recentJob?: string;
  timelineFacts?: string;
  crewShape?: string;
  competitorTell?: string;
  guaranteeTerms?: string;
  signatureMaterials?: string;
};

export type SuggestCraftAnswersResult = {
  answers: CraftAnswers;
  source: 'default' | 'openai' | 'gemini' | 'anthropic';
};

export type TradeVertical =
  | 'medical'
  | 'professional'
  | 'wellness'
  | 'cleaning'
  | 'auto'
  | 'food'
  | 'trade_closets'
  | 'trade_plumbing'
  | 'trade_hvac'
  | 'trade_general';

/**
 * Detect the business vertical category from industry title + services list.
 * Crucial to ensure medical, professional, wellness, and auto businesses get
 * copy tailored to their actual work (NOT building/construction assumptions).
 */
export function detectVertical(industry?: string | null, services?: string[] | null, otherServices?: string | null): TradeVertical {
  const combined = [
    industry || '',
    ...(services || []),
    otherServices || '',
  ].join(' ').toLowerCase();

  // Medical / Healthcare / Clinic
  if (
    /med|clinic|pediatr|doctor|health|urgent care|hospital|dental|dentist|physician|therapy|therapist|optom|eye care|dermatol|chiro|podiatr|vet|psych|counsel/i.test(combined)
  ) {
    return 'medical';
  }

  // Professional Services / Legal / Financial / Real Estate
  if (
    /legal|law|attorney|lawyer|account|cpa|tax|financial|wealth|real estate|realtor|broker|insurance|consulting|marketing|agency|architect/i.test(combined)
  ) {
    return 'professional';
  }

  // Personal Care / Wellness / Salon / Fitness
  if (
    /salon|spa|barber|hair|beauty|esthetic|skincare|fitness|gym|yoga|massage|lash|nail|tanning|wellness/i.test(combined)
  ) {
    return 'wellness';
  }

  // Cleaning / Janitorial
  if (
    /clean|janitor|maid|carpet clean|pressure wash|power wash|window clean|housekeeping/i.test(combined)
  ) {
    return 'cleaning';
  }

  // Automotive / Transport
  if (
    /auto|car|towing|tow|detail|tint|mechanic|wrap|transmission|body shop|vehicle|roadside/i.test(combined)
  ) {
    return 'auto';
  }

  // Food / Hospitality
  if (
    /restaurant|cater|bakery|bake|bar\b|pub\b|food|bistro|cafe|pizza|kitchen/i.test(combined)
  ) {
    return 'food';
  }

  // Specialty Trades
  if (/closet|storage|cabinet|millwork|organiz/i.test(combined)) {
    return 'trade_closets';
  }
  if (/plumb|drain|sewer|pipe|water heater/i.test(combined)) {
    return 'trade_plumbing';
  }
  if (/hvac|heat|air cond|cooling|furnace|duct/i.test(combined)) {
    return 'trade_hvac';
  }

  return 'trade_general';
}

export type CraftFieldMeta = {
  key: 'craftSpec' | 'clientArtifact' | 'shopRule' | 'localConditions' | 'recentJob' | 'timelineFacts' | 'crewShape' | 'competitorTell' | 'guaranteeTerms';
  label: string;
  placeholder: string;
};

export function getCraftFieldsForVertical(vertical: TradeVertical): CraftFieldMeta[] {
  if (vertical === 'medical') {
    return [
      {
        key: 'craftSpec',
        label: 'What do you measure or track, and how precisely in your clinical practice?',
        placeholder: 'e.g. We triage every patient immediately and track growth percentiles, vitals, and diagnostic accuracy to strict clinical standards.',
      },
      {
        key: 'clientArtifact',
        label: 'What does a patient or family actually receive after a visit?',
        placeholder: 'e.g. A same-day appointment summary, personalized care guide, and direct electronic prescription delivery.',
      },
      {
        key: 'shopRule',
        label: 'A clinical or practice rule you never break',
        placeholder: 'e.g. Every sick child gets seen the same day, and room sterilization happens between every single patient visit.',
      },
      {
        key: 'localConditions',
        label: 'What goes wrong in local healthcare, and why?',
        placeholder: 'e.g. Overcrowded ERs and rushed 4-minute appointments at corporate medical chains often miss underlying symptoms.',
      },
      {
        key: 'recentJob',
        label: 'One real recent patient case — what was wrong, what you did',
        placeholder: 'e.g. A 3-year-old patient with a 103°F fever — evaluated in 10 minutes, diagnosed acute otitis media, and sent amoxicillin to their pharmacy.',
      },
      {
        key: 'timelineFacts',
        label: 'Real response & appointment timeframes',
        placeholder: 'e.g. Same-day walk-in or appointment within 2 hours; 10-minute average lobby wait time.',
      },
      {
        key: 'crewShape',
        label: 'Who provides the care?',
        placeholder: 'e.g. Board-certified physicians and dedicated pediatric RNs on staff. You see the same doctor every visit.',
      },
      {
        key: 'competitorTell',
        label: 'What do corporate clinics or competitors get wrong?',
        placeholder: 'e.g. Corporate urgent care chains rush patients out in 4 minutes without listening to parents or checking full symptoms.',
      },
      {
        key: 'guaranteeTerms',
        label: 'Your care promise, in your own words',
        placeholder: 'e.g. Same-day access when your child is sick, plus direct 24/7 triage nurse phone access.',
      },
    ];
  }

  if (vertical === 'professional') {
    return [
      {
        key: 'craftSpec',
        label: 'What do you audit or measure, and how precisely?',
        placeholder: 'e.g. We audit every document and calculation for 100% regulatory compliance and tax precision.',
      },
      {
        key: 'clientArtifact',
        label: 'What does a client actually receive or sign off on?',
        placeholder: 'e.g. A comprehensive strategy roadmap, clear fee breakdown, and binding legal agreement.',
      },
      {
        key: 'shopRule',
        label: 'A professional rule you never break',
        placeholder: 'e.g. We return every client phone call or email within 24 hours — zero unreturned messages.',
      },
      {
        key: 'localConditions',
        label: 'What goes wrong in your field locally, and why?',
        placeholder: 'e.g. Complex local regulations create compliance traps for growing businesses if not audited early.',
      },
      {
        key: 'recentJob',
        label: 'One real recent client case — what was wrong, what you did',
        placeholder: 'e.g. Helped a local business resolve a complex partnership dispute inside 14 days without going to court.',
      },
      {
        key: 'timelineFacts',
        label: 'Real turnaround timeframes',
        placeholder: 'e.g. Initial consultation in 24 hours; clear milestone roadmap on day one.',
      },
      {
        key: 'crewShape',
        label: 'Who handles the work?',
        placeholder: 'e.g. Managing partners and licensed professionals handle your file directly. No junior interns.',
      },
      {
        key: 'competitorTell',
        label: 'What do large, impersonal firms get wrong?',
        placeholder: 'e.g. Large firms hand files off to inexperienced paralegals who take weeks to respond.',
      },
      {
        key: 'guaranteeTerms',
        label: 'Your commitment, in your own words',
        placeholder: 'e.g. Transparent, upfront fixed-fee pricing with zero surprise invoice charges.',
      },
    ];
  }

  if (vertical === 'wellness') {
    return [
      {
        key: 'craftSpec',
        label: 'What do you analyze before treatment, and how precisely?',
        placeholder: 'e.g. We perform a detailed skin or hair analysis before starting any treatment to match your exact profile.',
      },
      {
        key: 'clientArtifact',
        label: 'What does a client actually receive after a session?',
        placeholder: 'e.g. A customized home-care regimen and personalized treatment plan sheet.',
      },
      {
        key: 'shopRule',
        label: 'A hygiene or service rule you never break',
        placeholder: 'e.g. Every tool is medical-grade autoclaved or single-use sanitized between clients. We never double-book.',
      },
      {
        key: 'localConditions',
        label: 'What skin or hair issues happen locally, and why?',
        placeholder: 'e.g. High humidity and hard water frequently cause skin barrier breakdown and hair damage.',
      },
      {
        key: 'recentJob',
        label: 'One real recent client story — what was wrong, what you did',
        placeholder: 'e.g. Restored a client\'s damaged skin barrier over 4 tailored sessions using organic botanical treatments.',
      },
      {
        key: 'timelineFacts',
        label: 'Real session & schedule timeframes',
        placeholder: 'e.g. 60 to 90-minute dedicated sessions; zero waiting past your scheduled appointment time.',
      },
      {
        key: 'crewShape',
        label: 'Who provides the treatments?',
        placeholder: 'e.g. Master licensed estheticians and stylists with 8+ years specialized experience.',
      },
      {
        key: 'competitorTell',
        label: 'What do budget chains get wrong?',
        placeholder: 'e.g. Budget chains rush clients out in 15 minutes using cheap synthetic products that strip natural oils.',
      },
      {
        key: 'guaranteeTerms',
        label: 'Your guarantee, in your own words',
        placeholder: 'e.g. Love your look guarantee — free touch-up within 7 days if you\'re not completely delighted.',
      },
    ];
  }

  // Default / Trades / General
  return [
    {
      key: 'craftSpec',
      label: 'What do you measure, and how precisely?',
      placeholder: 'e.g. We laser every wall and build to the 1/4 inch — old houses rarely give us a true wall.',
    },
    {
      key: 'clientArtifact',
      label: 'What does a customer actually receive or sign off on?',
      placeholder: 'e.g. A dimensioned 2D elevation drawing with exact specs. Nothing gets cut until you sign.',
    },
    {
      key: 'shopRule',
      label: 'A rule you never break',
      placeholder: 'e.g. If a rail or panel is a half-inch off the drawing at install, it comes back to the shop.',
    },
    {
      key: 'localConditions',
      label: 'What goes wrong on jobs in your area, and why?',
      placeholder: 'e.g. Older homes in our area often have out-of-square plaster walls.',
    },
    {
      key: 'recentJob',
      label: 'One real recent job — what was wrong, what you did',
      placeholder: 'e.g. Job 24-0619: Replaced sagging wire rack and bare bulb with 6-drawer walnut stack.',
    },
    {
      key: 'timelineFacts',
      label: 'Real timeframes',
      placeholder: 'e.g. Detailed quote in 48 hours; 6 to 8 weeks from survey to install.',
    },
    {
      key: 'crewShape',
      label: 'Who does the work?',
      placeholder: 'e.g. Two senior fitters on staff for 8+ years. We never subcontract.',
    },
    {
      key: 'competitorTell',
      label: 'What do cheaper competitors get wrong?',
      placeholder: 'e.g. Cheaper installers screw into hollow drywall anchors instead of structural studs.',
    },
    {
      key: 'guaranteeTerms',
      label: 'Your guarantee, in your own words',
      placeholder: 'e.g. Ten years on cabinet structures, lifetime warranty on soft-close drawer runners.',
    },
  ];
}

export function getMaterialsLabelAndPlaceholder(vertical: TradeVertical): { label: string; placeholder: string; hint: string } {
  if (vertical === 'medical') {
    return {
      label: 'Clinical tools, diagnostic systems, or equipment you actually use',
      placeholder: 'e.g. Welch Allyn diagnostic sets, pediatric-dose neb treatments, 24/7 patient portal — comma separated',
      hint: 'Named medical tools and diagnostic equipment signal clinical quality and modern patient care.',
    };
  }
  if (vertical === 'professional') {
    return {
      label: 'Software, security standards, or platforms you use',
      placeholder: 'e.g. Encrypted client portal, Clio legal suite, QuickBooks Premier, SEC-compliant vaults — comma separated',
      hint: 'Named platforms and security standards signal professionalism and data privacy.',
    };
  }
  if (vertical === 'wellness') {
    return {
      label: 'Skincare brands, formulations, or tools you actually use',
      placeholder: 'e.g. Organic botanical formulations, medical-grade skin barrier serums, Dyson professional tools — comma separated',
      hint: 'Named premium products and tools beat generic "quality products" every time.',
    };
  }
  return {
    label: 'Materials, brands, or equipment you actually use',
    placeholder: 'e.g. Blum soft-close runners, white oak veneer, 2700K LED strip — comma separated',
    hint: 'Named products beat "premium materials" every time. These also give us the colours and textures your site is designed around.',
  };
}

/** Static fallbacks tailored by trade category when AI is offline or key missing. */
export function getTradeFallbackCraft(industry?: string | null, serviceArea?: string | null, services?: string[] | null): CraftAnswers {
  const vertical = detectVertical(industry, services);
  const area = serviceArea || 'your area';

  switch (vertical) {
    case 'medical':
      return {
        craftSpec: 'We triage every patient immediately and track vitals, diagnostic accuracy, and care plans to strict clinical standards.',
        clientArtifact: 'A same-day appointment summary, personalized care guide, and direct electronic prescription delivery to your pharmacy.',
        shopRule: 'Every sick child or urgent patient gets seen the same day, and room sterilization happens between every single patient visit.',
        localConditions: 'Overcrowded ERs in ' + area + ' and rushed 4-minute visits at corporate medical chains often miss underlying symptoms.',
        recentJob: 'A 3-year-old patient with a 103°F fever — evaluated in 10 minutes, diagnosed acute otitis media, and sent amoxicillin to their local pharmacy.',
        timelineFacts: 'Same-day walk-in or appointment within 2 hours; 10-minute average lobby wait time.',
        crewShape: 'Board-certified physicians and dedicated pediatric RNs on staff. You see the same doctor every visit.',
        competitorTell: 'Corporate urgent care chains rush patients out in 4 minutes without listening to parents or checking full symptoms.',
        guaranteeTerms: 'Same-day access when your child is sick, plus direct 24/7 triage nurse phone access.',
        signatureMaterials: 'Welch Allyn diagnostic sets, pediatric-dose neb treatments, 24/7 direct patient portal access.',
      };

    case 'professional':
      return {
        craftSpec: 'We audit every document and calculation for 100% regulatory compliance and precision.',
        clientArtifact: 'A comprehensive strategy roadmap, clear fee breakdown, and binder of binding agreements.',
        shopRule: 'We return every client phone call or email within 24 hours — zero unreturned messages.',
        localConditions: 'Complex local regulations in ' + area + ' create compliance traps for growing businesses if not audited early.',
        recentJob: 'Helped a local business resolve a complex dispute inside 14 days without going to trial.',
        timelineFacts: 'Initial consultation in 24 hours; clear milestone roadmap on day one.',
        crewShape: 'Managing partners and licensed professionals handle your file directly. No junior interns.',
        competitorTell: 'Large impersonal firms hand files off to inexperienced paralegals who take weeks to respond.',
        guaranteeTerms: 'Transparent, upfront fixed-fee pricing with zero surprise invoice charges.',
        signatureMaterials: 'Encrypted client portals, secure document vaults, advanced compliance software.',
      };

    case 'wellness':
      return {
        craftSpec: 'We perform a detailed skin or hair analysis before starting any treatment to match your exact profile.',
        clientArtifact: 'A customized home-care regimen and personalized treatment plan sheet.',
        shopRule: 'Every tool is medical-grade autoclaved or single-use sanitized between clients. We never double-book.',
        localConditions: 'High humidity and hard water in ' + area + ' frequently cause skin barrier breakdown and hair damage.',
        recentJob: 'Restored a client\'s damaged skin barrier over 4 tailored sessions using organic botanical treatments.',
        timelineFacts: '60 to 90-minute dedicated sessions; zero waiting past your scheduled appointment time.',
        crewShape: 'Master licensed estheticians and stylists with 8+ years specialized experience.',
        competitorTell: 'Budget chains rush clients out in 15 minutes using cheap synthetic products that strip natural oils.',
        guaranteeTerms: 'Love your look guarantee — free touch-up within 7 days if you\'re not completely delighted.',
        signatureMaterials: 'Organic botanical formulations, medical-grade skin barrier serums, Dyson professional tools.',
      };

    case 'cleaning':
      return {
        craftSpec: 'We follow a 50-point deep cleaning checklist, inspecting every baseboard, light switch, and corner.',
        clientArtifact: 'A completed 50-point cleaning inspection sheet and sanitized environment sign-off.',
        shopRule: 'We use color-coded microfiber cloths for bathrooms vs kitchens to guarantee zero cross-contamination.',
        localConditions: 'Heavy seasonal pollen and hard water in ' + area + ' cause rapid buildup on glass and tile grout.',
        recentJob: 'Deep-cleaned a 3,200 sq ft home before move-in, removing 5 years of pet dander and hard water scale.',
        timelineFacts: 'Free quote in 2 hours; 2 to 3 hour thorough cleaning visits.',
        crewShape: 'Background-checked, bonded, and insured in-house staff cleaners. Zero unvetted gig workers.',
        competitorTell: 'Cheap cleaners rush through in 45 minutes, skipping baseboards and using harsh chemical residue.',
        guaranteeTerms: '24-hour re-clean guarantee — if any spot is missed, we come back and fix it free.',
        signatureMaterials: 'Commercial HEPA vacuums, eco-friendly non-toxic solutions, hospital-grade microfiber systems.',
      };

    case 'auto':
      return {
        craftSpec: 'We measure paint depth down to microns and double-check wheel torque with calibrated digital tools.',
        clientArtifact: 'A digital vehicle inspection report with high-res photos and an itemized fixed-price estimate.',
        shopRule: 'We put down protective seat covers and floor mats before touching a single key.',
        localConditions: 'Road salt and UV intensity in ' + area + ' cause rapid paint oxidation and undercarriage rust.',
        recentJob: 'Job 24-0891: Diagnosed an intermittent electrical fault in 20 minutes that two other shops missed.',
        timelineFacts: 'Same-day turnaround for standard maintenance; 30-minute roadside dispatch.',
        crewShape: 'ASE-certified master technicians led by a shop foreman with 15+ years experience.',
        competitorTell: 'Quick-lube shops strip drain plugs and use cheap recycled oil that damages modern engines.',
        guaranteeTerms: '24-month / 24,000-mile warranty on all repairs and installed parts.',
        signatureMaterials: 'Snap-On diagnostic scanners, ceramic quartz paint coatings, OEM factory replacement parts.',
      };

    case 'food':
      return {
        craftSpec: 'We source ingredients fresh daily and maintain strict kitchen temperature controls down to the degree.',
        clientArtifact: 'A customized event menu proposal, dietary restriction map, and tasting schedule.',
        shopRule: 'Everything is made from scratch daily — zero frozen pre-cooked meals or artificial preservatives.',
        localConditions: 'Hot summers in ' + area + ' require specialized refrigerated transport for outdoor events.',
        recentJob: 'Catered a 150-person wedding with a 3-course plated dinner, serving every guest inside 18 minutes.',
        timelineFacts: 'Custom catering proposal in 24 hours; tasting session booked within 3 days.',
        crewShape: 'Executive chef and trained culinary team with 10+ years hospitality experience.',
        competitorTell: 'Budget caterers use pre-made frozen trays that get dry and lukewarm before serving.',
        guaranteeTerms: 'On-time delivery guarantee and 100% fresh presentation for every event.',
        signatureMaterials: 'Locally sourced organic produce, prime cuts, scratch-made sauces.',
      };

    case 'trade_closets':
      return {
        craftSpec: 'We survey every wall and build to the 1/4 inch — old houses in ' + area + ' rarely give us a true, plumb wall.',
        clientArtifact: 'A dimensioned 2D elevation drawing with exact shelf heights and drawer counts. Nothing gets cut until you sign.',
        shopRule: 'If a rail or panel is a half-inch off the drawing at install, it comes back to the shop. No hacking it on-site.',
        localConditions: 'Older homes in ' + area + ' often have out-of-square corners and plaster wall studs that shift over time.',
        recentJob: 'Job 24-0619: Replaced a sagging wire rack and bare bulb with a 6-drawer walnut stack and 2700K integrated LED strips.',
        timelineFacts: 'Detailed quote in 48 hours; six to eight weeks from initial survey to final installation.',
        crewShape: 'Two senior fitters, both on our staff for 8+ years. We never subcontract our installations.',
        competitorTell: 'Cheaper installers screw into hollow drywall anchors instead of structural studs, causing shelves to sag in a year.',
        guaranteeTerms: 'Ten years on cabinet structures, lifetime warranty on soft-close drawer runners.',
        signatureMaterials: 'Blum soft-close runners, 5/8-inch furniture-grade plywood, 2700K integrated LED strips.',
      };

    case 'trade_plumbing':
      return {
        craftSpec: 'We camera-inspect every sewer line before and after, measuring pipe slope down to 1/8-inch per foot.',
        clientArtifact: 'A HD video camera inspection recording with a line map and fixed quote on one sheet.',
        shopRule: 'We put down floor runners from the front door to the job site before pulling a single tool out of the truck.',
        localConditions: 'Cast iron drain lines in ' + area + ' homes built before 1975 are heavily corroded and prone to bellies.',
        recentJob: 'Job 24-1102: Replaced 40ft of collapsed clay sewer pipe with seamless schedule-80 PVC inside 6 hours.',
        timelineFacts: 'Same-day emergency response; 2 to 4 hours for standard water heater or fixture upgrades.',
        crewShape: 'Licensed master plumber on every job site with a dedicated apprentice. Zero temp workers.',
        competitorTell: 'Budget plumbers use cheap PVC glue and undersized drain vents that lead to sluggish drainage.',
        guaranteeTerms: '10 years on underground repipes, 3 years parts and labor on all fixture installs.',
        signatureMaterials: 'Schedule-80 PVC, Viega ProPress copper fittings, Bradford White water heaters.',
      };

    case 'trade_hvac':
      return {
        craftSpec: 'We calculate heat load to the exact BTU using Manual J software — never guessing tonnage based on square footage.',
        clientArtifact: 'A Manual J calculation sheet, duct pressure diagnostic report, and itemized installation contract.',
        shopRule: 'We nitrogen-purge every refrigerant line while brazing — zero oxidation inside the copper tubing.',
        localConditions: 'High summer humidity in ' + area + ' causes undersized return ducts to freeze up coils and sweat through ceilings.',
        recentJob: 'Job 25-0114: Replaced a 15-year-old R-22 system with a 18-SEER2 inverter heat pump, lowering electric bills by 35%.',
        timelineFacts: 'Free system design visit in 24 hours; full 1-day installation for split systems.',
        crewShape: 'NATE-certified technicians on staff. Lead installer has 12 years with our company.',
        competitorTell: 'Cheaper contractors skip nitrogen purges and leave metal shavings in the lines, killing the compressor in 3 years.',
        guaranteeTerms: '10-year parts & compressor warranty, plus 2-year no-breakdown labor guarantee.',
        signatureMaterials: 'Trane & Carrier inverter heat pumps, Sil-Fos 15% silver solder, R-410A / R-454B refrigerants.',
      };

    case 'trade_general':
    default:
      return {
        craftSpec: 'We laser-level every layout baseline to within 1/16th of an inch before starting installation.',
        clientArtifact: 'A detailed project elevation drawing, material schedule, and fixed-price contract on one page.',
        shopRule: 'We clean and vacuum the work site at the end of every working day, no exceptions.',
        localConditions: 'Seasonal moisture shifts in ' + area + ' cause improper subfloors and framing to warp if not sealed.',
        recentJob: 'Job 24-0982: Transformed an outdated space with custom cabinetry, soft-close hardware, and integrated lighting.',
        timelineFacts: 'Written proposal within 48 hours; 2 to 4 weeks average project completion timeframe.',
        crewShape: 'In-house craftspeople led by a project foreman with 10+ years trade experience. No third-party crews.',
        competitorTell: 'Competitors rush surface preparation and use cheap fasteners that rust or loosen within two seasons.',
        guaranteeTerms: '5-year structural craftsmanship warranty, 1-year full service coverage.',
        signatureMaterials: 'Commercial-grade fasteners, moisture-resistant plywood, low-VOC finishes.',
      };
  }
}

/**
 * AI generator for bespoke Craft & Proof answers.
 * Detects trade vertical (Medical, Legal, Wellness, Auto, Food, Cleaning, Construction)
 * and feeds vertical-specific personas and field guides to Gemini.
 */
export async function suggestCraftAnswers(
  input: SuggestCraftAnswersInput
): Promise<SuggestCraftAnswersResult> {
  const vertical = detectVertical(input.industry, input.services, input.otherServices);
  const fallback = getTradeFallbackCraft(input.industry, input.serviceArea, input.services);

  if (!process.env.GEMINI_API_KEY) {
    return { answers: fallback, source: 'default' };
  }

  const industry = (input.industry || '').trim();
  const businessName = (input.businessName || '').trim();
  const services = (input.services || []).filter(Boolean);
  const other = (input.otherServices || '').trim();
  const area = (input.serviceArea || '').trim();
  const vibe = (input.vibe || '').trim();
  const tone = (input.tone || '').trim();
  const differentiators = (input.differentiators || []).filter(Boolean);
  const singleField = (input.singleField || '').trim();

  let personaInstruction = '';
  let fieldExamples = '';

  if (vertical === 'medical') {
    personaInstruction = `You are a lead physician and medical director (e.g. Pediatrician, Clinic Director, Dental Director) writing authentic, patient-first copy for your local medical practice or clinic. You treat patients, provide urgent care, appointments, and specialized medical care.
CRITICAL: Do NOT write like a building contractor, plumber, or carpenter! Do NOT mention building, plywood, construction, laser levels, framing, or project foremen! Write 100% about medical/clinical care, patients, triage, doctor credentials, and health outcomes.`;

    fieldExamples = `
FIELD GUIDELINES FOR MEDICAL/HEALTHCARE PRACTICE:
- craftSpec: What do you measure or track, and how precisely? (e.g. "We triage every sick child immediately and track growth percentiles, vitals, and diagnostic accuracy to strict clinical standards.")
- clientArtifact: What does a patient actually receive? (e.g. "A same-day appointment summary, personalized care guide, and electronic prescription sent straight to their pharmacy.")
- shopRule: A clinical rule you never break (e.g. "Every sick child gets seen the same day, and room sterilization happens between every single patient visit.")
- localConditions: What goes wrong in local healthcare, and why? (e.g. "Overcrowded ERs in ${area || 'our area'} and rushed 4-minute visits at corporate medical chains often miss underlying symptoms.")
- recentJob: One real recent patient case — what was wrong, what you did (e.g. "A 3-year-old with a 103°F fever on a Sunday — evaluated in 10 minutes, diagnosed acute otitis media, and sent amoxicillin to their local pharmacy.")
- timelineFacts: Real timeframes (e.g. "Same-day walk-in or appointment within 2 hours; 10-minute average lobby wait time.")
- crewShape: Who provides the care? (e.g. "Board-certified physicians and dedicated pediatric RNs on staff. You see the same doctor every visit.")
- competitorTell: What do corporate urgent care chains get wrong? (e.g. "Corporate med-factories rush kids out in 4 minutes without listening to parents or checking full symptoms.")
- guaranteeTerms: Your commitment in your own words (e.g. "Same-day access when your child is sick, plus direct 24/7 triage nurse phone access.")
- signatureMaterials: Clinical tools or equipment you actually use (e.g. "Welch Allyn diagnostic sets, pediatric-dose neb treatments, 24/7 direct patient portal.")`;
  } else if (vertical === 'professional') {
    personaInstruction = `You are a managing partner / principal attorney / CPA writing authentic copy for your local professional services firm. Do NOT write about construction/building! Focus on legal/financial precision, client confidentiality, strategy, and results.`;
    fieldExamples = `
FIELD GUIDELINES FOR PROFESSIONAL SERVICES:
- craftSpec: What do you audit or measure? (e.g. "We audit every document for 100% regulatory compliance and tax precision.")
- clientArtifact: What does a client receive? (e.g. "A comprehensive strategy roadmap, clear fee breakdown, and binding legal agreement.")
- shopRule: A professional rule you never break (e.g. "We return every client phone call or email within 24 hours — zero unreturned messages.")
- localConditions: Local regulatory issues (e.g. "Complex local regulations in ${area || 'our area'} create compliance traps for growing businesses if not audited early.")
- recentJob: Real client outcome (e.g. "Resolved a complex partnership dispute inside 14 days without going to court.")
- timelineFacts: Real timeframes (e.g. "Initial consultation in 24 hours; clear milestone roadmap on day one.")
- crewShape: Who does the work? (e.g. "Managing partners handle your file directly. No junior interns.")
- competitorTell: What do big impersonal firms get wrong? (e.g. "Large firms hand files off to inexperienced paralegals who take weeks to respond.")
- guaranteeTerms: Billing commitment (e.g. "Transparent, upfront fixed-fee pricing with zero surprise invoice charges.")
- signatureMaterials: Tools/software used (e.g. "Encrypted client portals, secure document vaults, advanced compliance software.")`;
  } else if (vertical === 'wellness') {
    personaInstruction = `You are a master esthetician / salon director / fitness principal writing copy for your local wellness/beauty business. Focus on skin/hair care, customized regimens, sanitation, and client transformations. Do NOT mention construction/building!`;
    fieldExamples = `
FIELD GUIDELINES FOR WELLNESS/BEAUTY:
- craftSpec: What do you analyze? (e.g. "We perform a detailed skin or hair analysis before starting any treatment to match your exact profile.")
- clientArtifact: What does a client receive? (e.g. "A customized home-care regimen and personalized treatment plan sheet.")
- shopRule: A hygiene/care rule (e.g. "Every tool is autoclaved or single-use sanitized between clients. We never double-book.")
- localConditions: Local skin/hair challenges (e.g. "High humidity and hard water in ${area || 'our area'} cause skin barrier breakdown and hair damage.")
- recentJob: Real client transformation (e.g. "Restored a client's damaged skin barrier over 4 tailored sessions using organic botanical treatments.")
- timelineFacts: Timeframes (e.g. "60 to 90-minute dedicated sessions; zero waiting past your scheduled appointment time.")
- crewShape: Credentials (e.g. "Master licensed estheticians and stylists with 8+ years specialized experience.")
- competitorTell: What do budget chains get wrong? (e.g. "Budget chains rush clients out in 15 minutes using cheap synthetic products that strip natural oils.")
- guaranteeTerms: Satisfaction promise (e.g. "Love your look guarantee — free touch-up within 7 days if you're not completely delighted.")
- signatureMaterials: Products/tools (e.g. "Organic botanical formulations, medical-grade skin barrier serums, Dyson professional tools.")`;
  } else if (vertical === 'cleaning') {
    personaInstruction = `You are a professional cleaning director writing copy for your local cleaning business. Focus on deep-cleaning standards, cross-contamination prevention, HEPA filtration, and non-toxic products. Do NOT mention building/construction!`;
    fieldExamples = `
FIELD GUIDELINES FOR CLEANING:
- craftSpec: Cleaning standard (e.g. "We follow a 50-point deep cleaning checklist, inspecting every baseboard, light switch, and corner.")
- clientArtifact: What client receives (e.g. "A completed 50-point cleaning inspection sheet and sanitized environment sign-off.")
- shopRule: Sanity rule (e.g. "We use color-coded microfiber cloths for bathrooms vs kitchens to guarantee zero cross-contamination.")
- localConditions: Local dirt/pollen issues (e.g. "Heavy seasonal pollen and hard water in ${area || 'our area'} cause rapid buildup on glass and tile grout.")
- recentJob: Real cleaning transformation (e.g. "Deep-cleaned a 3,200 sq ft home before move-in, removing 5 years of pet dander and hard water scale.")
- timelineFacts: Timeframes (e.g. "Free quote in 2 hours; 2 to 3 hour thorough cleaning visits.")
- crewShape: Staffing (e.g. "Background-checked, bonded, and insured in-house staff cleaners. Zero unvetted gig workers.")
- competitorTell: What cheap cleaners get wrong (e.g. "Cheap cleaners rush through in 45 minutes, skipping baseboards and using harsh chemical residue.")
- guaranteeTerms: Guarantee (e.g. "24-hour re-clean guarantee — if any spot is missed, we come back and fix it free.")
- signatureMaterials: Equipment (e.g. "Commercial HEPA vacuums, eco-friendly non-toxic solutions, hospital-grade microfiber systems.")`;
  } else if (vertical === 'auto') {
    personaInstruction = `You are a master automotive technician / detailing director writing copy for your auto service business. Focus on diagnostic precision, OEM parts, paint microns, torque specs, and vehicle protection.`;
    fieldExamples = `
FIELD GUIDELINES FOR AUTOMOTIVE:
- craftSpec: Measurement (e.g. "We measure paint depth down to microns and double-check wheel torque with calibrated digital tools.")
- clientArtifact: What customer receives (e.g. "A digital vehicle inspection report with high-res photos and an itemized fixed-price estimate.")
- shopRule: Shop rule (e.g. "We put down protective seat covers and floor mats before touching a single key.")
- localConditions: Local vehicle issues (e.g. "Road salt and UV intensity in ${area || 'our area'} cause rapid paint oxidation and undercarriage rust.")
- recentJob: Real repair/detail case (e.g. "Diagnosed an intermittent electrical fault in 20 minutes that two other shops missed.")
- timelineFacts: Timeframes (e.g. "Same-day turnaround for standard maintenance; 30-minute roadside dispatch.")
- crewShape: Credentials (e.g. "ASE-certified master technicians led by a shop foreman with 15+ years experience.")
- competitorTell: What quick-lube shops get wrong (e.g. "Quick-lube shops strip drain plugs and use cheap recycled oil that damages modern engines.")
- guaranteeTerms: Warranty (e.g. "24-month / 24,000-mile warranty on all repairs and installed parts.")
- signatureMaterials: Equipment (e.g. "Snap-On diagnostic scanners, ceramic quartz paint coatings, OEM factory replacement parts.")`;
  } else if (vertical === 'food') {
    personaInstruction = `You are an executive chef / restaurant & catering owner writing copy for your culinary business. Focus on fresh daily ingredients, scratch cooking, temp controls, and event execution.`;
    fieldExamples = `
FIELD GUIDELINES FOR FOOD/HOSPITALITY:
- craftSpec: Standards (e.g. "We source ingredients fresh daily and maintain strict kitchen temperature controls down to the degree.")
- clientArtifact: What client receives (e.g. "A customized event menu proposal, dietary restriction map, and tasting schedule.")
- shopRule: Kitchen rule (e.g. "Everything is made from scratch daily — zero frozen pre-cooked meals or artificial preservatives.")
- localConditions: Local event challenges (e.g. "Hot summers in ${area || 'our area'} require specialized refrigerated transport for outdoor events.")
- recentJob: Real catering event (e.g. "Catered a 150-person wedding with a 3-course plated dinner, serving every guest inside 18 minutes.")
- timelineFacts: Timeframes (e.g. "Custom catering proposal in 24 hours; tasting session booked within 3 days.")
- crewShape: Staffing (e.g. "Executive chef and trained culinary team with 10+ years hospitality experience.")
- competitorTell: What budget caterers get wrong (e.g. "Budget caterers use pre-made frozen trays that get dry and lukewarm before serving.")
- guaranteeTerms: Promise (e.g. "On-time delivery guarantee and 100% fresh presentation for every event.")
- signatureMaterials: Ingredients (e.g. "Locally sourced organic produce, prime cuts, scratch-made sauces.")`;
  } else {
    personaInstruction = `You are a master craftsman and licensed trade contractor writing authentic, highly specific copy for your local business website's "Craft & Proof" section.`;
    fieldExamples = `
FIELD GUIDELINES FOR TRADES/CONTRACTING:
- craftSpec: What do you measure? (e.g. "We laser every wall and build to the 1/4 inch — old houses in ${area || 'our area'} rarely give us a true wall.")
- clientArtifact: What customer receives (e.g. "A dimensioned 2D elevation drawing with exact specs. Nothing gets cut until you sign.")
- shopRule: Shop rule (e.g. "If a panel is a half-inch off the drawing at install, it comes back to the shop. No hacking it on-site.")
- localConditions: Local building challenges (e.g. "Older homes in ${area || 'our area'} often have out-of-square plaster walls.")
- recentJob: Real job case (e.g. "Job 24-0619: Replaced sagging wire rack and bare bulb with 6-drawer walnut stack.")
- timelineFacts: Timeframes (e.g. "Detailed quote in 48 hours; 6 to 8 weeks from survey to install.")
- crewShape: Crew (e.g. "Two senior fitters on staff for 8+ years. We never subcontract.")
- competitorTell: What cheap competitors get wrong (e.g. "Cheaper installers screw into hollow drywall anchors instead of structural studs.")
- guaranteeTerms: Warranty (e.g. "Ten years on structures, lifetime warranty on soft-close runners.")
- signatureMaterials: Materials (e.g. "Blum soft-close runners, 5/8 plywood, 2700K integrated LED strips.")`;
  }

  const prompt = `${personaInstruction}

BUSINESS CONTEXT:
- Business Name: ${businessName || 'Local Business'}
- Trade / Industry: ${industry || 'Specialty Business'}
- Detected Vertical Category: ${vertical.toUpperCase()}
- Primary Services: ${services.join(', ') || 'Specialty Services'} ${other ? `(${other})` : ''}
- Location / Service Area: ${area || 'Local Area'}
- Tone / Vibe: ${vibe || 'Professional & Direct'}, ${tone || 'Trustworthy'}
- Differentiators: ${differentiators.join(', ') || 'In-house staff, precision work'}

${fieldExamples}

CRITICAL RULES FOR ALL ANSWERS:
1. Speak in first person ("We", "Our doctors", "Our staff", "Our crew"). Write like a real, experienced local business owner talking to a client/patient.
2. Be CONCRETE and SPECIFIC: include relevant real numbers (e.g. 15 minutes, 100%, 24/7, 10 years, Job 25-0104), tools, methods, or credentials matching THE EXACT INDUSTRY (${industry}).
3. NEVER use AI tell-words or marketing fluff. BANNED WORDS: "solutions", "leverage", "cutting-edge", "state-of-the-art", "comprehensive", "game-changer", "synergy", "streamline", "empower", "whether you need", "we are committed to", "our team of experienced professionals".
4. Keep each answer concise (1-2 tight sentences max).
5. MATCH THE INDUSTRY (${industry}): If this is medical/pediatrics, write 100% about medical/clinical care! If legal, write about legal! If closets, write about closets!

REQUIRED JSON OUTPUT FORMAT (Return JSON only, no markdown):
{
  "craftSpec": "answer text",
  "clientArtifact": "answer text",
  "shopRule": "answer text",
  "localConditions": "answer text",
  "recentJob": "answer text",
  "timelineFacts": "answer text",
  "crewShape": "answer text",
  "competitorTell": "answer text",
  "guaranteeTerms": "answer text",
  "signatureMaterials": "answer text"
}

${singleField ? `Focus especially on generating a brilliant, industry-specific answer for field "${singleField}".` : ''}
Generate tailored answers for ALL fields matching ${industry || 'the business'}.`;

  try {
    const { text: rawText, provider } = await generateTextWithFallback({
      prompt,
      jsonMode: true,
      temperature: 0.5,
      maxOutputTokens: 1500,
    });

    const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned) as CraftAnswers;

    const result: CraftAnswers = {
      craftSpec: (parsed.craftSpec || fallback.craftSpec)?.trim(),
      clientArtifact: (parsed.clientArtifact || fallback.clientArtifact)?.trim(),
      shopRule: (parsed.shopRule || fallback.shopRule)?.trim(),
      localConditions: (parsed.localConditions || fallback.localConditions)?.trim(),
      recentJob: (parsed.recentJob || fallback.recentJob)?.trim(),
      timelineFacts: (parsed.timelineFacts || fallback.timelineFacts)?.trim(),
      crewShape: (parsed.crewShape || fallback.crewShape)?.trim(),
      competitorTell: (parsed.competitorTell || fallback.competitorTell)?.trim(),
      guaranteeTerms: (parsed.guaranteeTerms || fallback.guaranteeTerms)?.trim(),
      signatureMaterials: (parsed.signatureMaterials || fallback.signatureMaterials)?.trim(),
    };

    return { answers: result, source: provider };
  } catch (err) {
    console.error('suggestCraftAnswers AI error:', err);
    return { answers: fallback, source: 'default' };
  }
}
