/**
 * Local helper: POST /api/revalidate against a tenant site.
 * Requires REVALIDATE_SECRET in the environment (no hardcoded fallback).
 *
 *   REVALIDATE_SECRET=… node scripts/trigger-revalidate.mjs [url]
 */
const secret = process.env.REVALIDATE_SECRET?.trim()
if (!secret) {
  console.error('REVALIDATE_SECRET is required')
  process.exit(1)
}

const url =
  process.argv[2] || 'http://ceteh-barbershop.localhost:3000/api/revalidate'

async function main() {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-revalidate-secret': secret,
      },
    })
    const json = await res.json()
    console.log('Revalidation response:', res.status, json)
  } catch (err) {
    console.error('Error triggering revalidation:', err)
    process.exit(1)
  }
}

main().catch(console.error)
