import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  buildFactLedger,
  parseFactLedger,
  renderFactsBrief,
} from '@/lib/intake/factLedger'
import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'

/**
 * The owner's facts, addressed by tenant rather than by intake token.
 *
 * The Full redesign runs against a tenant and never had a route back to the
 * intake that created it, which is why every shipped site was designed from a
 * 900-character summary of a summary. `prospect_intakes.provisioned_contractor_id`
 * is that route — it is written by provisioning (provisionTenant.ts:1442,
 * provisionFromIntake.ts:278) and is the only link between the two halves.
 *
 * Falls back to building the ledger on the fly for intakes submitted before the
 * ledger existed, so this works without a backfill.
 */
export async function loadFactsBriefForTenant(tenantId: string): Promise<string> {
  try {
    return await readFactsBrief(tenantId)
  } catch (err) {
    // Facts enrich the build; they are never a precondition for it. A lookup
    // that throws must not take down auto-launch, which is the only thing
    // standing between a provisioned tenant and a published site.
    console.warn('[factsBrief] unavailable', tenantId, err instanceof Error ? err.message : err)
    return ''
  }
}

async function readFactsBrief(tenantId: string): Promise<string> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('prospect_intakes')
    .select('*')
    .eq('provisioned_contractor_id', tenantId)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.warn('[factsBrief] lookup failed', tenantId, error.message)
    return ''
  }
  if (!data) return ''

  const row = data as ProspectIntakeRow & { fact_ledger?: unknown }
  const ledger = parseFactLedger(row.fact_ledger) ?? buildFactLedger(row)
  return renderFactsBrief(ledger)
}
