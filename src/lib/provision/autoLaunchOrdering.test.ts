import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The first link of the unattended sequence — intake POST → provision job —
 * asserted at its source, because it cannot be exercised in a unit test and it
 * fails silently in production: the intake still saves, the response is still
 * 200, and only the deploy that was supposed to happen without an admin quietly
 * doesn't. The rest of the sequence (deploy → wait → approve → redesign) is
 * covered behaviourally in provisionFromIntake.test.ts.
 */
const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')

describe('intake submit starts the deploy', () => {
  it('awaits the provision kick before responding', () => {
    const src = read('src/app/api/intake/[token]/route.ts')
    expect(src).toContain('await kickProvisionAfterSubmit(')
    // A bare `kickProvisionAfterSubmit(id)` here is the original bug: the
    // response returns, the instance freezes, and add_job never commits.
    expect(src).not.toMatch(/^\s*kickProvisionAfterSubmit\(/m)
    expect(src).not.toContain('void kickProvisionAfterSubmit(')
  })

  it('awaits the worker enqueue inside the kick', () => {
    const src = read('src/lib/provision/kickProvisionAfterSubmit.ts')
    expect(src).toContain('await enqueueJob(')
    // Anchored so the prose in this file's own doc comment doesn't match.
    expect(src).not.toMatch(/^\s*void enqueueJob\(/m)
  })
})

describe('every provisioned marketing site enters the launch sequence', () => {
  it('hands both the template and AI Premium paths to auto-launch', () => {
    const src = read('src/lib/provision/provisionFromIntake.ts')
    // Both the AI Premium and template paths, so neither tier needs an admin.
    expect(src.match(/await kickAutoLaunch\(result\.tenantId\)/g)).toHaveLength(2)
  })
})
