import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The facts channel must never become an exemption channel.
 *
 * `briefTextForScan` is the string every design guard consults through
 * `briefMentions()` to decide whether a banned default was actually requested —
 * a hairline grid, a dark-neon skin, a gap-outlined grout grid. That exemption
 * is legitimate for an ADMIN SEED ("build it as a ruled ledger") and illegitimate
 * for owner facts: a tile business's facts mention grout in every line, a
 * welding shop's mention steel and hairlines, and routing those into the scan
 * text would silently disable the guards for exactly the businesses whose
 * subject matter collides with a banned motif.
 *
 * This is a source-level invariant rather than a behavioural test on purpose.
 * The failure it guards against is a one-word edit — appending `factsBrief` to
 * a template string — that no output assertion would catch until sites started
 * shipping with the wireframe look the guards exist to reject.
 */

const SOURCE = readFileSync(
  join(__dirname, 'generateCustomSite.ts'),
  'utf8'
)

describe('facts brief is a factual channel, not an exemption channel', () => {
  it('composes briefTextForScan from the admin seed and the optimized brief only', () => {
    const match = SOURCE.match(/const briefTextForScan = ([^\n]+)/)
    expect(match, 'briefTextForScan assignment not found — did it move?').toBeTruthy()
    const expression = match![1]
    expect(expression).toContain('adminBrief')
    expect(expression).toContain('optimizedBrief')
    expect(expression).not.toContain('factsBrief')
    expect(expression).not.toContain('factsBlock')
    expect(expression).not.toContain('directionAndFacts')
  })

  it('keeps the facts out of the seed-empty decision', () => {
    // A non-empty prompt switches off EMPTY_SEED_DIRECTION_INSTRUCTIONS, which
    // is what makes the pipeline self-author a direction on auto-launch.
    const match = SOURCE.match(/const seedEmpty = ([^\n]+)/)
    expect(match).toBeTruthy()
    expect(match![1]).toBe('!adminBrief')
  })

  it('still routes the facts into the prompts that write copy', () => {
    // The point of the channel: foundation and every page pass see the facts.
    expect(SOURCE).toContain('const directionAndFacts =')
    expect(SOURCE).toMatch(/OWNER-SUPPLIED FACTS/)
    const passUses = SOURCE.match(/\$\{directionAndFacts\}/g) ?? []
    expect(passUses.length).toBeGreaterThanOrEqual(2)
  })
})
