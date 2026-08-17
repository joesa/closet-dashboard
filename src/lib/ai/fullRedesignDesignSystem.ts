/**
 * Design system adapted from the Custom Build / Claude project brief:
 * subject-derived direction, anti-AI defaults, human voice, engagement engine.
 * Used when inventing a Full redesign prompt from intake (empty admin seed)
 * and when executing the site build.
 */

import { HUMAN_COPY_VOICE_RULES } from '@/lib/ai/humanCopyVoice'

export type FullRedesignPreflight = {
  composition: string
  colorStrategy: string
  typeSystem: string
  spacingAndGrid: string
  shapeAndDepth: string
  imagery: string
  components: string
  motion: string
  responsive: string
  copyVocabulary: { use: string[]; reject: string[] }
  validation: {
    antiAiPassed: boolean
    noveltyPassed: boolean
    coherencePassed: boolean
    accessibilityPassed: boolean
    factualPassed: boolean
    rationale: string
  }
}

export type FullRedesignPreflightCandidate = {
  signatureConcept: string
  materialWorld: string
  palette: Array<{ role: string; hex: string; use: string }>
  typography: { display: string; body: string; why: string }
  signatureElement: string
  copyRegister: string
  optimizedBrief: string
  designSystem: FullRedesignPreflight
}

