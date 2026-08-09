/**
 * Spec builds — the unattended "we already built your site" outreach pipeline.
 *
 * A spec build turns a cold lead with no website into a finished AI-Premium
 * site with no human input, parks it for admin review, then offers it to the
 * owner by SMS at a discount with a deadline. It does this by reusing the
 * existing intake pipeline rather than duplicating it: the pipeline fills in a
 * `prospect_intakes` row exactly as a prospect would, then hands off to the
 * same provision → redesign → validate path a paying customer gets.
 */

export const SPEC_BUILD_STATUSES = [
  'queued',
  'researching',
  'drafting',
  'imaging',
  'provisioning',
  'building',
  'ready_for_review',
  'needs_attention',
  'rejected',
  'approved',
  'offer_sent',
  'offer_reminded',
  'accepted',
  'declined',
  'expired',
  'purged',
] as const

export type SpecBuildStatus = (typeof SPEC_BUILD_STATUSES)[number]

/** States where the pipeline is actively working and spending money. */
export const SPEC_BUILD_IN_FLIGHT_STATUSES = [
  'researching',
  'drafting',
  'imaging',
  'provisioning',
  'building',
] as const satisfies readonly SpecBuildStatus[]

/**
 * States where the lead is done with — a new build for the same phone number is
 * allowed again. Mirrors the partial unique index in the migration; the two
 * must not drift, which is what the test in specBuilds.test.ts checks.
 */
export const SPEC_BUILD_CLOSED_STATUSES = [
  'rejected',
  'declined',
  'expired',
  'purged',
] as const satisfies readonly SpecBuildStatus[]

export type SpecBuildLeadSource = 'scraper' | 'manual'

/**
 * A single claim about the business, with the evidence that backs it.
 *
 * The whole non-fabrication guarantee rests on `evidence`: it must be an exact
 * substring of the page text the extractor was given. A model that invents a
 * fact cannot also produce matching evidence, so verification is mechanical
 * rather than a matter of trusting the prompt.
 */
export type SpecFactSourceKind =
  | 'maps_listing'
  | 'maps_review'
  | 'facebook_about'
  | 'facebook_post'
  | 'admin_manual'

export type SpecFact = {
  /** The `prospect_intakes` column this fact fills. */
  field: string
  value: string
  /** Exact substring of the fetched page text. Verified, never trusted. */
  evidence: string
  sourceUrl: string
  sourceKind: SpecFactSourceKind
  capturedAt: string
  /** True when `value` is character-for-character the evidence. */
  verbatim: boolean
}

export type SpecBuildResearch = {
  facts?: SpecFact[]
  /** URLs fetched, so the admin can see what was looked at even if it yielded nothing. */
  fetched?: { url: string; sourceKind: SpecFactSourceKind; chars: number; error?: string }[]
}

export type SpecBuildRow = {
  id: string
  status: SpecBuildStatus
  lead_source: SpecBuildLeadSource
  scraper_lead_id: string | null
  scraper_run_id: string | null
  lead_input: SpecBuildLeadInput
  business_name: string
  phone_e164: string
  city: string | null
  intake_id: string | null
  tenant_id: string | null
  placeholder_owner_email: string | null
  research: SpecBuildResearch
  research_at: string | null
  offer_token: string | null
  offer_total_cents: number | null
  offer_discount_bps: number
  offer_deadline_at: string | null
  offer_sent_at: string | null
  offer_reminded_at: string | null
  responded_at: string | null
  purge_after: string | null
  attempts: number
  last_error: string | null
  status_reason: string | null
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
}

/**
 * The minimum a lead needs to enter the queue, from either source. A scraper
 * lead carries more (rating, categories, Maps URL); a yard-sign lead may carry
 * only the first two fields.
 */
export type SpecBuildLeadInput = {
  businessName: string
  phone: string
  services?: string[]
  city?: string | null
  email?: string | null
  socialProfileUrl?: string | null
  mapsPlaceUrl?: string | null
  businessCategory?: string | null
  businessDescription?: string | null
  address?: string | null
  ratingValue?: number | null
  reviewCount?: number | null
}

export const SPEC_BUILD_SELECT = `
  id, status, lead_source, scraper_lead_id, scraper_run_id, lead_input,
  business_name, phone_e164, city, intake_id, tenant_id, placeholder_owner_email,
  research, research_at, offer_token, offer_total_cents, offer_discount_bps,
  offer_deadline_at, offer_sent_at, offer_reminded_at, responded_at, purge_after,
  attempts, last_error, status_reason, approved_by, approved_at,
  created_at, updated_at
`
