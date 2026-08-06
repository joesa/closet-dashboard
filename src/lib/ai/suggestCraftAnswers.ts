import { generateTextWithFallback } from '@/lib/ai/aiTextProvider';
import { generateWithQualityRetry } from '@/lib/ai/generateWithQualityRetry';
import { HUMAN_COPY_VOICE_RULES } from '@/lib/ai/humanCopyVoice';
import { validateGeneratedUnits } from '@/lib/validation/generatedContentQuality';
import { detectVertical } from '@/lib/ai/craftFields';

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
  quality: {
    status: 'passed' | 'failed';
    attempts: number;
    findings: Array<{ unitId: string; code: string; message: string; samples: string[] }>;
    retryError?: string;
  };
};

const CRAFT_ANSWER_KEYS = [
  'craftSpec',
  'clientArtifact',
  'shopRule',
  'localConditions',
  'recentJob',
  'timelineFacts',
  'crewShape',
  'competitorTell',
  'guaranteeTerms',
  'signatureMaterials',
] as const;

type CraftAnswerKey = (typeof CRAFT_ANSWER_KEYS)[number];

function normalizeCraftAnswers(parsed: CraftAnswers, fallback: CraftAnswers): Record<CraftAnswerKey, string> {
  return Object.fromEntries(
    CRAFT_ANSWER_KEYS.map((key) => [key, (parsed[key] || fallback[key] || '').trim()])
  ) as Record<CraftAnswerKey, string>;
}

function validateCraftAnswers(answers: Record<CraftAnswerKey, string>) {
  return validateGeneratedUnits({
    stage: 'intake.craft-suggestions',
    profile: 'label',
    units: CRAFT_ANSWER_KEYS.map((id) => ({ id, text: answers[id] })),
  });
}

