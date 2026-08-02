import { generateTextWithFallback, CLAUDE_SONNET_MODEL } from '@/lib/ai/aiTextProvider'
import { extractServicesNamedInBrief } from '@/lib/ai/extractBriefServices'
import {
  EMPTY_SEED_DIRECTION_INSTRUCTIONS,
  FULL_REDESIGN_DESIGN_SYSTEM,
} from '@/lib/ai/fullRedesignDesignSystem'
import { pickDeterministicDirection } from '@/lib/ai/deterministicDirectionSeed'
import type { DesignAvoidList } from '@/lib/design/designAvoidList'

export type EnhancedFullRedesignBrief = {
  /** One-line concept the site will be remembered by. */
  signatureConcept: string
  /** Subject-world materials / vernacular the look comes from. */
  materialWorld: string
  /** Named roles + hex suggestions (4–6). */
  palette: Array<{ role: string; hex: string; use: string }>
  /** Display + body font suggestions (Google Fonts names). */
  typography: { display: string; body: string; why: string }
  /** Layout / signature UI element notes. */
  signatureElement: string
  /** Plain-spoken copy register for this brand. */
  copyRegister: string
  /** Services the admin brief wants added (not intake). */
  servicesToAdd: string[]
  /** AI defaults deliberately avoided for this business. */
  avoidDefaults: string[]
  /** Ready-to-use creative brief for the site generator. */
  optimizedBrief: string
  /** True when admin left the seed empty and we invented the full direction. */
  inventedFromIntake: boolean
  source: 'gemini' | 'anthropic' | 'fallback'
}

type EnhanceOpts = {
  brandName: string
  adminBrief: string
  hasImages: boolean
  engagementLabel: string
  services: string[]
  city?: string
  region?: string
  themeHint?: string
  /** Compact intake facts (about headline, differentiators, etc.). */
  intakeHints?: string
  /**
   * Designs already shipped on the platform. Steers the enhancer away from
   * taken directions up front — cheaper and better than rejecting the build
   * afterwards, and the only diversity lever available on the Claude path,
   * which does not accept a temperature.
   */
  avoid?: DesignAvoidList | null
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim()
  if (trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed)
    } catch {
      /* fall through */
    }
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    return JSON.parse(fenced[1].trim())
  }
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1))
  }
  throw new Error('No JSON object in brief enhancement response')
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' && v.trim() ? v.trim() : fallback
}

function asStringList(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean)
    .slice(0, 8)
}

function parsePalette(v: unknown): EnhancedFullRedesignBrief['palette'] {
  if (!Array.isArray(v)) return []
  const out: EnhancedFullRedesignBrief['palette'] = []
  for (const row of v.slice(0, 6)) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const hex = asString(r.hex)
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) continue
    out.push({
      role: asString(r.role, 'accent'),
      hex,
      use: asString(r.use, 'accent'),
    })
  }
  return out
}

