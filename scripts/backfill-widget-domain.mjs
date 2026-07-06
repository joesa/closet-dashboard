#!/usr/bin/env node
/**
 * Backfill widget domain config + default room visibility for existing tenants.
 *
 * Default mode is DRY RUN (no writes):
 *   node scripts/backfill-widget-domain.mjs
 *
 * Apply updates:
 *   node scripts/backfill-widget-domain.mjs --apply
 *
 * Optional filters:
 *   --tenant <id>   only process one contractor_settings.id
 *   --limit <n>     max candidates to process (after filtering)
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOM_TYPES = [
  'Walk-In Closet',
  'Reach-In Closet',
  'Garage',
  'Pantry & Wine',
  'Home Office',
  'Laundry Room',
  'Mudroom',
  'Entertainment Center',
  'Wall Beds',
  'Craft Room',
  'Home Library',
  'Kid Spaces',
  'Dressing Room',
  'Home Storage',
]

const DEFAULT_DOMAIN_CONFIG = {
  categoryLabel: 'Room',
  unitLabel: 'Linear Feet',
  unitAbbrev: 'ft',
  tierLabel: 'Finish',
  pricingModel: 'per_unit',
  unitMin: 5,
  unitMax: 250,
  baseFee: 0,
}

const GENERIC_SERVICE_DOMAIN_CONFIG = {
  ...DEFAULT_DOMAIN_CONFIG,
  categoryLabel: 'Service',
  unitLabel: 'Jobs / Units',
  unitAbbrev: 'qty',
  tierLabel: 'Package',
}

const INDUSTRY_KEYWORD_CONFIGS = [
  {
    match: /plumb|drain|sewer|water heater|tankless|pipe|faucet|toilet/i,
    config: {
      ...DEFAULT_DOMAIN_CONFIG,
      categoryLabel: 'Service',
      unitLabel: 'Project Scope',
      unitAbbrev: 'job',
      tierLabel: 'Package',
      pricingModel: 'flat_tiered',
      unitMin: 1,
      unitMax: 1,
    },
  },
  {
    match: /hvac|air condition|furnace|heat pump|duct|thermostat/i,
    config: {
      ...DEFAULT_DOMAIN_CONFIG,
      categoryLabel: 'Service',
      unitLabel: 'Project Scope',
      unitAbbrev: 'job',
      tierLabel: 'Package',
      pricingModel: 'flat_tiered',
      unitMin: 1,
      unitMax: 1,
    },
  },
  {
    match: /electri|panel|outlet|breaker|wiring|lighting/i,
    config: {
      ...DEFAULT_DOMAIN_CONFIG,
      categoryLabel: 'Service',
      unitLabel: 'Outlets / Fixtures',
      unitAbbrev: 'qty',
      tierLabel: 'Package',
    },
  },
  {
    match: /landscap|lawn|yard|turf|mulch|irrigation|sprinkler/i,
    config: {
      ...DEFAULT_DOMAIN_CONFIG,
      categoryLabel: 'Service',
      unitLabel: 'Area',
      unitAbbrev: 'sq ft',
      tierLabel: 'Frequency',
      unitMin: 100,
      unitMax: 10000,
    },
  },
  {
    match: /clean|maid|janitor|deep clean/i,
    config: {
      ...DEFAULT_DOMAIN_CONFIG,
      categoryLabel: 'Service',
      unitLabel: 'Rooms / Area',
      unitAbbrev: 'rooms',
      tierLabel: 'Frequency',
      unitMin: 1,
      unitMax: 20,
    },
  },
  {
    match: /towing|tow truck|roadside|lockout|jump start/i,
    config: {
      ...DEFAULT_DOMAIN_CONFIG,
      categoryLabel: 'Service Type',
      unitLabel: 'Distance',
      unitAbbrev: 'mi',
      tierLabel: 'Level',
      unitMin: 1,
      unitMax: 120,
      pricingModel: 'base_plus_distance',
      baseFee: 95,
    },
  },
]

function parseArgs(argv) {
  const out = { apply: false, tenant: null, limit: null, includeGeneric: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--apply') out.apply = true
    else if (arg === '--include-generic') out.includeGeneric = true
    else if (arg === '--tenant') out.tenant = argv[i + 1] || null
    else if (arg === '--limit') out.limit = Number(argv[i + 1]) || null
  }
  return out
}

function loadEnvLocal() {
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const root = resolve(__dirname, '..')
  const envPath = resolve(root, '.env.local')
  if (!existsSync(envPath)) return

  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!m) continue
    if (process.env[m[1]]) continue
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const ROOM_CANONICAL = new Map(ROOM_TYPES.map((r) => [normalize(r), r]))

function normalizeDomainConfig(value) {
  const out = { ...DEFAULT_DOMAIN_CONFIG }
  if (!value || typeof value !== 'object') return out
  const v = value
  if (typeof v.categoryLabel === 'string' && v.categoryLabel) out.categoryLabel = v.categoryLabel
  if (typeof v.unitLabel === 'string' && v.unitLabel) out.unitLabel = v.unitLabel
  if (typeof v.unitAbbrev === 'string' && v.unitAbbrev) out.unitAbbrev = v.unitAbbrev
  if (typeof v.tierLabel === 'string' && v.tierLabel) out.tierLabel = v.tierLabel
  if (typeof v.pricingModel === 'string' && v.pricingModel) out.pricingModel = v.pricingModel
  if (Number.isFinite(Number(v.unitMin))) out.unitMin = Number(v.unitMin)
  if (Number.isFinite(Number(v.unitMax))) out.unitMax = Number(v.unitMax)
  if (Number.isFinite(Number(v.baseFee))) out.baseFee = Number(v.baseFee)
  return out
}

function domainConfigNeedsUpdate(current, target) {
  return (
    current.categoryLabel !== target.categoryLabel ||
    current.unitLabel !== target.unitLabel ||
    current.unitAbbrev !== target.unitAbbrev ||
    current.tierLabel !== target.tierLabel ||
    current.pricingModel !== target.pricingModel ||
    current.unitMin !== target.unitMin ||
    current.unitMax !== target.unitMax ||
    current.baseFee !== target.baseFee
  )
}

function extractProductTitles(productsConfig) {
  if (!Array.isArray(productsConfig)) return []
  return productsConfig
    .map((p) => (p && typeof p === 'object' ? p.title : null))
    .filter((t) => typeof t === 'string' && t.trim().length > 0)
}

function inferDomainConfig(services, industryText) {
  const haystack = `${services.join(' | ')} | ${industryText || ''}`
  for (const entry of INDUSTRY_KEYWORD_CONFIGS) {
    if (entry.match.test(haystack)) {
      return { config: entry.config, matched: true }
    }
  }
  return { config: GENERIC_SERVICE_DOMAIN_CONFIG, matched: false }
}

function arrayEqual(a, b) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv.slice(2))

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let settingsQuery = supabase
    .from('contractor_settings')
    .select('id, company_name, industry, domain_config, disabled_default_rooms')

  if (args.tenant) settingsQuery = settingsQuery.eq('id', args.tenant)

  const { data: settingsRows, error: settingsError } = await settingsQuery
  if (settingsError) throw settingsError

  const { data: roomRows, error: roomError } = await supabase
    .from('contractor_rooms')
    .select('contractor_id, name')
  if (roomError) throw roomError

  const { data: siteRows, error: siteError } = await supabase
    .from('site_configs')
    .select('tenant_id, products_config, updated_at')
    .order('updated_at', { ascending: false })
  if (siteError) throw siteError

  const roomsByContractor = new Map()
  for (const row of roomRows || []) {
    if (!row?.contractor_id || !row?.name) continue
    if (!roomsByContractor.has(row.contractor_id)) roomsByContractor.set(row.contractor_id, [])
    roomsByContractor.get(row.contractor_id).push(String(row.name))
  }

  const latestSiteByTenant = new Map()
  for (const row of siteRows || []) {
    if (!row?.tenant_id) continue
    if (latestSiteByTenant.has(row.tenant_id)) continue
    latestSiteByTenant.set(row.tenant_id, row)
  }

  const candidates = []
  for (const row of settingsRows || []) {
    const contractorId = row.id
    const domainCfg = normalizeDomainConfig(row.domain_config)
    const services = []

    for (const r of roomsByContractor.get(contractorId) || []) services.push(r)
    const site = latestSiteByTenant.get(contractorId)
    for (const t of extractProductTitles(site?.products_config)) services.push(t)

    const uniqueServices = [...new Set(services.map((s) => s.trim()).filter(Boolean))]
    if (uniqueServices.length === 0) continue

    const roomMatches = new Set()
    const nonRoomServices = []
    for (const s of uniqueServices) {
      const canonicalRoom = ROOM_CANONICAL.get(normalize(s))
      if (canonicalRoom) roomMatches.add(canonicalRoom)
      else nonRoomServices.push(s)
    }

    // Only target non-closet contexts for this backfill.
    if (nonRoomServices.length === 0) continue

    const targetDisabled = ROOM_TYPES.filter((room) => !roomMatches.has(room))
    const currentDisabled = Array.isArray(row.disabled_default_rooms)
      ? row.disabled_default_rooms.slice()
      : []
    const sortedCurrentDisabled = [...currentDisabled].sort()
    const sortedTargetDisabled = [...targetDisabled].sort()

    const domainInference = inferDomainConfig(uniqueServices, row.industry || '')
    if (!domainInference.matched && !args.includeGeneric) continue

    const targetDomain = domainInference.config
    const needsDomainUpdate = domainConfigNeedsUpdate(domainCfg, targetDomain)
    const needsDisabledUpdate = !arrayEqual(sortedCurrentDisabled, sortedTargetDisabled)

    if (!needsDomainUpdate && !needsDisabledUpdate) continue

    const patch = {}
    if (needsDomainUpdate) patch.domain_config = targetDomain
    if (needsDisabledUpdate) patch.disabled_default_rooms = targetDisabled

    candidates.push({
      id: contractorId,
      company: row.company_name || '(unknown)',
      services: uniqueServices,
      nonRoomServices,
      patch,
      needsDomainUpdate,
      needsDisabledUpdate,
    })
  }

  const sliced = Number.isFinite(args.limit) && args.limit > 0
    ? candidates.slice(0, args.limit)
    : candidates

  console.log(`Mode: ${args.apply ? 'APPLY' : 'DRY RUN'}`)
  console.log(`Candidates: ${sliced.length}`)
  if (sliced.length === 0) return

  for (const c of sliced) {
    console.log('---')
    console.log(`Contractor: ${c.id} (${c.company})`)
    console.log(`Services: ${c.services.join(', ')}`)
    console.log(`Updates: ${Object.keys(c.patch).join(', ')}`)
    if (!args.apply) continue

    const { error } = await supabase
      .from('contractor_settings')
      .update(c.patch)
      .eq('id', c.id)
    if (error) {
      console.error(`FAILED ${c.id}: ${error.message}`)
    } else {
      console.log(`UPDATED ${c.id}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
