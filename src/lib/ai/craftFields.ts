// Client-safe half of the craft-answers feature. Must stay free of server-only
// AI/node imports so client components can use it without pulling node:crypto
// into the browser bundle.

export type TradeVertical =
  | 'medical'
  | 'professional'
  | 'wellness'
  | 'instruction'
  | 'creative'
  | 'cleaning'
  | 'auto'
  | 'food'
  | 'trade_closets'
  | 'trade_plumbing'
  | 'trade_hvac'
  | 'trade_general'
  | 'general_service';

/**
 * Detect the business vertical category from industry title + services list.
 * Open-ended classifier supporting 100s of service categories:
 * Healthcare, Professional Services, Wellness/Fitness, Education/Childcare,
 * Creative/Events, Automotive, Cleaning, Hospitality, Trades, and General Services.
 */
export function detectVertical(industry?: string | null, services?: string[] | null, otherServices?: string | null): TradeVertical {
  const combined = [
    industry || '',
    ...(services || []),
    otherServices || '',
  ].join(' ').toLowerCase();

  // 1. Medical / Healthcare / Clinic / Vet / Dental
  if (
    /med|clinic|pediatr|doctor|health|urgent care|hospital|dental|dentist|physician|therapy|therapist|optom|eye care|dermatol|chiro|podiatr|vet\b|veterin|psych|counsel|rehab/i.test(combined)
  ) {
    return 'medical';
  }

  // 2. Professional Services / Legal / Financial / Real Estate / Tech / Consulting
  if (
    /legal|law|attorney|lawyer|account|cpa|tax|financial|wealth|real estate|realtor|broker|insurance|consulting|marketing|agency|architect|it support|cybersecurity|mortgage|notary|investig/i.test(combined)
  ) {
    return 'professional';
  }

  // 3. Wellness / Fitness / Beauty / Salon / Spa
  if (
    /salon|spa|barber|hair|beauty|esthetic|skincare|fitness|gym|yoga|pilates|massage|lash|nail|tanning|wellness|martial arts|dojo|boxing/i.test(combined)
  ) {
    return 'wellness';
  }

  // 4. Education / Childcare / Instruction / Training
  if (
    /daycare|childcare|preschool|nursery|tutoring|music school|music lesson|dance studio|driving school|swim school|academy|learning|camp\b/i.test(combined)
  ) {
    return 'instruction';
  }

  // 5. Creative / Photography / Events / Design
  if (
    /photog|videog|dj\b|event plan|wedding|graphic design|tattoo|piercing|florist|interior design|party|print shop/i.test(combined)
  ) {
    return 'creative';
  }

  // 6. Automotive / Transport / Logistics
  if (
    /auto|car\b|towing|tow\b|detail|tint|mechanic|wrap|transmission|body shop|vehicle|roadside|fleet|trucking|moving company|mover/i.test(combined)
  ) {
    return 'auto';
  }

  // 7. Cleaning / Janitorial / Sanitation
  if (
    /clean|janitor|maid|carpet clean|pressure wash|power wash|window clean|housekeeping|disinfect/i.test(combined)
  ) {
    return 'cleaning';
  }

  // 8. Food / Hospitality / Catering
  if (
    /restaurant|cater|bakery|bake|bar\b|pub\b|food|bistro|cafe|pizza|kitchen|brewery|distillery|hotel/i.test(combined)
  ) {
    return 'food';
  }

  // 9. Specialty Physical Trades
  if (/closet|storage|cabinet|millwork|organiz/i.test(combined)) {
    return 'trade_closets';
  }
  if (/plumb|drain|sewer|pipe|water heater/i.test(combined)) {
    return 'trade_plumbing';
  }
  if (/hvac|heat|air cond|cooling|furnace|duct/i.test(combined)) {
    return 'trade_hvac';
  }
  if (
    /roof|landscap|lawn|paint|floor|remodel|mason|deck|fence|concrete|handyman|solar|pest|construction|builder|general contractor|drywall|tile/i.test(combined)
  ) {
    return 'trade_general';
  }

  // Default for any non-trade service business (e.g. Pet Grooming, Funeral Home, Rental, Pawn Shop, etc.)
  return 'general_service';
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

  if (vertical === 'instruction') {
    return [
      {
        key: 'craftSpec',
        label: 'What do you evaluate, and how precisely for each student/child?',
        placeholder: 'e.g. We assess developmental milestones and skill levels to craft an individualized learning roadmap.',
      },
      {
        key: 'clientArtifact',
        label: 'What do parents/students receive to track progress?',
        placeholder: 'e.g. Weekly digital progress reports, video milestone recordings, and skill achievement certificates.',
      },
      {
        key: 'shopRule',
        label: 'A safety or educational rule you never break',
        placeholder: 'e.g. Low student-to-teacher ratios guaranteed — maximum 4 children per certified instructor.',
      },
      {
        key: 'localConditions',
        label: 'What challenges do families face locally, and why?',
        placeholder: 'e.g. Crowded local programs with 15+ kids per class often leave individual students behind.',
      },
      {
        key: 'recentJob',
        label: 'One real student/child success story — what changed?',
        placeholder: 'e.g. Helped a shy 4-year-old gain full reading confidence and social engagement within 6 weeks.',
      },
      {
        key: 'timelineFacts',
        label: 'Real scheduling & milestone timeframes',
        placeholder: 'e.g. Flexible morning & afternoon sessions; visible skill milestones every 4 weeks.',
      },
      {
        key: 'crewShape',
        label: 'Who teaches or cares for the students?',
        placeholder: 'e.g. Certified educators and CPR/first-aid trained staff with background checks on file.',
      },
      {
        key: 'competitorTell',
        label: 'What do large commercial chains get wrong?',
        placeholder: 'e.g. Commercial chains rotate unvetted part-time staff weekly, destroying continuity of care.',
      },
      {
        key: 'guaranteeTerms',
        label: 'Your educational/care commitment',
        placeholder: 'e.g. 100% satisfaction guarantee — if your child doesn\'t love their first week, full refund.',
      },
    ];
  }

  if (vertical === 'creative') {
    return [
      {
        key: 'craftSpec',
        label: 'What details or moments do you focus on, and how precisely?',
        placeholder: 'e.g. We shoot in 4K HDR color-matched profiles, capturing authentic candid moments and fine details.',
      },
      {
        key: 'clientArtifact',
        label: 'What does a client actually receive after the project?',
        placeholder: 'e.g. An online high-res gallery, full print rights, and a custom linen-bound heirloom album.',
      },
      {
        key: 'shopRule',
        label: 'A creative or service rule you never break',
        placeholder: 'e.g. We back up all raw files to dual off-site cloud vaults before leaving the event location.',
      },
      {
        key: 'localConditions',
        label: 'What local venue or lighting challenges do you solve?',
        placeholder: 'e.g. Dark historic venues in our area require specialized off-camera flash setups for crisp photos.',
      },
      {
        key: 'recentJob',
        label: 'One real recent project story — what happened?',
        placeholder: 'e.g. Captured a 12-hour wedding event across 3 locations, delivering 650 edited photos in 10 days.',
      },
      {
        key: 'timelineFacts',
        label: 'Real delivery timeframes',
        placeholder: 'e.g. 48-hour sneak peek gallery; full delivered project inside 14 business days.',
      },
      {
        key: 'crewShape',
        label: 'Who creates the work?',
        placeholder: 'e.g. Lead artist and dedicated second shooter. We never subcontract your event to freelancers.',
      },
      {
        key: 'competitorTell',
        label: 'What do budget operators get wrong?',
        placeholder: 'e.g. Budget shooters use harsh direct flash, lose unbacked files, and take 3 months to deliver.',
      },
      {
        key: 'guaranteeTerms',
        label: 'Your creative commitment',
        placeholder: 'e.g. Guaranteed on-time delivery and complete gallery satisfaction, or we re-edit for free.',
      },
    ];
  }

  if (vertical === 'general_service') {
    return [
      {
        key: 'craftSpec',
        label: 'What standards do you measure or track for every client?',
        placeholder: 'e.g. We track every client requirement and measure quality standards to 100% accuracy.',
      },
      {
        key: 'clientArtifact',
        label: 'What does a client or customer actually receive?',
        placeholder: 'e.g. A clear service summary, transparent itemized proposal or care plan, and direct contact line.',
      },
      {
        key: 'shopRule',
        label: 'A service rule you never break',
        placeholder: 'e.g. We return every client message within 24 hours and never compromise on quality or safety.',
      },
      {
        key: 'localConditions',
        label: 'What goes wrong with local competitors, and why?',
        placeholder: 'e.g. Scheduling delays and rushed 5-minute service at large chains often compromise quality.',
      },
      {
        key: 'recentJob',
        label: 'One real recent client story — what was wrong, what you did',
        placeholder: 'e.g. Assisted a local client with an urgent request, resolving their issue smoothly in under 2 hours.',
      },
      {
        key: 'timelineFacts',
        label: 'Real response & completion timeframes',
        placeholder: 'e.g. Initial response within 2 hours; fast, reliable scheduling suited to your availability.',
      },
      {
        key: 'crewShape',
        label: 'Who provides the service?',
        placeholder: 'e.g. Experienced, background-checked in-house staff with years of dedicated service.',
      },
      {
        key: 'competitorTell',
        label: 'What do cheap competitors get wrong?',
        placeholder: 'e.g. Impersonal national chains rush clients out without listening to their specific needs.',
      },
      {
        key: 'guaranteeTerms',
        label: 'Your service commitment, in your own words',
        placeholder: 'e.g. 100% satisfaction guarantee — if something isn\'t right, we fix it immediately at no extra charge.',
      },
    ];
  }

  // Default / Physical Trades / Construction
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
  if (vertical === 'instruction') {
    return {
      label: 'Educational materials, curriculum, or safety tools you use',
      placeholder: 'e.g. Montessori sensory kits, certified CPR kits, digital progress portals — comma separated',
      hint: 'Named educational tools signal quality instruction and child safety.',
    };
  }
  if (vertical === 'creative') {
    return {
      label: 'Camera gear, software, or finishing materials you use',
      placeholder: 'e.g. Sony FX3 4K cine gear, Lightroom Pro, hand-stitched linen albums — comma separated',
      hint: 'Named professional gear signals technical mastery and high production value.',
    };
  }
  if (vertical === 'general_service') {
    return {
      label: 'Software, equipment, or service systems you actually use',
      placeholder: 'e.g. Dedicated client portals, instant dispatch software, 24/7 communication lines — comma separated',
      hint: 'Named tools signal modern operations and quality customer care.',
    };
  }
  return {
    label: 'Materials, brands, or equipment you actually use',
    placeholder: 'e.g. Blum soft-close runners, white oak veneer, 2700K LED strip — comma separated',
    hint: 'Named products beat "premium materials" every time. These also give us the colours and textures your site is designed around.',
  };
}
