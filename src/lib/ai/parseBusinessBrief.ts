import { generateTextWithFallback } from '@/lib/ai/aiTextProvider'
import { resolveSitePresentationRules } from '@/lib/ai/resolveSitePresentation'
import {
  listIndustries,
  resolveIndustrySlug,
  servicesForIndustry,
  matchServiceDef,
  getIndustry,
} from '@/lib/catalog/serviceCatalog'
import type { IndustrySlug } from '@/lib/catalog/types'

/**
 * Admin sandbox: parse a free-text business brief ("concrete and masonry
 * company in Austin…") into structured setup fields — industry, services,
 * business name, theme, layout — so the operator doesn't have to manually
 * pick catalog values that match the trade.
 */

export type ParsedBusinessBrief = {
  /** Canonical catalog industry label (e.g. "Concrete & Masonry"). */
  industryLabel: string
  industrySlug: IndustrySlug
  businessName: string
  services: string[]
  serviceArea?: string
  vibe?: string
  tone?: string
  customers?: string
  experience?: string
  differentiators?: string[]
  primaryCta?: string
  notes?: string
  /** Rules-resolved presentation for this trade + brief signals. */
  theme: string
  layoutStyle: string
  engagementModel: string
  defaultRoom: string
  /** Suggested multi-page count (1–10) when the brief implies a larger site. */
  suggestedPageCount: number
  /** Enriched description passed to generate-site (same as input, optionally expanded). */
  description: string
}

