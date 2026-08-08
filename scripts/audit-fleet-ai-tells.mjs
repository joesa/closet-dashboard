#!/usr/bin/env npx tsx
/**
 * Fleet-wide AI-tell audit (Phase 5 of plan-eliminateAiTells).
 *
 * Iterates every tenant, runs the shared copy-quality checks (AI-tell phrases,
 * placeholders, em dashes in short copy, formulaic titles, the specificity
 * gate, tone balance) over each tenant's site_configs copy — and, unless
 * --no-crawl is passed, the live homepage HTML — then writes a per-tenant
 * report as both JSON and markdown.
 *
 * READ-ONLY by design: this script never writes to the database. It is the
 * remediation *input* for legacy tenants (provisioned before the copy gate
 * cutoff); actual fixes go through autoFixTenantSite or manual edits, per
 * tenant, after review.
 *
 * Usage:
 *   npx tsx scripts/audit-fleet-ai-tells.mjs             # full audit + crawl
 *   npx tsx scripts/audit-fleet-ai-tells.mjs --no-crawl  # config copy only
 *   npx tsx scripts/audit-fleet-ai-tells.mjs --tenant <id>  # single tenant
 *   npx tsx scripts/audit-fleet-ai-tells.mjs --all       # include non-live tenants
 *
 * Output: audit-output/ai-tell-audit-<date>.{json,md}
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import {
  findAiTellPhrases,
  findPlaceholderTells,
  hasEmDashInShortCopy,
  findFormulaicTitles,
} from '../src/lib/ai/humanCopyVoice'
import {
  analyzeSpecificity,
  analyzeToneBalance,
  stripToText,
} from '../src/lib/validation/specificityGate'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function loadEnvFile(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}
loadEnvFile(resolve(root, '.env.local'))

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (set in .env.local)')
  process.exit(1)
}
const supabase = createClient(supabaseUrl, supabaseKey)

const args = process.argv.slice(2)
const crawl = !args.includes('--no-crawl')
const includeAll = args.includes('--all')
const onlyTenant = args.includes('--tenant') ? args[args.indexOf('--tenant') + 1] : null

/** Keys whose string values are machine config, never customer-visible copy. */
const NON_COPY_KEY_RE =
  /(image|img|url|href|slug|icon|color|colour|font|id|key|src|path|video|room|hash|token|email|phone)$/i

/** Collect visible copy strings out of a config JSON blob, with a dot-path label. */
function collectCopyStrings(node, path, out) {
  if (typeof node === 'string') {
    const trimmed = node.trim()
    if (trimmed.length >= 3 && /[a-z]/i.test(trimmed)) out.push({ path, text: trimmed })
    return
  }
  if (Array.isArray(node)) {
    node.forEach((item, i) => collectCopyStrings(item, `${path}[${i}]`, out))
    return
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (NON_COPY_KEY_RE.test(key)) continue
      collectCopyStrings(value, path ? `${path}.${key}` : key, out)
    }
  }
}

const COPY_COLUMNS = [
  'hero_config',
  'about_config',
  'process_config',
  'products_config',
  'before_after_config',
  'seo_config',
  'pages_config',
  'quiz_config',
]

function pickCrawlHostname(domains) {
  const rows = Array.isArray(domains) ? domains : domains ? [domains] : []
  const usable = rows
    .map((d) => ({ hostname: d.hostname || '', isPrimary: !!d.is_primary }))
    .filter((d) => d.hostname && !/localhost|127\.0\.0\.1/.test(d.hostname))
  return (usable.find((d) => d.isPrimary) || usable[0])?.hostname || null
}

function addDirectTellFindings(findings, path, text) {
  for (const phrase of findAiTellPhrases(text)) {
    findings.push({ check: 'ai_tell_phrase', path, sample: phrase, text: text.slice(0, 140) })
  }
  for (const tell of findPlaceholderTells(text)) {
    findings.push({ check: 'placeholder', path, sample: tell, text: text.slice(0, 140) })
  }
  if (hasEmDashInShortCopy(text)) {
    findings.push({ check: 'em_dash_short_copy', path, sample: '—', text: text.slice(0, 140) })
  }
  for (const title of findFormulaicTitles(text)) {
    findings.push({ check: 'formulaic_title', path, sample: title, text: text.slice(0, 140) })
  }
}

