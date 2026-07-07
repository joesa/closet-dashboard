/**
 * Backfill sensible tier pricing onto contractor_rooms rows seeded entirely at
 * $0 (the provisionTenant bug where an empty AI widget config averaged to 0
 * instead of using industry engine-profile priceHints).
 *
 * Dry-run:  node scripts/backfill-zero-room-pricing.mjs
 * Apply:    node scripts/backfill-zero-room-pricing.mjs --apply
 *
 * Only rooms whose basic+standard+premium sum to 0 are touched, so any room a
 * contractor has already priced is left untouched. Pricing mirrors the same
 * engineProfiles.ts serviceDefaults the fixed provisioning path now uses.
 */
import { createClient } from '@supabase/supabase-js'
import { getEngineProfile } from '../src/lib/catalog/engineProfiles.ts'

const APPLY = process.argv.includes('--apply')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const supa = createClient(url, key, { auth: { persistSession: false } })

// Human industry label (contractor_settings.industry) -> engine-profile slug.
// The slug only selects which engineProfiles bucket supplies priceHints; all
// default-quote trades share the same fallback numbers.
const LABEL_TO_SLUG = {
  'Pet Services': 'pet-services',
  'Medical Care': 'medical-clinic',
  'Personal Training & Fitness': 'personal-training',
  'Beauty & Grooming': 'beauty-salon',
  'Restaurants, Bars & Cafes': 'restaurants-bars',
  'Cleaning Services': 'cleaning',
  'Landscaping': 'landscaping',
  'Tree Service': 'tree-service',
  // Everything below resolves to the default quote profile (89/249/1200):
  'Electrical': 'electrical',
  'Custom Closets & Storage': 'custom-closets',
  'Roofing': 'roofing',
  'Plumbing': 'plumbing',
}

function tierDefaults(label) {
  const slug = LABEL_TO_SLUG[label] || 'unknown-default-quote'
  const tiers = getEngineProfile(slug)?.serviceDefaults?.[0]?.tiers ?? []
  const hintFor = (t) => tiers.find((x) => x.tier === t)?.priceHint
  const standard = hintFor('standard') ?? tiers[0]?.priceHint ?? 65
  const basic = hintFor('basic') ?? Math.max(1, Math.round(standard * 0.7))
  const premium = hintFor('premium') ?? Math.round(standard * 1.6)
  return { basic, standard, premium }
}

async function main() {
  const { data: rooms, error } = await supa
    .from('contractor_rooms')
    .select('id,contractor_id,name,price_basic,price_standard,price_premium')
  if (error) throw error

  const zero = (rooms ?? []).filter(
    (r) =>
      (Number(r.price_basic) || 0) +
        (Number(r.price_standard) || 0) +
        (Number(r.price_premium) || 0) ===
      0
  )
  console.log(
    `Found ${zero.length} all-$0 rooms across ${new Set(zero.map((r) => r.contractor_id)).size} contractors.\n`
  )

  const industryCache = new Map()
  let updated = 0

  for (const room of zero) {
    if (!industryCache.has(room.contractor_id)) {
      const { data: cs } = await supa
        .from('contractor_settings')
        .select('industry,company_name')
        .eq('id', room.contractor_id)
        .maybeSingle()
      industryCache.set(room.contractor_id, cs || {})
    }
    const cs = industryCache.get(room.contractor_id)
    const d = tierDefaults(cs.industry)
    console.log(
      `${APPLY ? 'UPDATE' : 'DRY  '} [${cs.company_name} · ${cs.industry}] ${room.name} -> ${d.basic}/${d.standard}/${d.premium}`
    )
    if (APPLY) {
      const { error: upErr } = await supa
        .from('contractor_rooms')
        .update({
          price_basic: d.basic,
          price_standard: d.standard,
          price_premium: d.premium,
        })
        .eq('id', room.id)
      if (upErr) {
        console.error(`  failed: ${upErr.message}`)
        continue
      }
      updated++
    }
  }

  console.log(
    APPLY
      ? `\nApplied ${updated} updates.`
      : '\nDry run complete. Re-run with --apply to write.'
  )
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
