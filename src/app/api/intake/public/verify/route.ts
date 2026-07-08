import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getIntakeByToken, type ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'
import { createIntakeCheckoutSession } from '@/lib/intake/createIntakeCheckout'
import {
  depositStatusForTier,
  getTierEntry,
  type IntakeTierSlug,
} from '@/lib/intake/tiers'
import { hasPaidPremiumDeposit } from '@/lib/intake/intakeTierGates'

export const runtime = 'nodejs'

function siteOrigin(req: Request): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    new URL(req.url).origin
  )
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')?.trim()
  const tierParam = url.searchParams.get('tier')
  const tier: IntakeTierSlug | null =
    tierParam === 'ai_premium' ? 'ai_premium' : tierParam === 'standard' ? 'standard' : null

  if (!token) {
    return NextResponse.redirect(`${siteOrigin(req)}/get-started?error=missing_token`)
  }

  const origin = siteOrigin(req)
  const row = await getIntakeByToken(token)
  if (!row) {
    return NextResponse.redirect(`${origin}/get-started?error=invalid_token`)
  }
  if (row.status === 'archived') {
    return NextResponse.redirect(`${origin}/get-started?error=archived`)
  }

  const nowIso = new Date().toISOString()
  const patch: Record<string, unknown> = {
    email_verified_at: row.email_verified_at || nowIso,
    updated_at: nowIso,
  }

  // Selecting a tier straight from the email pre-applies it (and its deposit
  // requirement) before the prospect ever lands on the form. Always
  // (re)apply the catalog entry when a tier is given — the DB defaults
  // `intake_tier` to 'standard' with `tier_total_cents: 0` for rows that
  // never went through an explicit tier selection, so comparing against
  // `row.intake_tier` alone would skip populating the totals when the
  // requested tier happens to match that default.
  let updatedRow: ProspectIntakeRow = { ...row, email_verified_at: patch.email_verified_at as string }
  if (tier) {
    // Never downgrade to Standard once the prospect has paid the AI Premium
    // deposit — re-clicking a generic verify link must not revoke AI access.
    const effectiveTier: IntakeTierSlug =
      tier === 'standard' && hasPaidPremiumDeposit(row) ? 'ai_premium' : tier
    const entry = getTierEntry(effectiveTier)
    if (entry) {
      const depositStatus = depositStatusForTier(effectiveTier, row.deposit_paid_cents, entry.depositCents)
      patch.intake_tier = effectiveTier
      patch.tier_total_cents = entry.totalCents
      patch.deposit_required_cents = entry.depositCents
      patch.deposit_status = depositStatus
      // Chose a tier straight from the email link — don't make them pick
      // again on the form (see tier_selected_at column comment).
      patch.tier_selected_at = row.tier_selected_at || nowIso
      updatedRow = {
        ...updatedRow,
        intake_tier: effectiveTier,
        tier_total_cents: entry.totalCents,
        deposit_required_cents: entry.depositCents,
        deposit_status: depositStatus,
      }
    }
  }

  const admin = getSupabaseAdmin()
  await admin.from('prospect_intakes').update(patch).eq('id', row.id)

  // AI Premium requires a 30% deposit — send the prospect straight to Stripe
  // Checkout so "confirm email" and "pay deposit" happen in one click. On
  // success, Stripe returns to the intake form, which will already show the
  // deposit as paid (no "Pay 30% deposit to continue" box).
  if (
    updatedRow.intake_tier === 'ai_premium' &&
    updatedRow.deposit_status !== 'paid' &&
    updatedRow.deposit_required_cents > 0
  ) {
    try {
      const { url: checkoutUrl } = await createIntakeCheckoutSession({
        row: updatedRow,
        token,
        kind: 'deposit',
        origin,
      })
      return NextResponse.redirect(checkoutUrl)
    } catch (error) {
      console.error('intake verify+pay checkout error:', error)
      // Fall through so the prospect still reaches the form even if Stripe
      // checkout couldn't be created (e.g. missing price config).
    }
  }

  const tierQuery = tier
    ? `&tier=${tier === 'standard' && hasPaidPremiumDeposit(row) ? 'ai_premium' : tier}`
    : ''
  return NextResponse.redirect(`${origin}/intake/${token}?verified=1${tierQuery}`)
}