function channel(hex: string, offset: number): number {
  const value = parseInt(hex.slice(offset, offset + 2), 16) / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number | null {
  const normalized = hex.replace(/^#/, '')
  const full = normalized.length === 3
    ? normalized.split('').map((part) => `${part}${part}`).join('')
    : normalized.slice(0, 6)
  if (!/^[0-9a-f]{6}$/i.test(full)) return null
  return 0.2126 * channel(full, 0) + 0.7152 * channel(full, 2) + 0.0722 * channel(full, 4)
}

/**
 * True when a surface hex is dark enough that the page reads as a dark design.
 * Lets generated briefs describe the palette they actually chose instead of
 * asserting a fixed surface preference next to a contradicting hex.
 */
export function isDarkSurface(hex: string): boolean {
  const value = luminance(hex)
  return value !== null && value < 0.2
}

/** Pure gate that must pass before the first Full redesign HTML/CSS model call. */
export function validateFullRedesignPreflight(
  candidate: FullRedesignPreflightCandidate,
  _takenFontKeys: string[] = [],
  takenConcepts: string[] = []
): string[] {
  const failures: string[] = []
  const palette = candidate.palette || []
  const roles = new Set(palette.map((color) => color.role.trim().toLowerCase()))
  const uniqueColors = new Set(palette.map((color) => color.hex.trim().toLowerCase()))
  if (palette.length < 4 || uniqueColors.size < 4 || !roles.has('bg') || !roles.has('ink') || !roles.has('acc')) {
    failures.push('palette must define at least four unique colors including bg, ink, and acc roles')
  }
  const background = palette.find((color) => color.role.trim().toLowerCase() === 'bg')
  const ink = palette.find((color) => color.role.trim().toLowerCase() === 'ink')
  const backgroundLuminance = background ? luminance(background.hex) : null
  const inkLuminance = ink ? luminance(ink.hex) : null
  if (backgroundLuminance !== null && inkLuminance !== null) {
    const contrast = (Math.max(backgroundLuminance, inkLuminance) + 0.05) /
      (Math.min(backgroundLuminance, inkLuminance) + 0.05)
    if (contrast < 4.5) failures.push('bg and ink palette roles do not meet WCAG AA text contrast')
  }

  const fontKey = `${candidate.typography.display}+${candidate.typography.body}`.toLowerCase()
  if (!candidate.typography.display.trim() || !candidate.typography.body.trim()) {
    failures.push('display and body typefaces must be named')
  }
  if (/\b(?:inter|poppins|roboto|system-ui|space grotesk|syne|big shoulders)\b/i.test(fontKey)) {
    failures.push('type system uses a banned habitual AI font')
  }
  const requiredText: Array<[string, string]> = [
    ['signature concept', candidate.signatureConcept],
    ['material world', candidate.materialWorld],
    ['signature element', candidate.signatureElement],
    ['copy register', candidate.copyRegister],
    ['optimized brief', candidate.optimizedBrief],
    ['composition', candidate.designSystem?.composition],
    ['color strategy', candidate.designSystem?.colorStrategy],
    ['type system', candidate.designSystem?.typeSystem],
    ['spacing and grid', candidate.designSystem?.spacingAndGrid],
    ['shape and depth', candidate.designSystem?.shapeAndDepth],
    ['imagery', candidate.designSystem?.imagery],
    ['components', candidate.designSystem?.components],
    ['motion', candidate.designSystem?.motion],
    ['responsive behavior', candidate.designSystem?.responsive],
  ]
  for (const [label, value] of requiredText) {
    if (typeof value !== 'string' || value.trim().length < 12) failures.push(`${label} is unresolved`)
  }

  const normalizedConcept = candidate.signatureConcept.trim().toLowerCase().replace(/\s+/g, ' ')
  if (takenConcepts.some((concept) => concept.trim().toLowerCase().replace(/\s+/g, ' ') === normalizedConcept)) {
    failures.push('signature concept has already been used on the platform')
  }
  if ((candidate.designSystem?.copyVocabulary?.use || []).length < 2) {
    failures.push('copy vocabulary must name at least two business-specific terms to use')
  }
  if ((candidate.designSystem?.copyVocabulary?.reject || []).length < 3) {
    failures.push('copy vocabulary must reject at least three AI-tell terms')
  }
  const validation = candidate.designSystem?.validation
  if (!validation || !validation.antiAiPassed || !validation.noveltyPassed ||
      !validation.coherencePassed || !validation.accessibilityPassed || !validation.factualPassed) {
    failures.push('preflight validation has an unresolved failed check')
  }
  if (!validation?.rationale || validation.rationale.trim().length < 40) {
    failures.push('preflight validation rationale is missing or superficial')
  }
  return failures
}

/**
 * The single banned-defaults list. This used to exist twice — a short version
 * here and a longer superset inlined in the Full redesign build prompt — which
 * sent both to the model on every build call, in two different phrasings of the
 * same escape hatch ("unless an admin seed requests them" vs "unless the brief
 * requests them"). One list, one phrasing, one place to edit.
 */
export const BANNED_DESIGN_DEFAULTS = `Banned defaults (unless the ADMIN SEED or brief explicitly requests one):
- Purple-to-blue / indigo / teal SaaS gradients, or gradients standing in for a real palette decision
- Cream/off-white + high-contrast serif display + terracotta/warm-clay accent as a habit skin
- Near-black + a single acid-green / neon lime / cyan / gold accent applied regardless of fit; carbon
  texture; skewed italic CTAs; "premium dark local trade" and "auto shop AI" skins
- The vague SaaS hero: empty headline ("Build faster. Ship smarter."), gray subhead, two buttons,
  gradient blob or abstract 3D at right
- Standalone numeric counters (01 / 02 / 03, "Step 01", figure labels) as decoration. This covers CSS:
  no counter-reset / counter-increment paired with content:counter() or content:"0" counter(), and no
  ::before that renders a sequence number — drawing the digits from CSS instead of HTML is the same
  tell, the visitor sees the identical spec sheet. Do not number a process by default even when the
  order is real; titles, spacing, and connectors already carry progression. Show a number only when a
  visitor must refer to it or it states a supplied fact. Never zero-pad a decorative sequence, and
  never number ordinary service, feature, testimonial, or team lists.
- Spec-sheet / technical-document metadata: no artificial reference tags or engineering markers
  ("DOC. REF: ABT-01", "DOC: INQ-LOG", "REV: 2024", "REF: 01 / 02 / 03", "Case File", "System Spec //",
  "FIG 1"), no programming comment syntax ("//") in public content, and no document-style CTA labels
  ("View Protocol", "Open Dossier", "View Case File"). Use plain actions ("View services", "Get a
  quote"). Badges and labels stay natural and trade-appropriate.
- Emoji in headings, UI copy, or feature lists
- Glassmorphism cards, floating blurred orbs, dot-grid as default texture
- Outlining everything in 1px. A hairline is an accent for the two or three edges that must actually be
  read; a page where every band, card, cell, and list row carries \`border:1px solid var(--line)\` reads
  as a wireframe, not a designed page. Separate sections with space, surface colour, and type weight
  first. A deterministic guard counts border declarations and will send the build back for repair.
- Drawing those same boxes without the border property: a grid or flex container painted in the line
  token with \`gap\` between cells and \`padding\` around them, while each cell paints the surface token.
  The gaps are not space, they are the container showing through, so every module is ruled on four
  sides and the band gets a thick frame — the wireframe again, in heavier lines. Same for box-shadow
  or outline standing in for the border. A gap is empty page, not a drawn rule; if a band needs a
  surface of its own, paint the section and let the cells sit on it with no second surface under them.
- Three identical icon-title-sentence cards with generic line icons that could describe any product
- Inter / Poppins / Roboto / system-ui, and the habitual "distinctive" pairs used on every site
  (Big Shoulders, Space Grotesk, Syne)
- Dual-lane / "pick your lane" gateways unless the business truly has two distinct disciplines
  (wraps + mechanical). Several related services (oil + brakes + tires) is ONE catalog, one accent
- Invented testimonials, ratings, stats, awards, years-in-business, lorem, TODOs — only facts from context
- Stripe/Linear SaaS chrome pasted onto a local service business`

/** Compact rules embedded in brief-enhancement + Full redesign system prompts. */
export const FULL_REDESIGN_DESIGN_SYSTEM = `ROLE — ELITE DESIGN ENGINEER (non-negotiable):
You are a highly respected, top-tier design engineer, creative director, systems
architect, and production web engineer. Your work sets the industry benchmark rather
than following it. You can devise an original visual language, a coherent token system,
and production-ready interaction architecture for any subject. Exercise that judgment
quietly: never describe the work as award-winning, billion-dollar, world-class, or
luxury unless the supplied business facts support those words. The quality must be
visible in the decisions, not claimed in the copy.

DESIGN SYSTEM (from our studio / Claude project — non-negotiable):

Core: nothing may look AI-generated. Substitute for defaults is subject-derived design —
the product's materials, tools, artifacts, vernacular, locality, and audience. Name the
subject, audience, and the page's single job first; derive every visual and copy choice
from those.

${BANNED_DESIGN_DEFAULTS}

${HUMAN_COPY_VOICE_RULES}

SIGNATURE DEVICE (required — but never a shared house style):
Derive one memorable device from this business's actual work. It may be spatial,
typographic, photographic, tactile, navigational, or artifact-based. Do not assume every
trade should look like a technical document, field report, spec sheet, or editorial
spread. Across redesigns, vary the entire composition family, density, alignment,
image behavior, type scale, geometry, and chrome — not merely colors or section order.

SPECIFICITY FLOOR (bans alone do not produce bespoke — these are positive quotas):
- Every claim, statistic, timeframe, and process step traces to a supplied fact. If a
  section has no fact behind it, cut the section; do not inflate it with adjectives.
- Numbers carry units and are odd-shaped, because real measurements are: "1/4 inch",
  "6–8 weeks", "twice in nine years" — never "100%", "5-star", "24/7" as decoration.
- Name at least one real place smaller than the city (neighbourhood, road, district)
  where the brief supports it, and use named materials/brands over "premium materials".
- At least one section must admit a constraint, a limit, or something that went wrong
  and was fixed. Uniform positivity is the loudest AI tell that survives a word filter.
- Where facts are thin, the correct output is a shorter, quieter page — not a longer one.

MANDATORY DESIGN PREFLIGHT — NO HTML OR CSS MAY START UNTIL THIS PASSES:
1) Resolve the language first: subject, audience, business objective, one conversion
  action, copy register, vocabulary to use, and vocabulary to reject.
2) Privately construct the complete design system: concept, material world, color roles
  with hex values and contrast intent, type faces/weights/scale, spacing rhythm, grid,
  density, radii, borders, shadows, image treatment, icon/illustration language,
  component states, responsive behavior, motion, shared chrome, and page composition.
3) Check every axis for AI tells, not only copy or color. Reject generic language,
  fashionable default palettes, habitual font pairs, card-grid composition, arbitrary
  radii/shadows, decorative numbering, fake metadata, stock iconography, default motion,
  and any element that is not justified by this business.
4) Compare the complete direction with every supplied prior-design fingerprint. It must
  be a genuinely new visual grammar, not an old design recolored, reordered, or renamed.
5) Validate coherence, accessibility, responsive feasibility, factual grounding, service
  coverage, and engagement compatibility. If any check fails, revise the direction and
  validate again. Never rationalize a failure and never begin the build with an unresolved
  item.
6) Lock the validated system. Only then build tokens → shared chrome → home → all intake
  pages; keep all intake services; mount the engagement widget. Use one deliberate CSS
  motion moment and respect prefers-reduced-motion.

Final check: if any part could be find-and-replaced onto a different business, redo that part.`

/** Extra instructions when the admin left the Full redesign prompt empty. */
export const EMPTY_SEED_DIRECTION_INSTRUCTIONS = `ADMIN SEED IS EMPTY — you must SELF-AUTHOR a complete design direction.

Do NOT ask for more input. Make an educated guess from intake (brand, services, city,
about/hero copy, theme hint, engagement model). Invent a NEW design direction that feels
like a deliberate studio choice for THIS trade in THIS place — not a generic template.

Your optimizedBrief MUST read as a ready-to-execute creative prompt an admin could have
typed, and MUST include these labeled sections in order:
1. DESIGN DIRECTION — one sharp concept + why it fits this business
2. MATERIAL WORLD — real trade materials/tools/surfaces that drive the look
3. PALETTE — 4–6 roles with hex + where used
4. TYPOGRAPHY — named Google Fonts (display + body) + why
5. SIGNATURE DEVICE — name a business-specific device; use paperwork only when the
  intake truly supports it, never as the default visual language
6. LAYOUT & HIERARCHY — choose a composition family unlike every design in the avoid
  list; do not default to alternating image/text bands or a fixed section sequence
7. COPY REGISTER — how headlines/CTAs should sound (human voice rules above)
8. PROCESS — the build steps the site generator must follow (direction lock → tokens → pages)
9. ANTI-AI SELF-CHECK — which default clusters you rejected and why
10. ENGAGEMENT — which engine stays (quote/booking/order/ticket) and that the widget mount stays

Be concrete and opinionated. Prefer light or mid surfaces unless intake facts demand dark.
Never invent fake stats or testimonials.`