/**
 * Universal static fallbacks tailored by trade vertical when AI is offline or key missing.
 * ZERO construction/building terms for non-construction businesses!
 */
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

    case 'instruction':
      return {
        craftSpec: 'We assess developmental milestones and skill levels to craft an individualized learning roadmap for each student.',
        clientArtifact: 'Weekly digital progress reports, video milestone recordings, and skill achievement certificates.',
        shopRule: 'Low student-to-teacher ratios guaranteed — maximum 4 children per certified instructor.',
        localConditions: 'Crowded local programs in ' + area + ' with 15+ kids per class often leave individual students behind.',
        recentJob: 'Helped a shy 4-year-old gain full reading confidence and social engagement within 6 weeks.',
        timelineFacts: 'Flexible morning & afternoon sessions; visible skill milestones every 4 weeks.',
        crewShape: 'Certified educators and CPR/first-aid trained staff with background checks on file.',
        competitorTell: 'Commercial chains rotate unvetted part-time staff weekly, destroying continuity of care.',
        guaranteeTerms: '100% satisfaction guarantee — if your child doesn\'t love their first week, full refund.',
        signatureMaterials: 'Montessori sensory kits, certified CPR kits, digital progress portals.',
      };

    case 'creative':
      return {
        craftSpec: 'We shoot in 4K HDR color-matched profiles, capturing authentic candid moments and fine details.',
        clientArtifact: 'An online high-res gallery, full print rights, and a custom linen-bound heirloom album.',
        shopRule: 'We back up all raw files to dual off-site cloud vaults before leaving the event location.',
        localConditions: 'Dark historic venues in ' + area + ' require specialized off-camera flash setups for crisp photos.',
        recentJob: 'Captured a 12-hour wedding event across 3 locations, delivering 650 edited photos in 10 days.',
        timelineFacts: '48-hour sneak peek gallery; full delivered project inside 14 business days.',
        crewShape: 'Lead artist and dedicated second shooter. We never subcontract your event to freelancers.',
        competitorTell: 'Budget shooters use harsh direct flash, lose unbacked files, and take 3 months to deliver.',
        guaranteeTerms: 'Guaranteed on-time delivery and complete gallery satisfaction, or we re-edit for free.',
        signatureMaterials: 'Sony FX3 4K cine gear, Lightroom Pro, hand-stitched linen albums.',
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

    case 'general_service':
      return {
        craftSpec: 'We track every client request and measure quality standards to 100% accuracy before completion.',
        clientArtifact: 'A clear service summary, transparent itemized proposal or care plan, and direct contact line.',
        shopRule: 'We return every client message within 24 hours and never compromise on quality, safety, or client privacy.',
        localConditions: 'Scheduling delays and rushed 5-minute service at large chains often compromise quality in ' + area + '.',
        recentJob: 'Assisted a local client with an urgent request, resolving their issue smoothly in under 2 hours.',
        timelineFacts: 'Initial response within 2 hours; fast, reliable scheduling suited to your availability.',
        crewShape: 'Experienced, background-checked in-house professionals with years of dedicated service. No unvetted temps.',
        competitorTell: 'Impersonal national chains rush clients out without listening to their specific needs or checking details.',
        guaranteeTerms: '100% satisfaction guarantee — if something isn\'t right, we fix it immediately at no extra charge.',
        signatureMaterials: 'Dedicated client portals, instant dispatch software, 24/7 direct communication lines.',
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
 * Universal AI generator for bespoke Craft & Proof answers.
 * Dynamically synthesizes copy for ANY of 100s of business & service types.
 * Passes the exact industry, services, and domain to Gemini so the AI crafts
 * 100% authentic, bespoke answers regardless of niche.
 */
export async function suggestCraftAnswers(
  input: SuggestCraftAnswersInput
): Promise<SuggestCraftAnswersResult> {
  const vertical = detectVertical(input.industry, input.services, input.otherServices);
  const fallback = getTradeFallbackCraft(input.industry, input.serviceArea, input.services);

  if (!process.env.GEMINI_API_KEY) {
    const answers = normalizeCraftAnswers(fallback, fallback);
    const quality = validateCraftAnswers(answers);
    return { answers, source: 'default', quality: { ...quality, attempts: 1 } };
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

  const isPhysicalTrade = vertical.startsWith('trade_');

  const prompt = `You are a master copywriter and veteran business operator writing authentic, highly specific copy for a local business or professional service website's "Craft & Proof" section.

CRITICAL CONTEXT ANALYSIS:
- Industry / Profession: "${industry || 'Specialty Business'}"
- Business Name: "${businessName || 'Local Business'}"
- Primary Services Offered: ${services.length > 0 ? services.join(', ') : 'Specialty Services'} ${other ? `(${other})` : ''}
- Location / Service Area: "${area || 'Local Area'}"
- Tone & Vibe: ${vibe || 'Professional'}, ${tone || 'Trustworthy'}
- Key Differentiators: ${differentiators.length > 0 ? differentiators.join(', ') : 'Quality in-house staff, dedicated service'}

UNIVERSAL COPYWRITING INSTRUCTIONS:
1. DEEPLY ANALYZE THIS EXACT PROFESSION (${industry}): Whether it is Pediatrics, Law, Dog Grooming, Daycare, Music Lessons, Photography, Car Detailing, Plumbing, Solar Energy, or Funeral Services — write 100% tailored, authentic copy for THIS SPECIFIC INDUSTRY.
2. ${isPhysicalTrade ? 'This is a physical trade / construction business. Use trade terms (drawings, measurements, materials, install rules).' : 'IMPORTANT: This is NOT a construction or building business! DO NOT mention laser levels, plywood, framing, project foremen, elevation drawings, or cabinet rails unless the industry explicitly involves construction! Write strictly about the actual services provided.'}
3. Speak in first person ("We", "Our doctors", "Our team", "Our instructors", "Our technicians", "Our shop").
4. Be CONCRETE and SPECIFIC: include real metrics, timeframes, credentials, tools, software, or specialized methods relevant to ${industry}.
5. BANNED FLUFF WORDS: "solutions", "leverage", "cutting-edge", "state-of-the-art", "comprehensive", "game-changer", "synergy", "streamline", "empower", "whether you need", "we are committed to", "our team of experienced professionals".
6. Keep each answer concise (1-2 tight sentences max).

${HUMAN_COPY_VOICE_RULES}

REQUIRED JSON OUTPUT FORMAT (Return JSON only, no markdown):
{
  "craftSpec": "What do you measure, track, or analyze, and how precisely? Tailor to ${industry}.",
  "clientArtifact": "What does a client/patient/customer actually receive after a visit or project? Tailor to ${industry}.",
  "shopRule": "An operational or service rule you never break in your business.",
  "localConditions": "What goes wrong with competitors or local market conditions in ${area || 'your area'}, and why?",
  "recentJob": "One real recent client/patient case study or project — what was wrong, what you did.",
  "timelineFacts": "Real turnaround, response, or scheduling timeframes for ${industry}.",
  "crewShape": "Who provides the service or handles the work? (Credentials, experience, in-house staff).",
  "competitorTell": "What do cheap competitors or large impersonal chains get wrong?",
  "guaranteeTerms": "Your service guarantee or commitment in your own words.",
  "signatureMaterials": "Specific tools, equipment, software, or products you actually use for ${industry}."
}

${singleField ? `Focus especially on generating a brilliant, industry-specific answer for field "${singleField}".` : ''}
Generate tailored answers for ALL fields matching ${industry || 'this business'}.`;

  try {
    const { text: rawText, provider } = await generateTextWithFallback({
      prompt,
      jsonMode: true,
      temperature: 0.5,
      maxOutputTokens: 1500,
    });

    const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned) as CraftAnswers;

    const initial = normalizeCraftAnswers(parsed, fallback);
    const retried = await generateWithQualityRetry({
      initial,
      validate: validateCraftAnswers,
      regenerate: async ({ failedUnitIds, findings, current }) => {
        const repairPrompt = `Repair only the failed Craft & Proof fields below.
Return one JSON object containing exactly these keys: ${failedUnitIds.join(', ')}.
Do not return or rewrite any other field.

Business context:
- Industry: ${industry || 'Specialty Business'}
- Services: ${services.join(', ') || 'Specialty Services'}
- Service area: ${area || 'Local Area'}

Failed fields and findings:
${findings.map((finding) => `- ${finding.unitId}: ${finding.code} — ${finding.message}${finding.samples.length ? ` (${finding.samples.join(', ')})` : ''}`).join('\n')}

Current failed values:
${failedUnitIds.map((unitId) => `- ${unitId}: ${current[unitId as CraftAnswerKey]}`).join('\n')}

${HUMAN_COPY_VOICE_RULES}`;
        const { text } = await generateTextWithFallback({
          prompt: repairPrompt,
          jsonMode: true,
          temperature: 0.3,
          maxOutputTokens: 800,
          preferredProvider: provider,
        });
        const repair = JSON.parse(text.replace(/```json/gi, '').replace(/```/g, '').trim()) as CraftAnswers;
        return Object.fromEntries(
          failedUnitIds
            .filter((unitId): unitId is CraftAnswerKey => CRAFT_ANSWER_KEYS.includes(unitId as CraftAnswerKey))
            .filter((unitId) => typeof repair[unitId] === 'string')
            .map((unitId) => [unitId, repair[unitId]!.trim()])
        );
      },
    });

    return {
      answers: retried.output,
      source: provider,
      quality: {
        ...retried.report,
        attempts: retried.attempts,
        retryError: retried.retryError,
      },
    };
  } catch (err) {
    console.error('suggestCraftAnswers AI error:', err);
    const answers = normalizeCraftAnswers(fallback, fallback);
    const quality = validateCraftAnswers(answers);
    return { answers, source: 'default', quality: { ...quality, attempts: 1 } };
  }
}