/** Deterministic, trade-aware brief when the enhancer model is unavailable. */
export function fallbackEnhancedBrief(opts: EnhanceOpts): EnhancedFullRedesignBrief {
  const place = [opts.city, opts.region].filter(Boolean).join(', ') || 'the local market'
  const serviceLine =
    opts.services.slice(0, 5).join(', ') || 'the services from intake'
  const seed = opts.adminBrief.trim()
  const inventedFromIntake = !seed
  const signatureConcept = seed
    ? `${opts.brandName}: ${seed.slice(0, 120).replace(/\s+/g, ' ')}`
    : `${opts.brandName} — subject-derived craft for ${place}`
  const materialWorld = opts.themeHint
    ? `Interpret theme hint "${opts.themeHint}" through real trade materials and tools for ${serviceLine}, not a stock SaaS skin.`
    : `Derive the look from the real world of ${serviceLine} in ${place} — tools, surfaces, signage, and workwear — not from web design trends.`

  // Seeded per business and probed against what has already shipped. This used
  // to be five hardcoded hexes, identical for every business on the platform,
  // which made any enhancer outage a guaranteed collision.
  const direction = pickDeterministicDirection({
    brandName: opts.brandName,
    city: opts.city,
    region: opts.region,
    services: opts.services,
    themeHint: opts.themeHint,
    takenPaletteKeys: opts.avoid?.takenPaletteKeys,
    takenFontKeys: opts.avoid?.takenFontKeys,
  })
  const palette = direction.palette

  const optimizedBrief = inventedFromIntake
    ? [
        `1. DESIGN DIRECTION — ${signatureConcept}. Educated guess from intake for ${place}: one conversion job via ${opts.engagementLabel}; look must feel decided for ${opts.brandName}, not a template.`,
        `2. MATERIAL WORLD — ${materialWorld}`,
        `3. PALETTE — ${palette.map((p) => `${p.role} ${p.hex} (${p.use})`).join('; ')}. Prefer light/mid surfaces. Reject purple SaaS, cream+terracotta serif, and dark+neon auto defaults.`,
        `4. TYPOGRAPHY — Display = ${direction.typography.display}, Body = ${direction.typography.body} (${direction.typography.why}). Load both from Google Fonts. Never Inter/Poppins/Roboto/Syne-by-habit.`,
        `5. SIGNATURE ELEMENT — ${direction.signatureElement}. Reuse it in header/hero/footer rather than bolting on decoration.`,
        `6. LAYOUT & HIERARCHY — ${direction.composition}. Invent the order and proportions from this grammar. Include all services and the ${opts.engagementLabel} conversion, but do not fall back to hero → card grid → alternating image/text bands → centered CTA.`,
        `7. COPY REGISTER — Plain-spoken, specific to ${serviceLine}. No Elevate/Seamless/Unleash filler. CTAs name the real action (${opts.engagementLabel}).`,
        `8. PROCESS — Lock this direction → emit :root tokens → shared chrome → home → every intake page → mount engagement widget → one deliberate motion → self-check anti-AI.`,
        `9. ANTI-AI SELF-CHECK — Rejected purple gradients, cream+terracotta habit, dark+neon shop skin, three identical icon cards, Inter-by-habit. If ten AI tools would match, revise before build.`,
        `10. ENGAGEMENT — Keep ${opts.engagementLabel}; widget mount stays; never invent HTML forms.`,
        `SERVICES: Keep all intake services (${serviceLine}). Do not invent unrelated offerings.`,
        opts.hasImages
          ? 'REFERENCE IMAGES: Absorb mood/palette/composition; do not copy trademarks.'
          : '',
        opts.intakeHints ? `INTAKE HINTS: ${opts.intakeHints}` : '',
        'SELF-AUTHORED: Admin left seed empty — treat this entire brief as the admin prompt.',
      ]
        .filter(Boolean)
        .join('\n')
    : [
        `SIGNATURE CONCEPT: ${signatureConcept}`,
        `MATERIAL WORLD: ${materialWorld}`,
        `ADMIN SEED (honor literally when specific): ${seed}`,
        `PALETTE DIRECTION: ${palette.map((p) => `${p.role} ${p.hex} (${p.use})`).join('; ')}. Adjust hexes if the seed pins colors; otherwise keep subject-derived and avoid purple SaaS, cream+terracotta serif, and dark+neon auto defaults.`,
        `TYPE: Display = ${direction.typography.display}, Body = ${direction.typography.body} (${direction.typography.why}). Load both from Google Fonts. Swap only if the admin seed names different faces. Never Inter/Poppins/Roboto/Syne-by-habit.`,
        `SIGNATURE ELEMENT: ${direction.signatureElement}. COMPOSITION: ${direction.composition}.`,
        `COPY: Plain-spoken, specific to ${serviceLine}. No "Elevate/Seamless/Unleash" filler. CTAs name the real action (${opts.engagementLabel}).`,
        `SERVICES: Keep all intake services. Add every offering the admin seed names that is not already in intake.`,
        `ANTI-AI: Self-check — if ten AI tools would produce the same look, revise palette/type/signature before building.`,
        `PROCESS: Direction lock → tokens → chrome → home → intake pages → engagement mount → one motion.`,
        opts.hasImages
          ? 'REFERENCE IMAGES: Absorb mood/palette/composition; do not copy trademarks.'
          : '',
        opts.intakeHints ? `INTAKE HINTS: ${opts.intakeHints}` : '',
      ]
        .filter(Boolean)
        .join('\n')

  return mergeExtractedServices(
    {
      signatureConcept,
      materialWorld,
      palette,
      typography: direction.typography,
      signatureElement: direction.signatureElement,
      copyRegister: `Plain, specific, active voice for ${opts.brandName}`,
      servicesToAdd: [],
      avoidDefaults: [
        'purple-to-blue SaaS gradients',
        'cream + terracotta serif habit',
        'dark charcoal + neon accents',
        'three identical icon cards',
        'Inter/Poppins/Roboto by habit',
      ],
      optimizedBrief,
      inventedFromIntake,
      source: 'fallback',
    },
    opts
  )
}

