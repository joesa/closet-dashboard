#!/usr/bin/env npx tsx
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadEnvConfig } from '@next/env'
import { repairTenantCopyTells } from '../src/lib/validation/autoFixSiteIssues'

loadEnvConfig(process.cwd())

type AuditFinding = {
  check: string
  sample: string | null
  text: string
}

type AuditTenant = {
  tenantId: string
  businessName: string
  findings: AuditFinding[]
}

type AuditReport = { results: AuditTenant[] }

const SAFE_CHECKS = new Set([
  'ai_tell_phrase',
  'placeholder',
  'em_dash_short_copy',
  'formulaic_title',
])

function latestAuditPath(): string {
  const directory = resolve(process.cwd(), 'audit-output')
  const candidates = readdirSync(directory)
    .filter((name) => /^ai-tell-audit-\d{4}-\d{2}-\d{2}\.json$/.test(name))
    .sort()
  const latest = candidates.at(-1)
  if (!latest) throw new Error('No fleet audit JSON found. Run npm run audit:ai-tells first.')
  return resolve(directory, latest)
}

async function main() {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const mechanicalOnly = args.includes('--mechanical-only')
  const phrasesOnly = args.includes('--phrases-only')
  const tenantArg = args.indexOf('--tenant')
  const onlyTenant = tenantArg >= 0 ? args[tenantArg + 1] : null
  const auditArg = args.indexOf('--audit')
  const auditPath = auditArg >= 0 ? resolve(args[auditArg + 1]) : latestAuditPath()
  if (!existsSync(auditPath)) throw new Error(`Audit report not found: ${auditPath}`)

  const report = JSON.parse(readFileSync(auditPath, 'utf8')) as AuditReport
  const targets = report.results
    .filter((tenant) => !onlyTenant || tenant.tenantId === onlyTenant)
    .map((tenant) => ({
      ...tenant,
      samples: Array.from(
        new Set(
          tenant.findings
            .filter((finding) =>
              mechanicalOnly
                ? finding.check === 'em_dash_short_copy'
                : phrasesOnly
                  ? finding.check === 'ai_tell_phrase' || finding.check === 'formulaic_title'
                : SAFE_CHECKS.has(finding.check)
            )
            .map((finding) =>
              finding.check === 'em_dash_short_copy' ? '—' : finding.sample
            )
            .filter((sample): sample is string => typeof sample === 'string' && !!sample.trim())
        )
      ),
    }))
    .filter((tenant) => tenant.samples.length > 0)

  console.log(`${apply ? 'Applying' : 'Dry run for'} ${targets.length} tenant(s) from ${auditPath}`)
  for (const tenant of targets) {
    console.log(`  ${tenant.businessName}: ${tenant.samples.join('; ')}`)
    if (!apply) continue
    const result = await repairTenantCopyTells(tenant.tenantId, tenant.samples)
    console.log(`    fixed=${result.fixed.length} unfixed=${result.unfixed.length}`)
  }
  if (!apply) console.log('No database writes made. Re-run with --apply after reviewing this list.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})