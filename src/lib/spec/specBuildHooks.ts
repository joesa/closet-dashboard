import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { transitionSpecBuild } from '@/lib/spec/specBuilds'

/**
 * Callbacks that let the shared provisioning path report back to a spec build
 * without knowing anything about spec builds.
 *
 * Both look the build up by tenant id and return immediately when there isn't
 * one, so a paying customer's launch pays nothing for this. Both are called
 * best-effort by their callers: a failure on the spec side must never break a
 * real customer's launch.
 */

async function specBuildIdForTenant(tenantId: string): Promise<string | null> {
  const { data } = await getSupabaseAdmin()
    .from('spec_builds')
    .select('id')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

/**
 * The redesign finished (or gave up). Park the build where an admin will see it.
 *
 * `ready_for_review` requires the same quality bar an admin approval does:
 * validation must have passed. A site that failed its own QA is not something
 * to show a business owner, so it goes to needs_attention with the reason
 * attached rather than into the review queue looking finished.
 */
export async function onSpecBuildRedesignFinished(
  tenantId: string,
  outcome: { published: boolean; publishError?: string | null }
): Promise<void> {
  const buildId = await specBuildIdForTenant(tenantId)
  if (!buildId) return

  const supabase = getSupabaseAdmin()
  const { data: tenant } = await supabase
    .from('tenants')
    .select('validation_status')
    .eq('id', tenantId)
    .maybeSingle()

  const validationStatus = (tenant as { validation_status?: string } | null)?.validation_status
  const passed = validationStatus === 'passed'

  if (outcome.published && passed) {
    await transitionSpecBuild(buildId, ['building', 'provisioning'], 'ready_for_review', {
      status_reason: null,
      last_error: null,
    })
    return
  }

  await transitionSpecBuild(buildId, ['building', 'provisioning'], 'needs_attention', {
    status_reason: !outcome.published
      ? 'The redesign did not publish — the site is still on the engine template.'
      : `Site validation did not pass (${validationStatus ?? 'unknown'}). Review before showing this to anyone.`,
    last_error: outcome.publishError ?? null,
  })
}

/** Provisioning failed or needs a human. Surface it in the spec queue. */
export async function onSpecBuildProvisionFailed(
  intakeId: string,
  reason: string
): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('spec_builds')
    .select('id')
    .eq('intake_id', intakeId)
    .maybeSingle()
  const buildId = (data as { id: string } | null)?.id
  if (!buildId) return

  await transitionSpecBuild(buildId, ['provisioning', 'building', 'drafting'], 'needs_attention', {
    status_reason: 'Provisioning failed.',
    last_error: reason.slice(0, 1000),
  })
}
