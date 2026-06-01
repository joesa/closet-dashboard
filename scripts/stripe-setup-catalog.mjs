#!/usr/bin/env node
/**
 * Create ClosetQuote Stripe catalog (products + prices) with stable lookup_keys.
 * Idempotent: re-run safely; skips existing lookup_keys.
 *
 * Usage: node scripts/stripe-setup-catalog.mjs
 * Loads .env.local from repo root when present.
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import Stripe from 'stripe'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const envPath = resolve(root, '.env.local')

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

loadEnvFile(envPath)

const key = process.env.STRIPE_SECRET_KEY
if (!key) {
  console.error('STRIPE_SECRET_KEY missing (set in .env.local)')
  process.exit(1)
}

const stripe = new Stripe(key)

const cents = (name, fallback) => {
  const v = parseInt(process.env[name] ?? '', 10)
  return Number.isFinite(v) && v >= 0 ? v : fallback
}

const STANDARD_CENTS = cents('INTAKE_TIER_STANDARD_CENTS', 99900)
const PREMIUM_CENTS = cents('INTAKE_TIER_AI_PREMIUM_CENTS', 199900)
const DEPOSIT_CENTS = Math.ceil(PREMIUM_CENTS * 0.3)
const BALANCE_CENTS = PREMIUM_CENTS - DEPOSIT_CENTS
const MAINT_MONTHLY = cents('SITE_MAINTENANCE_MONTHLY_CENTS', 14900)
const MAINT_YEARLY = cents('SITE_MAINTENANCE_YEARLY_CENTS', 149000)
const PRO_MONTHLY = cents('WIDGET_SUBSCRIPTION_MONTHLY_CENTS', 9900)
const PRO_YEARLY = cents('WIDGET_SUBSCRIPTION_YEARLY_CENTS', 99000)

/** @type {Record<string, string>} */
const envOut = {}

async function findPriceByLookupKey(lookupKey) {
  const res = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 })
  return res.data[0] ?? null
}

async function findProductByLookupKey(lookupKey) {
  const res = await stripe.products.list({ limit: 100 })
  return res.data.find((p) => p.metadata?.lookup_key === lookupKey) ?? null
}

async function ensureProduct({ lookup_key, name, description }) {
  let product = await findProductByLookupKey(lookup_key)
  if (!product && lookup_key === 'cq_pro') {
    const listed = await stripe.products.list({ limit: 100, active: true })
    product = listed.data.find((p) => p.name === 'ClosetQuote Pro') ?? null
    if (product) {
      await stripe.products.update(product.id, {
        metadata: { ...product.metadata, app: 'closetquote', lookup_key },
      })
      console.log(`  product reused (by name): ClosetQuote Pro → ${product.id}`)
    }
  }
  if (product) {
    console.log(`  product exists: ${lookup_key} → ${product.id}`)
    return product
  }
  product = await stripe.products.create({
    name,
    description,
    metadata: { app: 'closetquote', lookup_key },
  })
  console.log(`  product created: ${lookup_key} → ${product.id}`)
  return product
}

async function ensurePrice({ productId, lookup_key, unit_amount, recurring, nickname }) {
  let price = await findPriceByLookupKey(lookup_key)
  if (price) {
    if (price.unit_amount !== unit_amount) {
      console.warn(
        `  ⚠ price ${lookup_key} exists as ${price.id} but amount ${price.unit_amount} ≠ ${unit_amount}c — using existing (update manually in Stripe if needed)`
      )
    } else {
      console.log(`  price exists: ${lookup_key} → ${price.id} (${unit_amount}c)`)
    }
    return price
  }
  price = await stripe.prices.create({
    product: productId,
    currency: 'usd',
    unit_amount,
    lookup_key,
    nickname,
    ...(recurring ? { recurring } : {}),
  })
  console.log(`  price created: ${lookup_key} → ${price.id} (${unit_amount}c)`)
  return price
}

console.log('ClosetQuote Stripe catalog setup\n')
console.log(
  `Amounts: Standard ${STANDARD_CENTS}c | Premium ${PREMIUM_CENTS}c (deposit ${DEPOSIT_CENTS}c, balance ${BALANCE_CENTS}c) | Maintenance ${MAINT_MONTHLY}c/mo ${MAINT_YEARLY}c/yr | Pro ${PRO_MONTHLY}c/mo ${PRO_YEARLY}c/yr\n`
)

