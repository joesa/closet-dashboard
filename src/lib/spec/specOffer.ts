import { randomUUID } from 'node:crypto'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { formatUsd, getTierEntry } from '@/lib/intake/tiers'
import { publicAppOrigin } from '@/lib/urls'
import { mintSpecPreviewToken } from '@/lib/spec/specPreviewToken'
import type { SpecBuildRow } from '@/lib/spec/types'

/**
 * The offer: a finished site, half price, and a deadline after which it is
 * deleted.
 *
 * Deliberately time-boxed. A spec site carries a real business's name and
 * photos on our infrastructure without their agreement, so "we take it down if
 * you're not interested" is not only a sales device — it is the promise that
 * makes building it defensible in the first place, and the purge cron is what
 * keeps it.
 */

export function offerDiscountBps(): number {
  const raw = parseInt(process.env.SPEC_OFFER_DISCOUNT_BPS || '5000', 10)
  return Number.isFinite(raw) && raw > 0 && raw < 10000 ? raw : 5000
}

export function offerDeadlineHours(): number {
  const raw = parseInt(process.env.SPEC_OFFER_DEADLINE_HOURS || '168', 10)
  return Number.isFinite(raw) && raw > 0 ? raw : 168
}

export function offerReminderHours(): number {
  const raw = parseInt(process.env.SPEC_OFFER_REMINDER_HOURS || '24', 10)
  return Number.isFinite(raw) && raw > 0 ? raw : 24
}

export function purgeGraceHours(): number {
  const raw = parseInt(process.env.SPEC_PURGE_GRACE_HOURS || '24', 10)
  return Number.isFinite(raw) && raw >= 0 ? raw : 24
}

export type OfferPricing = {
  listCents: number
  offerCents: number
  listLabel: string
  offerLabel: string
  percentOff: number
}

/**
 * Price the offer off the live catalog, not a stored number, so a change to
 * INTAKE_TIER_AI_PREMIUM_CENTS cannot leave the SMS quoting one figure while
 * Stripe charges another.
 */
export function priceSpecOffer(discountBps = offerDiscountBps()): OfferPricing {
  const premium = getTierEntry('ai_premium')
  const listCents = premium?.totalCents ?? 0
  const offerCents = Math.round((listCents * (10000 - discountBps)) / 10000)
  return {
    listCents,
    offerCents,
    listLabel: formatUsd(listCents),
    offerLabel: formatUsd(offerCents),
    percentOff: Math.round(discountBps / 100),
  }
}

export function offerUrl(token: string, origin?: string): string {
  return `${publicAppOrigin(origin).replace(/\/$/, '')}/offer/${token}`
}

/** The prospect's own site, behind a tenant-scoped, expiring token. */
export function specPreviewUrl(hostname: string, tenantId: string): string {
  const token = mintSpecPreviewToken(tenantId)
  return `https://${hostname}?spec_preview_token=${encodeURIComponent(token)}`
}

/**
 * Expire an offer whose deadline has passed, and report the effective status.
 *
 * Called on read from /offer/[token] as well as by the cron, so the page tells
 * the truth even if the cron is down or delayed — which matters more now that
 * the cron runs once a day rather than every half hour.
 *
 * Lives here rather than in the page because it is a state transition, not
 * view logic. It also keeps `Date.now()` out of a Server Component's render,
 * which the react-hooks/purity rule rightly rejects.
 */
export async function expireOfferIfLapsed(build: {
  id: string
  status: string
  offer_deadline_at: string | null
}): Promise<string> {
  const OPEN = ['offer_sent', 'offer_reminded', 'approved']
  if (!build.offer_deadline_at || !OPEN.includes(build.status)) return build.status
  if (new Date(build.offer_deadline_at).getTime() >= Date.now()) return build.status

  await getSupabaseAdmin()
    .from('spec_builds')
    .update({
      status: 'expired',
      purge_after: new Date(Date.now() + purgeGraceHours() * 3600_000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', build.id)
    .in('status', OPEN)

  return 'expired'
}

export type ApproveOfferResult =
  | { ok: true; offerToken: string; deadlineAt: string; pricing: OfferPricing }
  | { ok: false; reason: string }

/**
 * Admin approval: mint the offer, set the clock running.
 *
 * Refuses unless site validation passed. Approval is the last gate before a
 * real business is contacted, and a site that failed its own QA is not one to
 * put in front of an owner — that check is why the admin step exists at all.
 */
export async function approveSpecOffer(build: SpecBuildRow): Promise<ApproveOfferResult> {
  if (build.status !== 'ready_for_review') {
    return { ok: false, reason: `Only a build in review can be approved (this one is ${build.status}).` }
  }
  if (!build.tenant_id) {
    return { ok: false, reason: 'No site has been provisioned for this build yet.' }
  }

  const supabase = getSupabaseAdmin()
  const { data: tenant } = await supabase
    .from('tenants')
    .select('validation_status')
    .eq('id', build.tenant_id)
    .maybeSingle()

  const validation = (tenant as { validation_status?: string } | null)?.validation_status
  if (validation !== 'passed') {
    return {
      ok: false,
      reason: `Site validation is "${validation ?? 'unknown'}". Fix the site before offering it to anyone.`,
    }
  }

  const pricing = priceSpecOffer(build.offer_discount_bps || offerDiscountBps())
  if (pricing.offerCents <= 0) {
    return { ok: false, reason: 'Could not price the offer — check the AI Premium tier config.' }
  }

  const offerToken = randomUUID().replace(/-/g, '')
  const deadlineAt = new Date(Date.now() + offerDeadlineHours() * 3600_000).toISOString()

  const { error } = await supabase
    .from('spec_builds')
    .update({
      status: 'approved',
      offer_token: offerToken,
      offer_total_cents: pricing.offerCents,
      offer_deadline_at: deadlineAt,
      approved_at: new Date().toISOString(),
      status_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', build.id)
    .eq('status', 'ready_for_review')

  if (error) return { ok: false, reason: error.message }
  return { ok: true, offerToken, deadlineAt, pricing }
}
