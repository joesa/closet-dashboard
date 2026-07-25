import { generateTextWithFallback } from '@/lib/ai/aiTextProvider'
import { extractServicesNamedInBrief } from '@/lib/ai/extractBriefServices'

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
  const signatureConcept = seed
    ? `${opts.brandName}: ${seed.slice(0, 120).replace(/\s+/g, ' ')}`
    : `${opts.brandName} — honest trade craft for ${place}`
  const materialWorld = opts.themeHint
    ? `Interpret theme hint "${opts.themeHint}" through real trade materials and tools for ${serviceLine}, not a stock SaaS skin.`
    : `Derive the look from the real world of ${serviceLine} in ${place} — tools, surfaces, signage, and workwear — not from web design trends.`

  const palette: EnhancedFullRedesignBrief['palette'] = [
    { role: 'bg', hex: '#eef2f1', use: 'cool shop-floor ground (not cream paper cliché)' },
    { role: 'ink', hex: '#1a1f1e', use: 'primary text' },
    { role: 'muted', hex: '#5a6562', use: 'secondary text' },
    { role: 'line', hex: '#c5d0cc', use: 'rules / borders' },
    { role: 'acc', hex: '#2f5d50', use: 'primary CTA / enamel accent — not neon or terracotta' },
  ]

  const optimizedBrief = [
    `SIGNATURE CONCEPT: ${signatureConcept}`,
    `MATERIAL WORLD: ${materialWorld}`,
    `ADMIN SEED (honor literally when specific): ${seed || '(none — invent from intake only)'}`,
    `PALETTE DIRECTION: ${palette.map((p) => `${p.role} ${p.hex} (${p.use})`).join('; ')}. Adjust hexes if the seed pins colors; otherwise keep subject-derived and avoid purple SaaS, cream+terracotta serif, and dark+neon auto defaults.`,
    `TYPE: Display = something characterful for THIS trade (not Inter/Poppins/Roboto/Syne-by-habit). Body = highly readable companion. Pair must feel decided for ${opts.brandName}.`,
    `SIGNATURE ELEMENT: One memorable chrome detail rooted in the trade (e.g. work-order ledger, vinyl chip strip, stamped metal tag) — reuse in header/hero/footer rhythm.`,
    `COPY: Plain-spoken, specific to ${serviceLine}. No "Elevate/Seamless/Unleash" filler. CTAs name the real action (${opts.engagementLabel}).`,
    `SERVICES: Keep all intake services. Add every offering the admin seed names that is not already in intake.`,
    `ANTI-AI: Self-check — if ten AI tools would produce the same look, revise palette/type/signature before building.`,
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
      typography: {
        display: 'Trade-specific display (choose a real Google Font that fits)',
        body: 'Readable companion (choose a real Google Font)',
        why: 'Must feel decided for this brand, not a default stack',
      },
      signatureElement: 'One trade-rooted chrome detail repeated with purpose',
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
  return mergeExtractedServices(
    {
      signatureConcept: asString(o.signatureConcept, fallback.signatureConcept),
      materialWorld: asString(o.materialWorld, fallback.materialWorld),
      palette: palette.length ? palette : fallback.palette,
      typography: {
        display: asString(typography.display, fallback.typography.display),
        body: asString(typography.body, fallback.typography.body),
        why: asString(typography.why, fallback.typography.why),
      },
      signatureElement: asString(o.signatureElement, fallback.signatureElement),
      copyRegister: asString(o.copyRegister, fallback.copyRegister),
      servicesToAdd: asStringList(o.servicesToAdd),
      avoidDefaults: asStringList(o.avoidDefaults).length
        ? asStringList(o.avoidDefaults)
        : fallback.avoidDefaults,
      optimizedBrief,
      source,
    },
    opts
  )
}

/**
 * Expand a simple or detailed admin Full redesign prompt into a subject-derived,
 * anti-AI creative brief grounded in intake. Uses Gemini (fast) so the main
 * Claude site generate still has budget. Falls open to a deterministic brief.
 */
export async function enhanceFullRedesignBrief(
  opts: EnhanceOpts
): Promise<EnhancedFullRedesignBrief> {
  const fallback = fallbackEnhancedBrief(opts)
  if (!process.env.GEMINI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    return fallback
  }

  const systemPrompt = `You optimize creative briefs for bespoke local-business websites. Output JSON only.

Given an admin seed (may be empty, one sentence, or a long checklist) plus intake facts, produce an OPTIMIZED creative brief that:
1. Honors every specific admin instruction (colors named, layout asks, services to add).
2. Fills every free axis from the business's real world (trade materials, tools, locality, audience) — never from AI design defaults.
3. Chooses a concrete palette (hex), type pairing, and one signature element that could not be find-and-replaced onto another business.
4. Explicitly steers away from AI tells unless the admin seed asks for them.

Banned defaults unless seed requests them: purple-to-blue SaaS gradients; cream/off-white + terracotta serif habit; near-black + neon lime/cyan/gold; vague SaaS heroes; emoji; glassmorphism/orbs/dot-grids; three identical icon cards; Inter/Poppins/Roboto/Syne-by-habit; Elevate/Seamless/Unleash copy; dual-lane gateways unless two true disciplines.

Return ONLY JSON:
{
  "signatureConcept": "one memorable line",
  "materialWorld": "where the look comes from in the subject's world",
  "palette": [{"role":"bg|ink|muted|line|acc|acc2","hex":"#rrggbb","use":"where"}],
  "typography": {"display":"Google Font","body":"Google Font","why":"why this pair"},
  "signatureElement": "the one remembered UI/chrome detail",
  "copyRegister": "how the brand should sound",
  "servicesToAdd": ["EVERY sellable service named in the admin seed that is not already in intake — even if the seed is meta ('write a prompt for…', 'build a site for wrapping and brakes'). Examples: Vehicle Wrapping, Brake Service"],
  "avoidDefaults": ["which AI defaults you steered away from"],
  "optimizedBrief": "200-450 words: ready-to-execute creative brief — must include a REQUIRED SERVICE ADDS line listing servicesToAdd. Do not invent testimonials or fake stats."
}`

  const userPrompt = `Brand: ${opts.brandName}
Place: ${[opts.city, opts.region].filter(Boolean).join(', ') || 'unknown'}
Engagement engine (must stay): ${opts.engagementLabel}
Intake services (must keep): ${opts.services.join(' | ') || '(none listed)'}
Theme hint: ${opts.themeHint || '(none)'}
Has reference images: ${opts.hasImages ? 'yes' : 'no'}
Intake hints: ${opts.intakeHints || '(none)'}

ADMIN SEED (optimize this — empty means invent from intake only):
${opts.adminBrief.trim() || '(empty)'}

Produce the optimized brief JSON.`

  try {
    const { text, provider } = await generateTextWithFallback({
      systemPrompt,
      prompt: userPrompt,
      jsonMode: true,
      temperature: 0.65,
      maxOutputTokens: 1400,
      // Prefer Gemini — keep Claude budget for the full site generate.
      preferredProvider: 'gemini',
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