// ── ClosetQuote Pro (widget) ─────────────────────────────────────────────
console.log('ClosetQuote Pro')
const proProduct = await ensureProduct({
  lookup_key: 'cq_pro',
  name: 'ClosetQuote Pro',
  description:
    'Interactive closet quote widget for your existing website. Unlimited SMS & email leads.',
})
const proMonthly = await ensurePrice({
  productId: proProduct.id,
  lookup_key: 'cq_pro_monthly',
  unit_amount: PRO_MONTHLY,
  nickname: 'Pro monthly',
  recurring: { interval: 'month' },
})
const proYearly = await ensurePrice({
  productId: proProduct.id,
  lookup_key: 'cq_pro_yearly',
  unit_amount: PRO_YEARLY,
  nickname: 'Pro yearly',
  recurring: { interval: 'year' },
})
envOut.STRIPE_PRICE_MONTHLY = proMonthly.id
envOut.STRIPE_PRICE_YEARLY = proYearly.id

// ── Standard site build ───────────────────────────────────────────────────
console.log('\nStandard site build')
const standardProduct = await ensureProduct({
  lookup_key: 'cq_standard_build',
  name: 'ClosetQuote Standard Site Build',
  description:
    'One-time custom marketing site + embedded quote calculator with stock imagery. Pay when satisfied before launch.',
})
const standardPrice = await ensurePrice({
  productId: standardProduct.id,
  lookup_key: 'cq_standard_build_onetime',
  unit_amount: STANDARD_CENTS,
  nickname: 'Standard build (one-time)',
})
envOut.STRIPE_PRICE_STANDARD_BUILD = standardPrice.id

// ── AI Premium site build ─────────────────────────────────────────────────
console.log('\nAI Premium site build')
const premiumProduct = await ensureProduct({
  lookup_key: 'cq_ai_premium_build',
  name: 'ClosetQuote AI Premium Site Build',
  description:
    'Custom site with AI hero & product imagery. 30% deposit on intake; balance due before launch if satisfied.',
})
const premiumFull = await ensurePrice({
  productId: premiumProduct.id,
  lookup_key: 'cq_ai_premium_full',
  unit_amount: PREMIUM_CENTS,
  nickname: 'AI Premium full (one-time)',
})
const premiumDeposit = await ensurePrice({
  productId: premiumProduct.id,
  lookup_key: 'cq_ai_premium_deposit',
  unit_amount: DEPOSIT_CENTS,
  nickname: 'AI Premium 30% deposit',
})
const premiumBalance = await ensurePrice({
  productId: premiumProduct.id,
  lookup_key: 'cq_ai_premium_balance',
  unit_amount: BALANCE_CENTS,
  nickname: 'AI Premium balance before launch',
})
envOut.STRIPE_PRICE_AI_PREMIUM_FULL = premiumFull.id
envOut.STRIPE_PRICE_AI_PREMIUM_DEPOSIT = premiumDeposit.id
envOut.STRIPE_PRICE_AI_PREMIUM_BALANCE = premiumBalance.id

// ── Site maintenance (after launch) ───────────────────────────────────────
console.log('\nSite maintenance')
const maintProduct = await ensureProduct({
  lookup_key: 'cq_site_maintenance',
  name: 'ClosetQuote Site Maintenance',
  description:
    'Managed hosting, SSL, updates, and ClosetQuote Pro after your site launches.',
})
const maintMonthly = await ensurePrice({
  productId: maintProduct.id,
  lookup_key: 'cq_site_maintenance_monthly',
  unit_amount: MAINT_MONTHLY,
  nickname: 'Site maintenance monthly',
  recurring: { interval: 'month' },
})
const maintYearly = await ensurePrice({
  productId: maintProduct.id,
  lookup_key: 'cq_site_maintenance_yearly',
  unit_amount: MAINT_YEARLY,
  nickname: 'Site maintenance yearly',
  recurring: { interval: 'year' },
})
envOut.STRIPE_PRICE_SITE_MAINTENANCE_MONTHLY = maintMonthly.id
envOut.STRIPE_PRICE_SITE_MAINTENANCE_YEARLY = maintYearly.id

console.log('\n=== Add to .env / Vercel ===\n')
for (const [k, v] of Object.entries(envOut)) {
  console.log(`${k}=${v}`)
}

if (existsSync(envPath)) {
  let text = readFileSync(envPath, 'utf8')
  for (const [k, v] of Object.entries(envOut)) {
    const re = new RegExp(`^${k}=.*$`, 'm')
    if (re.test(text)) {
      text = text.replace(re, `${k}=${v}`)
    } else {
      text += `\n${k}=${v}`
    }
  }
  writeFileSync(envPath, text.endsWith('\n') ? text : text + '\n')
  console.log(`\nUpdated ${envPath}`)
}

console.log('\nDone.')
