import { createSpecIntake } from '@/lib/spec/createSpecIntake'
import { runSpecResearch, saveSpecResearch } from '@/lib/spec/research/runSpecResearch'
import { getSpecBuild, transitionSpecBuild } from '@/lib/spec/specBuilds'
import type { SpecBuildRow } from '@/lib/spec/types'

/**
 * Move a spec build forward by exactly one step.
 *
 * One re-entrant function rather than a chain: each step's guard is "am I in
 * state X, and is the work product still absent?", so a redelivered job that
 * finds the work already done just moves on. Every transition is a
 * compare-and-set, so two workers racing the same build cannot both proceed.
 *
 * Phase 2 implements queued → researching → drafting and stops there. Nothing
 * here provisions, generates images, or contacts anyone — those arrive in
 * Phase 3, at which point this function gains the remaining cases.
 */

export type AdvanceResult = {
  from: string
  to: string
  done: boolean
  note?: string
}

export async function advanceSpecBuild(buildId: string): Promise<AdvanceResult> {
  const build = await getSpecBuild(buildId)
  if (!build) return { from: 'missing', to: 'missing', done: true, note: 'build not found' }

  switch (build.status) {
    case 'queued':
      return runResearchStep(build)
    case 'researching':
      // A crashed research step left the row claimed. Re-running is safe —
      // research writes no partial state that a second pass would corrupt.
      return runResearchStep(build, { alreadyClaimed: true })
    case 'drafting':
      return {
        from: 'drafting',
        to: 'drafting',
        done: true,
        note: 'Phase 2 stops here — building starts in Phase 3.',
      }
    default:
      return { from: build.status, to: build.status, done: true }
  }
}

async function runResearchStep(
  build: SpecBuildRow,
  opts: { alreadyClaimed?: boolean } = {}
): Promise<AdvanceResult> {
  if (!opts.alreadyClaimed) {
    const claimed = await transitionSpecBuild(build.id, 'queued', 'researching')
    if (!claimed) {
      return { from: 'queued', to: 'queued', done: false, note: 'claimed by another worker' }
    }
  }

  try {
    const outcome = await runSpecResearch(build)
    await saveSpecResearch(build.id, outcome)

    if (outcome.blockedReason) {
      await transitionSpecBuild(build.id, 'researching', 'needs_attention', {
        status_reason: outcome.blockedReason,
      })
      return { from: 'researching', to: 'needs_attention', done: true, note: outcome.blockedReason }
    }

    const result = await createSpecIntake({ ...build, research: { facts: outcome.facts } }, outcome.facts)

    // The Phase 0 finding, enforced: a build with no concrete claim will fail
    // copy_no_proprietary_detail, which no machine can repair. Better to stop
    // here — where an admin can add one real fact — than to spend a full site
    // generation, images and a multi-pass redesign discovering it later.
    if (!result.hasProprietaryDetail) {
      const note =
        'No proprietary detail found. The site would fail the copy gate — add one verified fact, or drop this lead.'
      await transitionSpecBuild(build.id, 'researching', 'needs_attention', {
        status_reason: note,
        intake_id: result.intakeId,
      })
      return { from: 'researching', to: 'needs_attention', done: true, note }
    }

    await transitionSpecBuild(build.id, 'researching', 'drafting', {
      intake_id: result.intakeId,
      last_error: null,
      status_reason: null,
    })
    return {
      from: 'researching',
      to: 'drafting',
      done: true,
      note: `${outcome.facts.length} verified fact(s)`,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await transitionSpecBuild(build.id, 'researching', 'needs_attention', {
      last_error: message.slice(0, 1000),
      status_reason: 'Research failed',
    })
    return { from: 'researching', to: 'needs_attention', done: true, note: message }
  }
}
