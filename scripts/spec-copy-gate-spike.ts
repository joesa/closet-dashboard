/**
 * Phase 0 spike — does a site built from cold-lead data pass the copy gate?
 *
 * This is the single question that decides whether spec builds are viable.
 * `copy_no_proprietary_detail` fires when, with the business name and city
 * removed, nothing in the copy identifies the business: no measurement, no
 * named material, brand or place. It is flagged `fixable: false`, so
 * autoFixTenantSite cannot repair it — and it is error-severity for every
 * tenant created after COPY_ENFORCEMENT_CUTOFF_ISO. A cold lead has no
 * owner-supplied facts by construction, which is exactly the condition that
 * triggers it.
 *
 * Rather than provisioning real tenants (a full build per lead: images, a
 * multi-pass redesign, a live domain), this measures the same gate against the
 * generated copy directly. One Sonnet call per lead, no writes, no tenants, no
 * images. If the copy fails here it will fail after a redesign too — the
 * redesign rewrites presentation, not the facts it has to work with.
 *
 *   npx tsx --tsconfig worker/tsconfig.json scripts/spec-copy-gate-spike.ts --run
 *
 * Flags:
 *   --run          actually call the model (without it, prints the plan only)
 *   --limit N      how many leads to test (default 3)
 *   --lead <id>    test one specific scraper_leads row
 */
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { buildIntakeBrief } from '@/lib/intake/buildIntakeBrief'
import { generateSiteConfigFromInput } from '@/lib/ai/generateSiteConfig'
import { analyzeSpecificity, analyzeToneBalance } from '@/lib/validation/specificityGate'
import { qualifyLeadForSpecBuild, type ScrapedLeadShape } from '@/lib/spec/qualifyLead'
import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'

const args = process.argv.slice(2)
const flag = (name: string) => args.includes(name)
const value = (name: string) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

/**
 * Findings that actually block a launch. siteValidator marks every specificity
 * finding error-severity for new tenants but only `copy_ai_tell_phrase` as
 * fixable, so everything else here fails validation with no machine repair
 * available — which means autoApproveTenantSite leaves the site gated.
 */
const BLOCKING_CODES = new Set([
  'copy_no_proprietary_detail',
  'copy_uniform_positivity',
  'copy_decorative_stat',
])

const LIMIT = parseInt(value('--limit') || '3', 10)
const ONE_LEAD = value('--lead')
const EXECUTE = flag('--run')

/**
 * Build the intake row a spec build would produce: lead facts only. The
 * craft_* columns stay null because nothing verifiable fills them, which is
 * the whole point of the measurement.
 */
function intakeRowFromLead(lead: ReturnType<typeof qualifyLeadForSpecBuild>): ProspectIntakeRow {
  if (!lead.qualified) throw new Error('unqualified')
  const l = lead.lead
  return {
    business_name: l.businessName,
    industry: l.businessCategory ?? null,
    services: l.services ?? [],
    other_services: null,
    address_locality: l.city ?? null,
    service_area: l.city ?? null,
    contact_phone: l.phone,
    notes: l.businessDescription ?? null,
    // Everything below is what a real prospect fills in and a cold lead cannot.
    customer_quotes: null,
    craft_spec: null,
    shop_rule: null,
    local_conditions: null,
    crew_shape: null,
    client_artifact: null,
    recent_job: null,
    competitor_tell: null,
    timeline_facts: null,
    guarantee_terms: null,
    signature_materials: [],
    vibe: null,
    tone: null,
    customers: null,
    experience: null,
    differentiators: [],
    primary_cta: null,
    pricing_notes: null,
  } as unknown as ProspectIntakeRow
}

/** Every string in the generated bundle that becomes visible page copy. */
function copyFromSiteConfig(data: Record<string, unknown>): string[] {
  const pages: string[] = []
  const site = (data.siteConfig ?? {}) as Record<string, unknown>

  const hero = (site.hero ?? {}) as Record<string, string>
  const about = (site.about ?? {}) as Record<string, string>
  const home = [hero.headline, hero.subheadline, about.description]
    .filter(Boolean)
    .join('\n\n')
  if (home.trim()) pages.push(home)

  for (const page of (data.pagesConfig ?? []) as Record<string, unknown>[]) {
    const blocks = (page.content_blocks ?? []) as Record<string, unknown>[]
    const text = blocks
      .map((b) => [b.heading, b.body, b.text].filter((v) => typeof v === 'string').join(' '))
      .join('\n\n')
    const pageHero = (page.hero ?? {}) as Record<string, string>
    const whole = [pageHero.headline, text].filter(Boolean).join('\n\n')
    if (whole.trim()) pages.push(whole)
  }
  return pages
}

