import { describe, expect, it } from 'vitest'
import { generateTempPassword as provisionPassword } from '@/lib/provision/ensureTenantAuthUser'
import { generateTempPassword as adminPassword } from '@/lib/clientLoginCredentials'

/**
 * These two functions mint the real initial dashboard password for a
 * contractor — emailed at provision time and retrievable by an admin. Both were
 * built on `Math.random()`, a seeded PRNG whose state is recoverable from a few
 * outputs; one serverless instance provisions several tenants in a row, so a
 * single leaked password put its neighbours at risk.
 *
 * A statistical test cannot prove a CSPRNG, so this pins the properties that
 * would regress if someone reached for `Math.random()` again: enough entropy,
 * no repeats across a large sample, and the character classes the account
 * policy expects.
 */
const SAMPLE = 500

describe.each([
  ['provisioning', provisionPassword],
  ['admin regenerate', adminPassword],
])('%s temp password', (_label, generate) => {
  it('is long enough to be worth having', () => {
    expect(generate().length).toBeGreaterThanOrEqual(12)
  })

  it('never repeats across a large sample', () => {
    const seen = new Set(Array.from({ length: SAMPLE }, () => generate()))
    expect(seen.size).toBe(SAMPLE)
  })

  it('varies in every position rather than following a fixed template', () => {
    // The old provisioning value was `Dtf-` + 8 base36 chars + 2 digits + '!',
    // so most positions were constant or drawn from a 10-symbol alphabet.
    const samples = Array.from({ length: 200 }, () => generate())
    const tail = samples.map((s) => s.slice(-4))
    expect(new Set(tail).size).toBeGreaterThan(100)
  })

  it('mixes character classes', () => {
    const joined = Array.from({ length: 50 }, () => generate()).join('')
    expect(joined).toMatch(/[a-z]/)
    expect(joined).toMatch(/[A-Z]/)
    expect(joined).toMatch(/[0-9]/)
  })
})
