#!/usr/bin/env node
/**
 * Verify Stripe env + price IDs against the live Stripe API.
 * Run from closet-dashboard: node scripts/stripe-verify.mjs
 * Loads .env.local if present (simple KEY=VAL parser).
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
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}

const key = process.env.STRIPE_SECRET_KEY
if (!key) {
  console.error('STRIPE_SECRET_KEY missing')
  process.exit(1)
}

const stripe = new Stripe(key)
const checks = []

function add(name, ok, detail) {
  checks.push({ name, ok, detail })
  const mark = ok ? '✓' : '✗'
  console.log(`${mark} ${name}: ${detail}`)
}

add('STRIPE_SECRET_KEY', true, key.startsWith('sk_live_') ? 'live' : 'test')
add('STRIPE_WEBHOOK_SECRET', !!process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_WEBHOOK_SECRET ? 'set' : 'missing')
const priceEnvs = [
  ['STRIPE_PRICE_MONTHLY', 'recurring'],
  ['STRIPE_PRICE_YEARLY', 'recurring'],
  ['STRIPE_PRICE_STANDARD_BUILD', 'one_time'],
  ['STRIPE_PRICE_AI_PREMIUM_FULL', 'one_time'],
  ['STRIPE_PRICE_AI_PREMIUM_DEPOSIT', 'one_time'],
  ['STRIPE_PRICE_AI_PREMIUM_BALANCE', 'one_time'],
  ['STRIPE_PRICE_SITE_MAINTENANCE_MONTHLY', 'recurring'],
  ['STRIPE_PRICE_SITE_MAINTENANCE_YEARLY', 'recurring'],
]

for (const [envKey, expectType] of priceEnvs) {
  const id = process.env[envKey]
  add(envKey, !!id, id || 'missing — run npm run stripe:catalog')
  if (!id) continue
  try {
    const price = await stripe.prices.retrieve(id)
    const typeOk = expectType === 'recurring' ? price.type === 'recurring' : price.type === 'one_time'
    add(
      envKey + '_api',
      price.active && typeOk,
      `${price.unit_amount}c ${price.type} active=${price.active}`
    )
  } catch (e) {
    add(envKey + '_api', false, e.message)
  }
}

try {
  const eps = await stripe.webhookEndpoints.list({ limit: 20 })
  const hit = eps.data.filter((ep) => ep.url.includes('/api/webhooks/stripe'))
  add('webhook', hit.length > 0, hit.map((e) => e.url).join(', ') || 'none for /api/webhooks/stripe')
} catch (e) {
  add('webhook', false, e.message)
}

const ok = checks.every((c) => c.ok)
process.exit(ok ? 0 : 1)
