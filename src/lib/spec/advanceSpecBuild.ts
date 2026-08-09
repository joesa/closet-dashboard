import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getIntakeByToken } from '@/lib/intake/getIntakeByToken'
import { validateAiPremiumReady } from '@/lib/intake/buildAiProvisionPayload'
import { enqueueProvisionJob } from '@/lib/provision/enqueueProvisionJob'
import { kickProvisionAfterSubmit } from '@/lib/provision/kickProvisionAfterSubmit'
import { createSpecIntake } from '@/lib/spec/createSpecIntake'
import { generateSpecImages } from '@/lib/spec/generateSpecImages'
import { generateSpecSiteConfig } from '@/lib/spec/generateSpecSite'
import { runSpecResearch, saveSpecResearch } from '@/lib/spec/research/runSpecResearch'
import {
  getSpecBuild,
  specBuildCapacityAvailable,
  transitionSpecBuild,
} from '@/lib/spec/specBuilds'
import type { SpecBuildRow } from '@/lib/spec/types'

/**
 * Move a spec build forward by exactly one step.
 *
 * One re-entrant function rather than a chain: each step's guard is "am I in
 * state X, and is the work product still absent?", so a redelivered job that
 * finds the work already done just moves on. Every transition is a
 * compare-and-set, so two workers racing the same build cannot both proceed.
 *
 * queued → researching → drafting → imaging → provisioning, then a handoff:
 * provision_tenant and full_redesign run on their own queues and report back
 * through specBuildHooks rather than being polled from here.
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
      return runGenerationStep(build, 'drafting')
    case 'imaging':
      return runGenerationStep(build, 'imaging')
    case 'provisioning':
      // Handed off to provision_tenant and then full_redesign. Control comes
      // back through specBuildHooks, not by polling from here.
      return { from: 'provisioning', to: 'provisioning', done: true, note: 'awaiting provisioning' }
    case 'building':
      return { from: 'building', to: 'building', done: true, note: 'awaiting redesign' }
    default:
      return { from: build.status, to: build.status, done: true }
  }
}

async function runResearchStep(
  build: SpecBuildRow,
  opts: { alreadyClaimed?: boolean } = {}
): Promise<AdvanceResult> {
  if (!opts.alreadyClaimed) {
    // Concurrency limit, checked where the spending starts rather than where
    // the queue is filled. A build over the limit stays queued and is picked up
    // on a later pass; `done: false` keeps the task re-enqueuing itself.
    const capacity = await specBuildCapacityAvailable()
    if (!capacity.available) {
      return {
        from: 'queued',
        to: 'queued',
        done: false,
        note: `at capacity (${capacity.inFlight}/${capacity.max} in flight)`,
      }
    }

    const claimed = await transitionSpecBuild(build.id, 'queued', 'researching')
    if (!claimed) {
      return { from: 'queued', to: 'queued', done: false, note: 'claimed by another worker' }
    }
  }

  try {
    const outcome = await runSpecResearch(build)
    await saveSpecResearch(build, outcome)

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
      // Not done — drafting, imaging and provisioning follow. This said `true`
      // while drafting was the end of Phase 2, and left the chain stopping
      // there once the later steps existed.
      done: false,
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

/**
 * drafting → imaging → provisioning.
 *
 * Each sub-step is guarded by "is the work product still absent?", so a retry
 * after a partial failure resumes rather than repeating paid work: a site
 * config already written is not regenerated, and an image slot already filled
 * is not re-imaged.
 */
async function runGenerationStep(
  build: SpecBuildRow,
  from: 'drafting' | 'imaging'
): Promise<AdvanceResult> {
  if (!build.intake_id) {
    await transitionSpecBuild(build.id, from, 'needs_attention', {
      status_reason: 'No intake row — re-run research first.',
    })
    return { from, to: 'needs_attention', done: true }
  }

  const supabase = getSupabaseAdmin()
  const { data: tokenRow } = await supabase
    .from('prospect_intakes')
    .select('token')
    .eq('id', build.intake_id)
    .maybeSingle()
  const token = (tokenRow as { token?: string } | null)?.token
  if (!token) {
    await transitionSpecBuild(build.id, from, 'needs_attention', {
      status_reason: 'Intake row is missing.',
    })
    return { from, to: 'needs_attention', done: true }
  }

  try {
    if (from === 'drafting') {
      const row = await getIntakeByToken(token)
      if (!row) throw new Error('Intake not found')

      const site = await generateSpecSiteConfig(row)
      if (!site.ok) {
        await transitionSpecBuild(build.id, 'drafting', 'needs_attention', {
          status_reason: site.reason,
        })
        return { from, to: 'needs_attention', done: true, note: site.reason }
      }
      await transitionSpecBuild(build.id, 'drafting', 'imaging', {
        status_reason: null,
        last_error: null,
      })
      return { from, to: 'imaging', done: false, note: `${site.pages} pages via ${site.source}` }
    }

    // imaging → provisioning
    const row = await getIntakeByToken(token)
    if (!row) throw new Error('Intake not found')

    const images = await generateSpecImages(row)
    if (!images.ok) {
      await transitionSpecBuild(build.id, 'imaging', 'needs_attention', {
        status_reason: images.reason,
      })
      return { from, to: 'needs_attention', done: true, note: images.reason }
    }

    // The intake is only marked submitted at the point everything the
    // provisioner reads is actually present. Flipping it earlier would let the
    // safety-net cron pick up a half-built row.
    await supabase
      .from('prospect_intakes')
      .update({ status: 'submitted', submitted_at: new Date().toISOString() })
      .eq('id', build.intake_id)

    const fresh = await getIntakeByToken(token)
    const gate = fresh ? validateAiPremiumReady(fresh) : 'Intake vanished'
    if (gate) {
      await transitionSpecBuild(build.id, 'imaging', 'needs_attention', {
        status_reason: `Not ready to provision: ${gate}`,
      })
      return { from, to: 'needs_attention', done: true, note: gate }
    }

    await transitionSpecBuild(build.id, 'imaging', 'provisioning', {
      status_reason: null,
      last_error: null,
    })
    await enqueueProvisionJob(build.intake_id, 'ai_full')
    kickProvisionAfterSubmit(build.intake_id)

    return {
      from,
      to: 'provisioning',
      done: false,
      note: `${images.generated} image(s) generated, handed off to provisioning`,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await transitionSpecBuild(build.id, from, 'needs_attention', {
      last_error: message.slice(0, 1000),
      status_reason: from === 'drafting' ? 'Site generation failed' : 'Image generation failed',
    })
    return { from, to: 'needs_attention', done: true, note: message }
  }
}
