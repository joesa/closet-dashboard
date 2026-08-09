import { normalizePhone } from '@/lib/twilio-sms'
import { specBuildMaxServices } from '@/lib/spec/specBuilds'
import type { SpecBuildLeadInput } from '@/lib/spec/types'

/**
 * Which scraped leads are worth building a spec site for.
 *
 * The target is a business with no web presence to lose: `outreachRank === 'B1'`
 * is exactly that population (see computeOutreachRank in the scraper —
 * PIPELINE_B with reason 'missing_website'). B2 means they have a site that
 * merely failed to load, and building a replacement for a business that already
 * has one is both wasted spend and a worse pitch.
 *
 * A phone number is non-negotiable: SMS is the only channel this pipeline
 * delivers on, so a lead we cannot text is a site we can never show anyone.
 */
export type ScrapedLeadShape = {
  business_name?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  address?: string | null
  pipeline?: string | null
  outreach_rank?: string | null
  has_own_website?: boolean | null
  business_category?: string | null
  business_description?: string | null
  services_provided?: string[] | null
  additional_categories?: string[] | null
  social_profile_url?: string | null
}

export type LeadQualification =
  | { qualified: true; lead: SpecBuildLeadInput }
  | { qualified: false; reason: string }

export function qualifyLeadForSpecBuild(row: ScrapedLeadShape): LeadQualification {
  const businessName = row.business_name?.trim()
  if (!businessName) return { qualified: false, reason: 'no_business_name' }

  if (row.has_own_website === true) return { qualified: false, reason: 'has_own_website' }
  if (row.website?.trim()) return { qualified: false, reason: 'has_own_website' }

  const rank = row.outreach_rank?.trim().toUpperCase()
  if (rank !== 'B1') return { qualified: false, reason: `outreach_rank_${rank || 'missing'}` }

  const phone = normalizePhone(row.phone || '')
  if (!phone) return { qualified: false, reason: 'no_phone' }

  return {
    qualified: true,
    lead: {
      businessName,
      phone,
      services: resolveServices(row),
      city: cityFromAddress(row.address),
      email: row.email?.trim() || null,
      socialProfileUrl: row.social_profile_url?.trim() || null,
      businessCategory: row.business_category?.trim() || null,
      businessDescription: row.business_description?.trim() || null,
      address: row.address?.trim() || null,
    },
  }
}

/**
 * Services drive one generated product image each, so this is a direct cost
 * multiplier — clamped rather than taken wholesale from a Maps listing that can
 * carry a dozen categories.
 */
function resolveServices(row: ScrapedLeadShape): string[] {
  const provided = (row.services_provided ?? []).map((s) => s?.trim()).filter(Boolean) as string[]
  const fallback = [row.business_category, ...(row.additional_categories ?? [])]
    .map((s) => s?.trim())
    .filter(Boolean) as string[]
  const services = provided.length > 0 ? provided : fallback
  return dedupeCaseInsensitive(services).slice(0, specBuildMaxServices())
}

function dedupeCaseInsensitive(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(value)
  }
  return out
}

/**
 * The scraper stores a single-line US address; the locality is the
 * second-to-last comma field ("8428 Rivermont Dr, Clarksville, TN 37043").
 * Returns null rather than guessing when the shape does not match — a wrong
 * city would end up in site copy.
 */
export function cityFromAddress(address?: string | null): string | null {
  if (!address?.trim()) return null
  const parts = address
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length < 3) return null
  return parts[parts.length - 2] || null
}
