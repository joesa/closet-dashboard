import { createSpecIntake } from '@/lib/spec/createSpecIntake'
import { kickSpecBuild } from '@/lib/spec/kickSpecBuild'
import { withoutPublicProfileResearch } from '@/lib/spec/research/publicProfileResearch'
import { getSpecBuild, transitionSpecBuild } from '@/lib/spec/specBuilds'

export type OverrideSpecBuildResult =
  | { ok: true; from: string; to: 'drafting'; intakeId: string }
  | { ok: false; reason: string }

/**
 * Manual escape hatch for the proprietary-detail blocker.
 *
 * This does not bypass evidence verification. It only allows an admin to keep
 * a build moving when they intentionally accept the risk of thinner copy.
 */
export async function overrideSpecBuildToDrafting(buildId: string): Promise<OverrideSpecBuildResult> {
  const build = await getSpecBuild(buildId)
  if (!build) return { ok: false, reason: 'Spec build not found.' }
  if (build.tenant_id) {
    return { ok: false, reason: 'This build already has a tenant and cannot be overridden.' }
  }
  if (!['needs_attention', 'queued', 'researching'].includes(build.status)) {
    return {
      ok: false,
      reason: 'Override is only allowed before provisioning (queued/researching/needs attention).',
    }
  }

  const facts = build.research?.facts ?? []
  const intake = await createSpecIntake(build, facts)

  const transitioned = await transitionSpecBuild(
    build.id,
    ['needs_attention', 'queued', 'researching'],
    'drafting',
    {
      intake_id: intake.intakeId,
      lead_input: withoutPublicProfileResearch(build.lead_input),
      research: { ...(build.research ?? {}), facts },
      status_reason: null,
      last_error: null,
    }
  )

  if (!transitioned) {
    return { ok: false, reason: 'Build state changed before override could be applied. Retry.' }
  }

  kickSpecBuild(build.id)
  return { ok: true, from: build.status, to: 'drafting', intakeId: intake.intakeId }
}
