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

/** High-quality static fallbacks tailored by trade category when AI is offline. */
export function getTradeFallbackCraft(industry?: string | null, serviceArea?: string | null): CraftAnswers {
  const ind = (industry || '').toLowerCase();
  const area = serviceArea || 'your area';

  if (ind.includes('closet') || ind.includes('storage') || ind.includes('cabinet') || ind.includes('millwork')) {
    return {
      craftSpec: 'We survey every wall and build to the 1/4 inch — old houses in ' + area + ' rarely give us a true, plumb wall.',
      clientArtifact: 'A dimensioned 2D elevation drawing with exact shelf heights and drawer counts. Nothing gets cut until you sign the sheet.',
      shopRule: 'If a rail or panel is a half-inch off the drawing at install, it comes back to the shop. No hacking it on-site.',
      localConditions: 'Older homes in ' + area + ' often have out-of-square corners and plaster wall studs that shift over time.',
      recentJob: 'Job 24-0619: Replaced a sagging wire rack and bare bulb with a 6-drawer walnut stack and 2700K integrated LED strips.',
      timelineFacts: 'Detailed quote in 48 hours; six to eight weeks from initial survey to final installation.',
      crewShape: 'Two senior fitters, both on our staff for 8+ years. We never subcontract our installations.',
      competitorTell: 'Cheaper installers screw into hollow drywall anchors instead of structural studs, causing shelves to sag within a year.',
      guaranteeTerms: 'Ten years on cabinet structures, lifetime warranty on soft-close drawer runners.',
      signatureMaterials: 'Blum soft-close runners, 5/8-inch furniture-grade plywood, 2700K integrated LED strips.',
    };
  }

  if (ind.includes('plumb') || ind.includes('drain')) {
    return {
      craftSpec: 'We camera-inspect every sewer line before and after, measuring pipe slope down to 1/8-inch per foot.',
      clientArtifact: 'A HD video camera inspection recording with a line map and fixed quote on one sheet.',
      shopRule: 'We put down neoprene floor runners from the front door to the job site before pulling a single tool out of the truck.',
      localConditions: 'Cast iron drain lines in ' + area + ' homes built before 1975 are heavily corroded and prone to bellies.',
      recentJob: 'Job 24-1102: Replaced 40ft of collapsed clay sewer pipe with seamless schedule-80 PVC inside 6 hours.',
      timelineFacts: 'Same-day emergency response; 2 to 4 hours for standard water heater or fixture upgrades.',
      crewShape: 'Licensed master plumber on every job site with a dedicated apprentice. Zero temp workers.',
      competitorTell: 'Budget plumbers use cheap PVC glue and undersized drain vents that lead to sluggish drainage and sewer gas leaks.',
      guaranteeTerms: '10 years on underground repipes, 3 years parts and labor on all fixture installs.',
      signatureMaterials: 'Schedule-80 PVC, Viega ProPress copper fittings, Bradford White water heaters.',
    };
  }

  if (ind.includes('hvac') || ind.includes('heating') || ind.includes('air')) {
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
  }

  // Default fallback for general trade / contractor
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

/**
 * AI generator for bespoke Craft & Proof answers.
 * BANS AI tell-words (solutions, leverage, cutting-edge, state-of-the-art, etc.)
 * and forces concrete, 1st-person craftsman answers.
 */
export async function suggestCraftAnswers(
  input: SuggestCraftAnswersInput
): Promise<SuggestCraftAnswersResult> {
  if (!process.env.GEMINI_API_KEY) {
    return { answers: getTradeFallbackCraft(input.industry, input.serviceArea), source: 'default' };
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

  const prompt = `You are a master craftsman and veteran business owner writing authentic, highly specific copy for your local business website's "Craft & Proof" section.

BUSINESS CONTEXT:
- Business Name: ${businessName || 'Local Craft Studio'}
- Trade / Industry: ${industry || 'Custom Craftsman'}
- Primary Services: ${services.join(', ') || 'Specialty Services'} ${other ? `(${other})` : ''}
- Location / Service Area: ${area || 'Local Area'}
- Tone / Vibe: ${vibe || 'Warm & Craftsman'}, ${tone || 'Professional & Direct'}
- Differentiators: ${differentiators.join(', ') || 'In-house crew, precision work'}

CRITICAL RULES FOR ALL ANSWERS:
1. Speak in first person ("We", "Our crew", "Our shop"). Write like a real, experienced business owner talking to a customer.
2. Be CONCRETE and SPECIFIC: include numbers (e.g. 1/4 inch, 48 hours, 6-8 weeks, Job 24-0619, 10 years), tool names, brands, or materials.
3. NEVER use AI tell-words or marketing fluff. BANNED WORDS: "solutions", "leverage", "cutting-edge", "state-of-the-art", "comprehensive", "game-changer", "synergy", "streamline", "empower", "whether you need", "we are committed to", "our team of experienced professionals".
4. Keep each answer concise (1-2 tight sentences max).

REQUIRED JSON OUTPUT FORMAT (Return JSON only, no markdown):
{
  "craftSpec": "What do you measure, and how precisely? (e.g. We laser every wall and build to the 1/4 inch...)",
  "clientArtifact": "What does a customer actually receive or sign off on? (e.g. A hand-drawn elevation drawing...)",
  "shopRule": "A rule you never break (e.g. If a panel is 1/2 inch off the drawing at install, it comes back to the shop...)",
  "localConditions": "What goes wrong on jobs in your area, and why? (e.g. Pre-war homes in [Area] have out-of-square plaster corners...)",
  "recentJob": "One real recent job — what was wrong, what you did (e.g. Job 24-0619: fixed sagging wire rack, replaced with walnut drawer stack...)",
  "timelineFacts": "Real timeframes (e.g. Detailed quote in 48 hours; 6 to 8 weeks from survey to install.)",
  "crewShape": "Who does the work? (e.g. Two senior fitters on staff 9 years. We never subcontract.)",
  "competitorTell": "What do cheaper competitors get wrong? (e.g. They screw into drywall anchors instead of studs...)",
  "guaranteeTerms": "Your guarantee, in your own words (e.g. 10 years on boxes, lifetime on soft-close runners...)",
  "signatureMaterials": "Materials, brands, or equipment you actually use (e.g. Blum soft-close runners, 5/8 plywood, 2700K LED strips)"
}

${singleField ? `Focus especially on generating a brilliant, trade-specific answer for field "${singleField}".` : ''}
Generate tailored answers for ALL fields matching the specified trade (${industry || 'specialty trade'}).`;

  try {
    const { text: rawText, provider } = await generateTextWithFallback({
      prompt,
      jsonMode: true,
      temperature: 0.6,
      maxOutputTokens: 1500,
    });

    const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned) as CraftAnswers;

    const fallback = getTradeFallbackCraft(industry, area);
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
    return { answers: getTradeFallbackCraft(industry, area), source: 'default' };
  }
}
