import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The unattended sequence a submitted intake must follow:
 *
 *   intake POST → provision job (awaited) → template site deployed and serving
 *              → first Full redesign
 *
 * Each link is asserted at its source, because breaking one of them fails
 * silently in production: the intake still saves, the tenant row still exists,
 * and only the deploy that was supposed to happen without an admin quietly
 * doesn't.
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

describe('first redesign waits for the deployed template site', () => {
  it('waits for the site to serve before queueing the redesign', () => {
    const src = read('src/lib/provision/provisionFromIntake.ts')
    const waited = src.indexOf('await waitForInitialSiteDeployed(tenantId)')
    const queued = src.indexOf('await startAutoLaunchRedesign(tenantId)')
    expect(waited).toBeGreaterThan(0)
    expect(queued).toBeGreaterThan(waited)
  })

  it('hands every provisioned marketing site to auto-launch', () => {
    const src = read('src/lib/provision/provisionFromIntake.ts')
    // Both the AI Premium and template paths, so neither tier needs an admin.
    expect(src.match(/await kickAutoLaunch\(result\.tenantId\)/g)).toHaveLength(2)
  })
})
