#!/usr/bin/env node
/**
 * One-shot: deactivate duplicate Pro prices, archive leftover deposits,
 * rename wired products to DitchTheForm branding.
 * Usage: node scripts/stripe-rebrand-cleanup.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import Stripe from 'stripe'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const envPath = resolve(root, '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}

const key = process.env.STRIPE_SECRET_KEY
if (!key) {
  console.error('STRIPE_SECRET_KEY missing')
  process.exit(1)
}
if (!key.startsWith('sk_test_')) {
  console.error('Refusing to run: STRIPE_SECRET_KEY is not test mode')
  process.exit(1)
}

const stripe = new Stripe(key)
console.log('Mode: test\n')

function dumpPrice(p) {
  return {
    id: p.id,
    active: p.active,
    nickname: p.nickname,
    lookup_key: p.lookup_key,
    unit_amount: p.unit_amount,
    product: typeof p.product === 'string' ? p.product : p.product?.id,
  }
}

function dumpProduct(p) {
  return {
    id: p.id,
    name: p.name,
    active: p.active,
    description: p.description,
    metadata: p.metadata,
  }
}

async function findPriceByLookupKey(lookupKey) {
  const res = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1, expand: ['data.product'] })
  return res.data[0] ?? null
}

// ─── 1. Deactivate duplicate Pro prices ─────────────────────────────────────
console.log('=== 1. Deactivate duplicate Pro prices ===\n')
const DUPLICATE_PRICES = [
  'price_1TZLm0PF63QjxbbbCFvMsZNd',
  'price_1TZLm0PF63QjxbbbRtSvymU3',
]
for (const id of DUPLICATE_PRICES) {
  try {
    const before = await stripe.prices.retrieve(id)
    console.log('BEFORE price', JSON.stringify(dumpPrice(before), null, 2))
    if (before.active) {
      const after = await stripe.prices.update(id, { active: false })
      console.log('AFTER  price', JSON.stringify(dumpPrice(after), null, 2))
    } else {
      console.log('AFTER  (already inactive) — skipped update')
    }
  } catch (e) {
    console.log(`ERROR price ${id}: ${e.message}`)
  }
  console.log()
}

const ARCHIVED_PRODUCT = 'prod_UYSh5YJnOnjq0N'
try {
  const before = await stripe.products.retrieve(ARCHIVED_PRODUCT)
  console.log('BEFORE product', JSON.stringify(dumpProduct(before), null, 2))
  if (before.active) {
    const after = await stripe.products.update(ARCHIVED_PRODUCT, { active: false })
    console.log('AFTER  product', JSON.stringify(dumpProduct(after), null, 2))
  } else {
    console.log('AFTER  (already inactive) — skipped update')
  }
} catch (e) {
  console.log(`ERROR product ${ARCHIVED_PRODUCT}: ${e.message}`)
}
console.log()

// ─── 2. Archive empty leftover deposit products ─────────────────────────────
console.log('=== 2. Archive leftover deposit products ===\n')
const DEPOSIT_NAME_RE =
  /(DitchTheForm AI Premium|ClosetQuote AI Premium)\s*[—–-]\s*30%\s*deposit/i

const leftoverIds = []
for await (const product of stripe.products.list({ limit: 100, active: true })) {
  if (DEPOSIT_NAME_RE.test(product.name)) {
    leftoverIds.push(product.id)
    console.log('MATCH', product.id, product.name)
  }
}
// also search inactive? user asked to find and set active:false — search all by name via list
for await (const product of stripe.products.list({ limit: 100, active: false })) {
  if (DEPOSIT_NAME_RE.test(product.name) && !leftoverIds.includes(product.id)) {
    console.log('MATCH (already inactive)', product.id, product.name)
  }
}

if (leftoverIds.length === 0) {
  console.log('No active matching deposit products found (searching all pages more carefully)...')
  // broader search: list more
  let starting_after
  const allMatches = []
  for (;;) {
    const page = await stripe.products.list({
      limit: 100,
      ...(starting_after ? { starting_after } : {}),
    })
    for (const p of page.data) {
      if (DEPOSIT_NAME_RE.test(p.name) || /30%\s*deposit/i.test(p.name)) {
        allMatches.push(p)
      }
    }
    if (!page.has_more) break
    starting_after = page.data[page.data.length - 1].id
  }
  for (const p of allMatches) {
    console.log('FOUND', p.id, `active=${p.active}`, p.name)
    if (p.active) leftoverIds.push(p.id)
  }
}

for (const id of leftoverIds) {
  const before = await stripe.products.retrieve(id)
  console.log('BEFORE product', JSON.stringify(dumpProduct(before), null, 2))
  if (before.active) {
    const after = await stripe.products.update(id, { active: false })
    console.log('AFTER  product', JSON.stringify(dumpProduct(after), null, 2))
  } else {
    console.log('AFTER  (already inactive)')
  }
  console.log()
}

// ─── 3. Rename wired products ───────────────────────────────────────────────
console.log('=== 3. Rename wired products (via lookup keys) ===\n')

const RENAMES = [
  {
    lookupKeys: ['cq_pro_monthly', 'cq_pro_yearly'],
    name: 'DitchTheForm Pro',
    description:
      'Interactive quote widget for your existing website. Unlimited SMS & email leads.',
    metadata: { app: 'ditchtheform', lookup_key: 'cq_pro' },
  },
  {
    lookupKeys: ['cq_standard_build_onetime'],
    name: 'DitchTheForm Standard Site Build',
    description:
      'One-time custom marketing site + embedded quote calculator with stock imagery. Pay when satisfied before launch.',
    metadata: { app: 'ditchtheform', lookup_key: 'cq_standard_build' },
  },
  {
    lookupKeys: ['cq_ai_premium_full'],
    name: 'DitchTheForm AI Premium Site Build',
    description:
      'Custom site with AI hero & product imagery. 30% deposit on intake; balance due before launch if satisfied.',
    metadata: { app: 'ditchtheform', lookup_key: 'cq_ai_premium_build' },
  },
  {
    lookupKeys: ['cq_site_maintenance_monthly'],
    name: 'DitchTheForm Site Maintenance',
    description:
      'Managed hosting, SSL, DitchTheForm Pro, and 1 content tweak per month after your site launches.',
    metadata: { app: 'ditchtheform', lookup_key: 'cq_site_maintenance' },
  },
]

const summary = []

for (const spec of RENAMES) {
  let productId = null
  for (const lk of spec.lookupKeys) {
    const price = await findPriceByLookupKey(lk)
    if (!price) {
      console.log(`WARN: lookup_key ${lk} not found`)
      continue
    }
    console.log(`Resolved ${lk} → price ${price.id} (active=${price.active}, unit_amount=${price.unit_amount})`)
    const pid = typeof price.product === 'string' ? price.product : price.product.id
    if (productId && productId !== pid) {
      console.log(`WARN: ${lk} points to different product ${pid} vs ${productId}`)
    }
    productId = pid
  }
  if (!productId) {
    console.log(`SKIP: could not resolve product for ${spec.name}`)
    console.log()
    continue
  }

  const before = await stripe.products.retrieve(productId)
  console.log('BEFORE product', JSON.stringify(dumpProduct(before), null, 2))

  const metadata = { ...before.metadata }
  for (const [k, v] of Object.entries(spec.metadata)) {
    if (!metadata[k]) metadata[k] = v
    else if (metadata[k] !== v) {
      // user said set metadata.app and appropriate lookup_key if missing —
      // still set app to ditchtheform if wrong
      if (k === 'app') metadata[k] = v
      else if (!metadata.lookup_key && k === 'lookup_key') metadata[k] = v
    }
  }
  // Ensure app is ditchtheform
  metadata.app = 'ditchtheform'
  if (!metadata.lookup_key) metadata.lookup_key = spec.metadata.lookup_key

  const after = await stripe.products.update(productId, {
    name: spec.name,
    description: spec.description,
    metadata,
  })
  console.log('AFTER  product', JSON.stringify(dumpProduct(after), null, 2))
  summary.push({
    lookupKeys: spec.lookupKeys,
    productId: after.id,
    name: after.name,
    active: after.active,
    metadata: after.metadata,
  })
  console.log()
}

console.log('=== SUMMARY ===')
console.log(JSON.stringify(summary, null, 2))
console.log('\nDone. Wired price unit_amounts were not modified.')