async function main() {
  const supabase = getSupabaseAdmin()

  let query = supabase
    .from('scraper_leads')
    .select(
      'id, business_name, phone, email, website, address, pipeline, outreach_rank, has_own_website, business_category, business_description, services_provided, additional_categories, social_profile_url'
    )
    .order('created_at', { ascending: false })
    .limit(200)
  if (ONE_LEAD) query = query.eq('id', ONE_LEAD)

  const { data, error } = await query
  if (error) throw error

  const candidates = (data ?? [])
    .map((row) => ({ row: row as ScrapedLeadShape, id: (row as { id: string }).id }))
    .map((c) => ({ ...c, qualified: qualifyLeadForSpecBuild(c.row) }))
    .filter((c) => c.qualified.qualified)
    .slice(0, LIMIT)

  if (candidates.length === 0) {
    console.log('No qualifying B1 leads found. Nothing to measure.')
    return
  }

  console.log(`Phase 0 copy-gate spike — ${candidates.length} lead(s)\n`)
  for (const c of candidates) {
    if (!c.qualified.qualified) continue
    console.log(`  • ${c.qualified.lead.businessName} (${c.qualified.lead.city ?? 'no city'})`)
    console.log(`    services: ${(c.qualified.lead.services ?? []).join(', ') || 'none'}`)
  }

  if (!EXECUTE) {
    console.log(
      `\nDry run. Add --run to call the model (${candidates.length} Sonnet call(s), no writes, no tenants, no images).`
    )
    return
  }

  console.log('\n' + '='.repeat(70))
  const summary: { name: string; findings: string[]; pages: number }[] = []

  for (const c of candidates) {
    if (!c.qualified.qualified) continue
    const name = c.qualified.lead.businessName
    process.stdout.write(`\n${name} … `)

    try {
      const row = intakeRowFromLead(c.qualified)
      const brief = buildIntakeBrief(row)
      if (!brief.trim()) {
        console.log('SKIP — empty brief')
        continue
      }

      const result = await generateSiteConfigFromInput(
        brief,
        null,
        null,
        c.qualified.lead.businessCategory ?? null
      )
      const pages = copyFromSiteConfig(result.data)
      const findings: string[] = []
      for (const page of pages) {
        for (const f of analyzeSpecificity({
          text: page,
          businessName: name,
          locality: c.qualified.lead.city,
        })) {
          findings.push(f.code)
        }
      }
      for (const f of analyzeToneBalance(pages)) findings.push(f.code)

      const blocking = findings.filter((f) => BLOCKING_CODES.has(f))
      console.log(
        blocking.length > 0 ? `FAIL — ${[...new Set(blocking)].join(', ')}` : 'PASS'
      )
      summary.push({ name, findings, pages: pages.length })
    } catch (err) {
      console.log(`ERROR — ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  console.log('\n' + '='.repeat(70))
  console.log('\nFindings by code:\n')
  const counts = new Map<string, number>()
  for (const s of summary) {
    for (const f of s.findings) counts.set(f, (counts.get(f) ?? 0) + 1)
  }
  if (counts.size === 0) console.log('  (none)')
  for (const [code, n] of [...counts].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  ${code}`)
  }

  const failed = summary.filter((s) => s.findings.some((f) => BLOCKING_CODES.has(f))).length
  const fixableOnly = summary.filter(
    (s) => !s.findings.some((f) => BLOCKING_CODES.has(f)) && s.findings.length > 0
  ).length

  console.log(
    `\nVERDICT: ${failed} of ${summary.length} leads produced copy with an unfixable finding.`
  )
  if (fixableOnly > 0) {
    console.log(
      `         ${fixableOnly} more had only machine-fixable findings (autoFixTenantSite handles those).`
    )
  }
  console.log(
    failed * 2 >= summary.length
      ? '\n  Most builds would fail the copy gate with no machine repair available.\n  Per the plan, stop and fix the copy strategy before building the pipeline —\n  richer research (Phase 2 tuned for proper nouns and measurements), a prompt\n  that requires an honest constraint, or ~2 minutes of human input per lead.'
      : '\n  The copy gate is survivable on cold-lead data. Proceed with Phase 2.'
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
