import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Every place that queues a Full redesign must carry the owner's facts.
 *
 * The first version of this feature only wired auto-launch, which looked
 * complete: a newly provisioned tenant got a site built from its intake. But an
 * admin re-run — the normal way a site gets fixed — built its job without
 * `facts_brief`, so the rebuild silently fell back to the 900-character
 * site_configs summary and dropped everything the intake collected. The site
 * got *worse* the moment someone tried to improve it, with nothing in the
 * output to say why.
 *
 * A per-callsite unit test would not have caught that, because the bug WAS a
 * missing callsite. So this is a census instead: find everything that writes a
 * job row, and require each one to carry the field.
 *
 * The census keys on `setCustomBuildJob(` rather than on `intent: 'full'` for a
 * specific reason — the route that had the bug writes `intent: intent as 'full'
 * | 'surgical'`, so a literal-text search for the intent would have skipped
 * exactly the file that was broken.
 */

const REPO = join(__dirname, '..', '..', '..')

function grepFiles(pattern: string): string[] {
  try {
    return execSync(`grep -rl "${pattern}" src --include=*.ts --include=*.tsx`, {
      cwd: REPO,
      encoding: 'utf8',
    })
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

/** Files that own the job's lifecycle rather than starting one. */
const NOT_CREATORS = [
  // Declares CustomBuildJob and the read/reconcile helpers.
  'src/lib/ai/customBuildJob.ts',
  // Consumes a queued job and patches its status as it runs.
  'src/lib/ai/processCustomBuildJob.ts',
]

const creators = grepFiles('setCustomBuildJob(')
  .filter((f) => !f.includes('.test.'))
  .filter((f) => !NOT_CREATORS.includes(f))

describe('facts reach every redesign, not just the first', () => {
  it('finds the job creators', () => {
    // auto-launch, the single-site admin route, the fleet batch route.
    expect(creators.length).toBeGreaterThanOrEqual(3)
  })

  it('carries facts_brief from every one of them', () => {
    const missing = creators.filter(
      (file) => !readFileSync(join(REPO, file), 'utf8').includes('facts_brief')
    )
    expect(missing, 'these queue a redesign without the owner facts').toEqual([])
  })

  it('sources the facts from the intake ledger rather than inventing them', () => {
    const notFromLedger = creators.filter(
      (file) => !readFileSync(join(REPO, file), 'utf8').includes('loadFactsBriefForTenant')
    )
    expect(notFromLedger).toEqual([])
  })
})
