/**
 * Which existing tenants were provisioned with the wrong industry, and what
 * their widget would say if resolved today.
 *
 *   npx tsx -r dotenv/config scripts/audit-industry-resolution.ts dotenv_config_path=.env.local
 *   ... --apply-drafts     write the corrected units to NOT-YET-LIVE tenants only
 *   ... --apply-live       also write to live (active) tenants — ask the client first
 *
 * Background: resolveIndustrySlug used to end with `?? 'custom-closets'`, and
 * provisioning reads INDUSTRY_CONFIGS off that slug, so any trade the catalog
 * did not recognise was quoted in Linear Feet, per Room, with a Finish tier.
 * The resolver is fixed going forward; this is the report for what already
 * shipped. Default is dry-run: changing the units on a live quote form is a
 * customer-visible act, not a cleanup.
 */
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { INDUSTRY_CONFIGS, resolveIndustrySlug, isLowConfidenceResolution } from '@/lib/catalog/serviceCatalog'
import type { IndustrySlug } from '@/lib/catalog/types'

type Row = {
  id: string
  company_name: string | null
  industry: string | null
  domain_config: Record<string, unknown> | null
}

/**
 * Resolution is driven by the INTAKE (industry text + the services the owner
 * picked), not by contractor_settings.industry. That column is a signup default
 * on most rows — 153 tenants carry "Custom Closets" there while their widget is
 * correctly quoting Roof Size or Visits — so trusting it would push good
 * widgets BACK to closet units. The intake is what provisioning actually read.
 */

const LIVE_STATUSES = new Set(['active'])

async function main() {
  const applyDrafts = process.argv.includes('--apply-drafts')
  const applyLive = process.argv.includes('--apply-live')
  const db = getSupabaseAdmin()

  const { data: settings, error } = await db
    .from('contractor_settings')
    .select('id,company_name,industry,domain_config')
  if (error) throw new Error(error.message)
  const settingsById = new Map((settings ?? []).map((r) => [r.id as string, r as Row]))

  const { data: tenants } = await db.from('tenants').select('id,site_status')
  const statusById = new Map((tenants ?? []).map((t) => [t.id as string, String(t.site_status)]))

  const { data: intakes } = await db
    .from('prospect_intakes')
    .select('business_name,industry,services,other_services,provisioned_contractor_id')
    .not('provisioned_contractor_id', 'is', null)

  const drift: Array<{
    row: Row
    status: string
    slug: IndustrySlug
    lowConfidence: boolean
    was: string
    now: string
  }> = []

  for (const intake of intakes ?? []) {
    const row = settingsById.get(intake.provisioned_contractor_id as string)
    if (!row) continue
    const signal = {
      industry: intake.industry as string | null,
      services: intake.services as string[] | null,
      other_services: intake.other_services as string | null,
    }
    const slug = resolveIndustrySlug(signal)
    const lowConfidence = isLowConfidenceResolution(signal)
    const config = INDUSTRY_CONFIGS[slug]
    const was = String(row.domain_config?.unitLabel ?? '(none)')
    const now = config.unitLabel
    if (was !== now) {
      drift.push({
        row,
        status: statusById.get(row.id) ?? 'unknown',
        slug,
        lowConfidence,
        was,
        now,
      })
    }
  }

  console.log(`provisioned tenants with an intake: ${intakes?.length ?? 0}`)
  console.log(`rows whose widget units disagree with today's resolution: ${drift.length}\n`)

  for (const d of drift.sort((a, b) => a.status.localeCompare(b.status))) {
    const live = LIVE_STATUSES.has(d.status) ? 'LIVE ' : '     '
    const flag = d.lowConfidence ? '  (no catalog signal — was defaulting to closets)' : ''
    console.log(
      `${live}${d.status.padEnd(24)} ${String(d.row.company_name).slice(0, 28).padEnd(30)} ` +
      `${String(d.row.industry).slice(0, 26).padEnd(28)} ${d.was} → ${d.now}  [${d.slug}]${flag}`
    )
  }

  if (!applyDrafts && !applyLive) {
    console.log('\nDry run. Re-run with --apply-drafts to correct the not-yet-live tenants.')
    return
  }

  let written = 0
  for (const d of drift) {
    const isLive = LIVE_STATUSES.has(d.status)
    if (isLive && !applyLive) continue
    if (!isLive && !applyDrafts) continue
    const config = INDUSTRY_CONFIGS[d.slug]
    const next = {
      ...(d.row.domain_config ?? {}),
      categoryLabel: config.categoryLabel,
      unitLabel: config.unitLabel,
      unitAbbrev: config.unitAbbrev,
      tierLabel: config.tierLabel,
    }
    const { error: writeError } = await db
      .from('contractor_settings')
      .update({ domain_config: next })
      .eq('id', d.row.id)
    if (writeError) {
      console.error(`  FAILED ${d.row.company_name}: ${writeError.message}`)
      continue
    }
    written += 1
    console.log(`  updated ${d.row.company_name} → ${config.unitLabel} / ${config.tierLabel}`)
  }
  console.log(`\nWrote ${written} row(s).`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
