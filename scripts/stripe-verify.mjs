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
add('STRIPE_PRICE_MONTHLY', !!process.env.STRIPE_PRICE_MONTHLY, process.env.STRIPE_PRICE_MONTHLY || 'missing')
add('STRIPE_PRICE_YEARLY', !!process.env.STRIPE_PRICE_YEARLY, process.env.STRIPE_PRICE_YEARLY || 'missing')

for (const [label, id] of [
  ['monthly', process.env.STRIPE_PRICE_MONTHLY],
  ['yearly', process.env.STRIPE_PRICE_YEARLY],
]) {
  if (!id) continue
  try {
    const price = await stripe.prices.retrieve(id)
    add(
      `price_${label}`,
      price.active && price.type === 'recurring',
      `${price.unit_amount}c ${price.recurring?.interval || 'n/a'} active=${price.active}`
    )
  } catch (e) {
    add(`price_${label}`, false, e.message)
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