async function fetchHomepage(hostname) {
  try {
    const res = await fetch(`https://${hostname}`, {
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return { html: null, note: `HTTP ${res.status}` }
    return { html: await res.text(), note: null }
  } catch (err) {
    return { html: null, note: err instanceof Error ? err.message : String(err) }
  }
}

async function auditTenant(tenant) {
  const config = Array.isArray(tenant.site_configs) ? tenant.site_configs[0] : tenant.site_configs
  const findings = []
  const businessName = (config?.brand_name || tenant.business_name || '').trim()

  // 1. Config copy: string-level checks with exact paths, so remediation knows
  // exactly which column/field to edit.
  const strings = []
  for (const column of COPY_COLUMNS) {
    if (config?.[column]) collectCopyStrings(config[column], column, strings)
  }
  // Custom-build sites carry their copy as page HTML in the artifact.
  const customPages = []
  const artifact = config?.custom_config || config?.custom_config_draft
  if (artifact && typeof artifact === 'object' && artifact.pages) {
    for (const [route, page] of Object.entries(artifact.pages)) {
      if (page?.html) customPages.push({ route, text: stripToText(page.html) })
    }
  }

  for (const { path, text } of strings) {
    addDirectTellFindings(findings, path, text)
  }

  // 2. Page-level specificity gate over config text, custom pages, and
  // (optionally) the crawled live homepage.
  const pages = []
  const configText = strings.map((s) => s.text).join(' \n ')
  if (configText.trim()) pages.push({ label: 'site_configs copy', text: configText })
  for (const page of customPages) pages.push({ label: `custom page ${page.route}`, text: page.text })

  let crawlNote = null
  if (crawl) {
    const hostname = pickCrawlHostname(tenant.domains)
    if (!hostname) {
      crawlNote = 'no public hostname'
    } else {
      const { html, note } = await fetchHomepage(hostname)
      crawlNote = note
      if (html) pages.push({ label: `live homepage (${hostname})`, text: stripToText(html) })
    }
  }

  for (const page of pages) {
    if (page.label.startsWith('live homepage') || page.label.startsWith('custom page')) {
      addDirectTellFindings(findings, page.label, page.text)
    }
    for (const finding of analyzeSpecificity({ text: page.text, businessName })) {
      findings.push({
        check: finding.code,
        path: page.label,
        sample: finding.samples.join('; ') || null,
        text: finding.message,
      })
    }
  }
  for (const finding of analyzeToneBalance(pages.map((p) => p.text))) {
    findings.push({ check: finding.code, path: 'whole site', sample: null, text: finding.message })
  }

  return {
    tenantId: tenant.id,
    businessName: tenant.business_name,
    siteStatus: tenant.site_status,
    createdAt: tenant.created_at,
    validationStatus: tenant.validation_status,
    crawlNote,
    findingCount: findings.length,
    findings,
  }
}

async function main() {
  let query = supabase
    .from('tenants')
    .select(
      `id, business_name, site_status, created_at, validation_status,
       domains ( hostname, is_primary ),
       site_configs ( brand_name, render_mode, custom_config, custom_config_draft, ${COPY_COLUMNS.join(', ')} )`
    )
    .order('created_at', { ascending: true })
  if (onlyTenant) query = query.eq('id', onlyTenant)
  else if (!includeAll) query = query.eq('site_status', 'active')

  const { data: tenants, error } = await query
  if (error) {
    console.error('Failed to fetch tenants:', error.message)
    process.exit(1)
  }
  console.log(`Auditing ${tenants.length} tenant(s)${crawl ? ' (with live crawl)' : ' (config only)'}...`)

  const results = []
  for (const tenant of tenants) {
    const result = await auditTenant(tenant)
    results.push(result)
    console.log(
      `  ${result.findingCount === 0 ? 'ok  ' : 'FAIL'} ${result.findingCount}\t${tenant.business_name || tenant.id}${result.crawlNote ? ` (crawl: ${result.crawlNote})` : ''}`
    )
  }

  const clean = results.filter((r) => r.findingCount === 0)
  const dirty = results.filter((r) => r.findingCount > 0).sort((a, b) => b.findingCount - a.findingCount)

  const date = new Date().toISOString().slice(0, 10)
  const outDir = resolve(root, 'audit-output')
  mkdirSync(outDir, { recursive: true })

  const jsonPath = resolve(outDir, `ai-tell-audit-${date}.json`)
  writeFileSync(jsonPath, JSON.stringify({ generatedAt: new Date().toISOString(), crawl, results }, null, 2))

  const md = []
  md.push(`# Fleet AI-tell audit — ${date}`)
  md.push('')
  md.push(`Audited ${results.length} tenants (${crawl ? 'config + live homepage' : 'config copy only'}).`)
  md.push(`Clean: ${clean.length}. With findings: ${dirty.length}.`)
  md.push('')
  md.push('This report is read-only remediation input. Fix paths: per-tenant auto-fix')
  md.push('(`autoFixTenantSite`, handles `ai_tell_phrase`), manual edits via admin site chat,')
  md.push('or regeneration. See docs/ai-tell-hardening.md.')
  md.push('')
  md.push('| Tenant | Status | Findings | Top checks |')
  md.push('|---|---|---|---|')
  for (const r of dirty) {
    const byCheck = {}
    for (const f of r.findings) byCheck[f.check] = (byCheck[f.check] || 0) + 1
    const top = Object.entries(byCheck)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([check, count]) => `${check}×${count}`)
      .join(', ')
    md.push(`| ${r.businessName || r.tenantId} | ${r.siteStatus || '?'} | ${r.findingCount} | ${top} |`)
  }
  md.push('')
  for (const r of dirty) {
    md.push(`## ${r.businessName || r.tenantId}`)
    md.push('')
    md.push(`- Tenant: \`${r.tenantId}\``)
    md.push(`- Site status: ${r.siteStatus || 'unknown'}; validation: ${r.validationStatus || 'unknown'}; created: ${r.createdAt || 'unknown'}`)
    if (r.crawlNote) md.push(`- Crawl note: ${r.crawlNote}`)
    md.push('')
    for (const f of r.findings) {
      md.push(`- **${f.check}** at \`${f.path}\`${f.sample ? ` — \`${f.sample}\`` : ''}`)
      md.push(`  > ${f.text}`)
    }
    md.push('')
  }
  const mdPath = resolve(outDir, `ai-tell-audit-${date}.md`)
  writeFileSync(mdPath, md.join('\n'))

  console.log(`\nClean: ${clean.length} / ${results.length}`)
  console.log(`JSON report: ${jsonPath}`)
  console.log(`Markdown report: ${mdPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
