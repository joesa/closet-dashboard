import { getSupabaseAdmin } from '@/lib/supabase-admin'

/**
 * The numbers that justify the subscription.
 *
 * This exact calculation — leads divided by quotes started — already existed,
 * on the admin page (src/app/admin/contractors/[id]/page.tsx). The customer
 * paying the bill could not see it. That is the renewal argument, and it was
 * visible only to us.
 *
 * Counts are read with the service role because `quote_events` is not exposed
 * to contractors by RLS, and the caller has already been resolved to a specific
 * contractor id; every query here is scoped to that id.
 */

export type ContractorStats = {
  quotesStarted: number
  leadsCaptured: number
  /** Percentage, or null when nobody has used the calculator yet. */
  conversionRate: number | null
  pipelineValue: number
  leadsLast30: number
}

export async function loadContractorStats(contractorId: string): Promise<ContractorStats> {
  const admin = getSupabaseAdmin()
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()

  const [quotes, leads, recent, values] = await Promise.all([
    admin
      .from('quote_events')
      .select('id', { count: 'exact', head: true })
      .eq('contractor_id', contractorId),
    admin
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('contractor_id', contractorId),
    admin
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('contractor_id', contractorId)
      .gte('created_at', since),
    admin.from('leads').select('estimated_total').eq('contractor_id', contractorId),
  ])

  const quotesStarted = quotes.count ?? 0
  const leadsCaptured = leads.count ?? 0
  const pipelineValue = (values.data ?? []).reduce(
    (sum: number, row: { estimated_total?: number | null }) =>
      sum + (Number(row.estimated_total) || 0),
    0
  )

  return {
    quotesStarted,
    leadsCaptured,
    conversionRate: quotesStarted > 0 ? (leadsCaptured / quotesStarted) * 100 : null,
    pipelineValue,
    leadsLast30: recent.count ?? 0,
  }
}