/** Union model/fallback servicesToAdd with deterministic extraction from the seed. */
function mergeExtractedServices(
  brief: EnhancedFullRedesignBrief,
  opts: EnhanceOpts
): EnhancedFullRedesignBrief {
  const extracted = extractServicesNamedInBrief(opts.adminBrief, opts.services)
  if (!extracted.length && !brief.servicesToAdd.length) return brief

  const merged: string[] = []
  const seen = new Set<string>()
  for (const title of [
    ...brief.servicesToAdd,
    ...extracted.map((e) => e.title),
  ]) {
    const key = title.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    merged.push(title.trim())
  }

  let optimizedBrief = brief.optimizedBrief
  if (merged.length && !/REQUIRED SERVICE ADDS/i.test(optimizedBrief)) {
    optimizedBrief = `${optimizedBrief}\nREQUIRED SERVICE ADDS (must appear on home + services pages AND in serviceUpdates.added): ${merged.join(' | ')}`
  }

  return { ...brief, servicesToAdd: merged, optimizedBrief }
}

function normalizeEnhanced(
  raw: unknown,
  opts: EnhanceOpts,
  source: EnhancedFullRedesignBrief['source']
): EnhancedFullRedesignBrief {
  const fallback = fallbackEnhancedBrief(opts)
  if (!raw || typeof raw !== 'object') return { ...fallback, source }
  const o = raw as Record<string, unknown>
  const typography =
    o.typography && typeof o.typography === 'object'
      ? (o.typography as Record<string, unknown>)
      : {}
  const palette = parsePalette(o.palette)
  const optimizedBrief = asString(o.optimizedBrief || o.enhancedBrief || o.brief)
  if (!optimizedBrief) {
    return { ...fallback, source }
  }

  const modelTypography = {
    display: asString(typography.display, fallback.typography.display),
    body: asString(typography.body, fallback.typography.body),
    why: asString(typography.why, fallback.typography.why),
  }

  // The model saw the avoid-list but does not always honour it. Rather than
  // spend another call arguing, keep its brief prose — which is the part worth
  // having — and substitute the seeded direction for the axis it reused. The
  // fallback direction was already probed against the same taken keys.
  const takenFonts = new Set((opts.avoid?.takenFontKeys || []).map((k) => k.toLowerCase()))
  const modelFontKey = `${modelTypography.display}+${modelTypography.body}`.toLowerCase()
  const fontCollides = takenFonts.has(modelFontKey)
  const avoidDefaults = asStringList(o.avoidDefaults).length
    ? asStringList(o.avoidDefaults)
    : fallback.avoidDefaults

  return mergeExtractedServices(
    {
      signatureConcept: asString(o.signatureConcept, fallback.signatureConcept),
      materialWorld: asString(o.materialWorld, fallback.materialWorld),
      palette: palette.length ? palette : fallback.palette,
      typography: fontCollides ? fallback.typography : modelTypography,
      signatureElement: asString(o.signatureElement, fallback.signatureElement),
      copyRegister: asString(o.copyRegister, fallback.copyRegister),
      servicesToAdd: asStringList(o.servicesToAdd),
      avoidDefaults: fontCollides
        ? [...avoidDefaults, `type pairing "${modelFontKey}" — already used on this platform`]
        : avoidDefaults,
      optimizedBrief,
      inventedFromIntake: fallback.inventedFromIntake,
      source,
    },
    opts
  )
}

const JSON_SHAPE = `{
  "signatureConcept": "one memorable line",
  "materialWorld": "where the look comes from in the subject's world",
  "palette": [{"role":"bg|ink|muted|line|acc|acc2","hex":"#rrggbb","use":"where"}],
  "typography": {"display":"Google Font","body":"Google Font","why":"why this pair"},
  "signatureElement": "the one remembered UI/chrome detail",
  "copyRegister": "how the brand should sound",
  "servicesToAdd": ["EVERY sellable service named in the admin seed that is not already in intake — even if the seed is meta ('write a prompt for…'). Empty array when seed is empty"],
  "avoidDefaults": ["which AI defaults you steered away from"],
  "optimizedBrief": "ready-to-execute creative prompt — see length/structure rules in the system message"
}`

/**
 * Expand a simple or detailed admin Full redesign prompt into a subject-derived,
 * anti-AI creative brief grounded in intake.
 *
 * Empty admin seed: Claude Sonnet invents a complete design-direction prompt
 * using the studio design system (educated guess from intake). Non-empty seed:
 * Gemini expands/optimizes (keeps Claude budget for the site generate).
 */
