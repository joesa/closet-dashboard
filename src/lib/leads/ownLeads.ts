import { getSupabaseServer } from '@/lib/supabase-server'

/**
 * A contractor's own leads, read through their session.
 *
 * Deliberately uses the request-scoped anon client rather than the service
 * role: the `leads_owner_read` policy (20260523210000_admin_phase1.sql:142)
 * scopes rows to the contractor whose `user_id` matches `auth.uid()`, and that
 * policy is the only thing standing between one contractor and another's
 * customer list. Reading with the service role here would bypass it and move
 * that guarantee into application code, where a forgotten `.eq()` becomes a
 * data leak. The policy was written for a screen that was never built; this is
 * that screen, so it is finally exercised.
 */

export type LeadRow = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  message: string | null
  room_type: string | null
  finish_type: string | null
  linear_feet: number | null
  estimated_total: number | null
  range_low: number | null
  range_high: number | null
  add_ons: unknown
  source_origin: string | null
  created_at: string
}

export type OwnLeadsResult =
  | { ok: true; leads: LeadRow[]; totalValue: number; last30: number; asOf: number }
  | { ok: false; error: string }

export async function loadOwnLeads(limit = 200): Promise<OwnLeadsResult> {
  const supabase = await getSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Sign in to see your leads.' }

  const { data, error } = await supabase
    .from('leads')
    .select(
      'id, first_name, last_name, email, phone, message, room_type, finish_type, linear_feet, estimated_total, range_low, range_high, add_ons, source_origin, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return { ok: false, error: error.message }

  const leads = (data ?? []) as LeadRow[]
  const totalValue = leads.reduce((sum, lead) => sum + (Number(lead.estimated_total) || 0), 0)
  // Counted here rather than in the page: a server component may not call
  // Date.now() during render, and this is data, not presentation.
  const cutoff = Date.now() - 30 * 86_400_000
  const last30 = leads.filter((lead) => new Date(lead.created_at).getTime() >= cutoff).length
  // The render is a pure function of this result, so the clock reading belongs
  // here — in async server code — not in the component.
  return { ok: true, leads, totalValue, last30, asOf: Date.now() }
}

/** Display name for a lead, falling back to the email local-part. */
export function leadName(lead: LeadRow): string {
  const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim()
  if (name) return name
  if (lead.email) return lead.email.split('@')[0]
  return 'Unnamed lead'
}