function normalizeLabel(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Match AI-extracted service strings to catalog labels for the resolved industry. */
function matchServicesToCatalog(
  raw: string[],
  industrySlug: IndustrySlug
): string[] {
  const catalog = servicesForIndustry(industrySlug)
  const out: string[] = []
  for (const item of raw) {
    const trimmed = item.trim()
    if (!trimmed) continue
    const exact = catalog.find((s) => normalizeLabel(s.label) === normalizeLabel(trimmed))
    if (exact) {
      if (!out.includes(exact.label)) out.push(exact.label)
      continue
    }
    const def = matchServiceDef(trimmed, industrySlug) ?? matchServiceDef(trimmed)
    if (def && !out.includes(def.label)) out.push(def.label)
  }
  if (out.length === 0 && catalog.length > 0) {
    return catalog.slice(0, Math.min(3, catalog.length)).map((s) => s.label)
  }
  return out
}

function resolveIndustryLabel(rawLabel: string | undefined, services: string[]): string {
  const slug = resolveIndustrySlug({
    industry: rawLabel,
    services,
  })
  return getIndustry(slug).label
}

const VIBE_OPTIONS = [
  'Luxury & minimal',
  'Bold & industrial',
  'Warm & classic',
  'Modern & clean',
  'Playful & friendly',
  'Rustic & natural',
  'Elegant & refined',
  'Sleek & high-tech',
]

const CTA_OPTIONS = [
  'Book a free consultation',
  'Request a quote',
  'Call now',
  'Browse the portfolio',
]

export async function parseBusinessBrief(input: string): Promise<ParsedBusinessBrief> {
  const trimmed = input.trim()
  if (!trimmed) {
    throw new Error('Business description is required.')
  }

  const industryLabels = listIndustries()
    .map((i) => i.label)
    .sort((a, b) => a.localeCompare(b))

  const systemPrompt = `You extract structured onboarding fields from an admin's free-text business brief for a local-service-business website platform.

Respond with ONLY a JSON object:
{
  "businessName": "string — the business name if stated or a sensible invented name from context",
  "industryLabel": "string — MUST be exactly one label from the INDUSTRIES list below (best match for the trade)",
  "services": ["string", ...] — 1-6 specific services mentioned or typical for this trade; use catalog-style names when possible,
  "serviceArea": "string or null — city/region served",
  "vibe": "string or null — one of: ${VIBE_OPTIONS.map((v) => `"${v}"`).join(', ')}",
  "tone": "string or null — e.g. Professional & trustworthy, Friendly & approachable, Bold & confident, Elegant & refined",
  "customers": "string or null — ideal clientele",
  "experience": "string or null — e.g. Just getting started, 1–5 years, 5–15 years, 15+ years / well established",
  "differentiators": ["string"] or [],
  "primaryCta": "string or null — one of: ${CTA_OPTIONS.map((c) => `"${c}"`).join(', ')}",
  "notes": "string or null — anything else worth keeping",
  "suggestedPageCount": number — 1 for a simple single-page landing site, 3-6 for a typical multi-service contractor, up to 10 only when the brief explicitly asks for many pages (FAQ, gallery, service areas, etc.)
}

INDUSTRIES (pick exactly one label):
${industryLabels.join('\n')}

Rules:
- For concrete, masonry, hardscaping, pavers → industryLabel should be "Concrete & Masonry" (or closest catalog match).
- For medical/chiropractic/dental/clinic → pick the matching medical/wellness industry from the list.
- services must reflect what the brief actually offers, not unrelated defaults.
- suggestedPageCount defaults to 3-4 for established multi-service trades unless the brief says "single page" or "landing page only".`

  const { text } = await generateTextWithFallback({
    systemPrompt,
    prompt: trimmed,
    jsonMode: true,
    temperature: 0.3,
    maxOutputTokens: 4096,
  })

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Could not parse the business description — please try again.')
  }

  const rawServices = Array.isArray(parsed.services)
    ? parsed.services.filter((s): s is string => typeof s === 'string')
    : []

  const industryLabel = resolveIndustryLabel(
    typeof parsed.industryLabel === 'string' ? parsed.industryLabel : undefined,
    rawServices
  )
  const industrySlug = resolveIndustrySlug({ industry: industryLabel, services: rawServices })
  const services = matchServicesToCatalog(rawServices, industrySlug)

  const businessName =
    typeof parsed.businessName === 'string' && parsed.businessName.trim()
      ? parsed.businessName.trim()
      : industryLabel

  const presentation = resolveSitePresentationRules({
    industry: industryLabel,
    business_name: businessName,
    services,
    service_area: typeof parsed.serviceArea === 'string' ? parsed.serviceArea : undefined,
    vibe: typeof parsed.vibe === 'string' ? parsed.vibe : undefined,
    tone: typeof parsed.tone === 'string' ? parsed.tone : undefined,
    customers: typeof parsed.customers === 'string' ? parsed.customers : undefined,
    experience: typeof parsed.experience === 'string' ? parsed.experience : undefined,
    differentiators: Array.isArray(parsed.differentiators)
      ? parsed.differentiators.filter((d): d is string => typeof d === 'string')
      : undefined,
    primary_cta: typeof parsed.primaryCta === 'string' ? parsed.primaryCta : undefined,
    notes: typeof parsed.notes === 'string' ? parsed.notes : undefined,
  })

  let suggestedPageCount =
    typeof parsed.suggestedPageCount === 'number' && Number.isFinite(parsed.suggestedPageCount)
      ? Math.round(parsed.suggestedPageCount)
      : 4
  suggestedPageCount = Math.min(10, Math.max(1, suggestedPageCount))

  return {
    industryLabel,
    industrySlug,
    businessName,
    services,
    serviceArea: typeof parsed.serviceArea === 'string' ? parsed.serviceArea.trim() : undefined,
    vibe: typeof parsed.vibe === 'string' ? parsed.vibe : undefined,
    tone: typeof parsed.tone === 'string' ? parsed.tone : undefined,
    customers: typeof parsed.customers === 'string' ? parsed.customers : undefined,
    experience: typeof parsed.experience === 'string' ? parsed.experience : undefined,
    differentiators: Array.isArray(parsed.differentiators)
      ? parsed.differentiators.filter((d): d is string => typeof d === 'string')
      : undefined,
    primaryCta: typeof parsed.primaryCta === 'string' ? parsed.primaryCta : undefined,
    notes: typeof parsed.notes === 'string' ? parsed.notes : undefined,
    theme: presentation.theme,
    layoutStyle: presentation.layoutStyle,
    engagementModel: presentation.engagementModel,
    defaultRoom: presentation.defaultRoom,
    suggestedPageCount,
    description: trimmed,
  }
}
