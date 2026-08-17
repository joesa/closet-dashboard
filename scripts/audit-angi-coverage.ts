/**
 * Catalog coverage report against the Angi directory fixture.
 *
 *   npx tsx scripts/audit-angi-coverage.ts            # summary
 *   npx tsx scripts/audit-angi-coverage.ts --gaps     # plus every unmatched label
 *
 * The pass/fail floors live in src/lib/catalog/angiCoverage.test.ts; this is the
 * human-readable version for deciding what to add next.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  isLowConfidenceResolution,
  listIndustries,
  matchServiceDef,
  resolveIndustrySlug,
} from '@/lib/catalog/serviceCatalog'

const categories = readFileSync(
  join(__dirname, '..', 'src', 'lib', 'catalog', '__fixtures__', 'angi-categories.txt'),
  'utf8'
).split('\n').map((l) => l.trim()).filter(Boolean)

const rows = categories.map((label) => {
  const unresolved = isLowConfidenceResolution({ industry: label, services: [label] })
  const industry = unresolved ? null : resolveIndustrySlug({ industry: label, services: [label] })
  const service = matchServiceDef(label)?.label ?? null
  return { label, industry, service, unresolved }
})

const matched = rows.filter((r) => !r.unresolved && r.service)
const industryOnly = rows.filter((r) => !r.unresolved && !r.service)
const unresolved = rows.filter((r) => r.unresolved)
const pct = (n: number) => `${Math.round((n / rows.length) * 100)}%`

console.log(`Angi categories: ${rows.length}`)
console.log(`  fully matched   ${String(matched.length).padStart(3)}  ${pct(matched.length)}`)
console.log(`  industry only   ${String(industryOnly.length).padStart(3)}  ${pct(industryOnly.length)}`)
console.log(`  no signal       ${String(unresolved.length).padStart(3)}  ${pct(unresolved.length)}`)

const depths = listIndustries().map((i) => i.services.length).sort((a, b) => a - b)
console.log(`\nIndustries: ${depths.length}  services: ${depths.reduce((a, b) => a + b, 0)}`)
console.log(`  depth  min=${depths[0]}  median=${depths[Math.floor(depths.length / 2)]}  max=${depths[depths.length - 1]}  below8=${depths.filter((d) => d < 8).length}`)

if (process.argv.includes('--gaps')) {
  console.log('\nNo signal at all:')
  for (const r of unresolved) console.log(`  ${r.label}`)
  console.log('\nIndustry only (no service def):')
  for (const r of industryOnly) console.log(`  ${r.industry?.padEnd(30)} ${r.label}`)
}