export async function enhanceFullRedesignBrief(
  opts: EnhanceOpts
): Promise<EnhancedFullRedesignBrief> {
  const fallback = fallbackEnhancedBrief(opts)
  if (!process.env.GEMINI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    return fallback
  }

  const seedEmpty = !opts.adminBrief.trim()
  const avoidBlock = opts.avoid?.promptBlock ? `\n${opts.avoid.promptBlock}\n` : ''

  const systemPrompt = seedEmpty
    ? `You invent complete Full redesign creative prompts for bespoke local-business websites. Output JSON only.

${FULL_REDESIGN_DESIGN_SYSTEM}
${avoidBlock}
${EMPTY_SEED_DIRECTION_INSTRUCTIONS}

Return ONLY JSON:
${JSON_SHAPE}

optimizedBrief length: 350-650 words. It IS the admin prompt — write it so a site generator can execute it without further invention of direction.`
    : `You optimize creative briefs for bespoke local-business websites. Output JSON only.

${FULL_REDESIGN_DESIGN_SYSTEM}
${avoidBlock}
Given an admin seed (one sentence or a long checklist) plus intake facts, produce an OPTIMIZED creative brief that:
1. Honors every specific admin instruction (colors named, layout asks, services to add).
2. Fills every free axis from the business's real world (trade materials, tools, locality, audience) — never from AI design defaults.
3. Chooses a concrete palette (hex), type pairing, and one signature element that could not be find-and-replaced onto another business.
4. Explicitly steers away from AI tells unless the admin seed asks for them.
5. Includes a short PROCESS section (direction lock → tokens → pages → engagement → anti-AI check).

Return ONLY JSON:
${JSON_SHAPE}

optimizedBrief: 200-450 words; must include a REQUIRED SERVICE ADDS line listing servicesToAdd. Do not invent testimonials or fake stats.`

  const userPrompt = `Brand: ${opts.brandName}
Place: ${[opts.city, opts.region].filter(Boolean).join(', ') || 'unknown'}
Engagement engine (must stay): ${opts.engagementLabel}
Intake services (must keep): ${opts.services.join(' | ') || '(none listed)'}
Theme hint: ${opts.themeHint || '(none)'}
Has reference images: ${opts.hasImages ? 'yes' : 'no'}
Intake hints: ${opts.intakeHints || '(none)'}
Designs already shipped on this platform: ${
    opts.avoid?.taken.length
      ? `${opts.avoid.taken.length} — see the ALREADY USED block in the system message; your direction must differ from all of them`
      : 'none yet'
  }

ADMIN SEED:
${opts.adminBrief.trim() || '(EMPTY — invent a complete self-authored design-direction prompt from intake + design system)'}

Produce the optimized brief JSON.`

  try {
    // Empty seed: Claude Sonnet invents the direction (design-system judgment).
    // Non-empty: Gemini expands — keep Claude budget for the full site generate.
    const { text, provider } = await generateTextWithFallback({
      systemPrompt,
      prompt: userPrompt,
      jsonMode: true,
      temperature: seedEmpty ? 0.75 : 0.65,
      maxOutputTokens: seedEmpty ? 2200 : 1400,
      preferredProvider: seedEmpty ? 'anthropic' : 'gemini',
      anthropicModel: CLAUDE_SONNET_MODEL,
    })
    const parsed = extractJsonObject(text)
    return normalizeEnhanced(
      parsed,
      opts,
      provider === 'anthropic' ? 'anthropic' : 'gemini'
    )
  } catch (err) {
    console.warn('[enhanceFullRedesignBrief] falling back:', err)
    return fallback
  }
}

/** Compact intake string for the enhancer (keeps the call small). */
export function buildIntakeHintsForBrief(context: Record<string, unknown>): string {
  const parts: string[] = []
  const about = context.about
  if (about && typeof about === 'object') {
    const a = about as Record<string, unknown>
    for (const key of ['headline', 'subheadline', 'story', 'body'] as const) {
      const v = a[key]
      if (typeof v === 'string' && v.trim()) {
        parts.push(`${key}: ${v.trim().slice(0, 220)}`)
      }
    }
  }
  const hero = context.hero
  if (hero && typeof hero === 'object') {
    const h = hero as Record<string, unknown>
    if (typeof h.headline === 'string' && h.headline.trim()) {
      parts.push(`hero: ${h.headline.trim().slice(0, 160)}`)
    }
  }
  const intakePages = context.intakePages
  if (Array.isArray(intakePages)) {
    for (const page of intakePages.slice(0, 3)) {
      if (!page || typeof page !== 'object') continue
      const p = page as Record<string, unknown>
      const title = typeof p.title === 'string' ? p.title : ''
      const slug = typeof p.slug === 'string' ? p.slug : ''
      if (title || slug) parts.push(`page ${slug || title}`)
    }
  }
  return parts.join(' · ').slice(0, 900)
}
