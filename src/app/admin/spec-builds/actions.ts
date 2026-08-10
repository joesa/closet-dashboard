'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { logAdminAction, requireAdmin } from '@/lib/admin'
import { addAdminFact } from '@/lib/spec/addAdminFact'
import { overrideSpecBuildToDrafting } from '@/lib/spec/overrideSpecBuild'
import { approveSpecOffer } from '@/lib/spec/specOffer'
import { sendSpecOfferSms } from '@/lib/spec/sendSpecOfferSms'
import { advanceSpecBuild } from '@/lib/spec/advanceSpecBuild'
import { kickSpecBuild } from '@/lib/spec/kickSpecBuild'
import { deleteSpecBuild, getSpecBuild, transitionSpecBuild } from '@/lib/spec/specBuilds'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { withoutPublicProfileResearch } from '@/lib/spec/research/publicProfileResearch'
import { isFacebookUrl, isYelpBusinessUrl } from '@/lib/spec/research/sources'

/**
 * Add a fact by hand to rescue a lead that publishes nothing verifiable.
 *
 * The admin's identity travels with the fact rather than only into the audit
 * log: it is rendered next to the claim in the ledger, so whoever reviews the
 * finished site can see which claims a machine read off a page and which a
 * colleague vouched for.
 */
export async function addFactAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin()
  const id = String(formData.get('spec_build_id') || '')
  if (!id) return

  const result = await addAdminFact({
    buildId: id,
    field: String(formData.get('field') || ''),
    value: String(formData.get('value') || ''),
    note: String(formData.get('note') || ''),
    // An admin fact must carry a name. Falling back to the user id keeps that
    // true even for an account with no email on its profile.
    addedBy: admin.email || admin.id,
  })

  if (!result.ok) {
    revalidatePath(`/admin/spec-builds/${id}`)
    redirect(`/admin/spec-builds/${id}?fact_error=${encodeURIComponent(result.reason)}`)
  }

  await logAdminAction({
    actor: admin,
    action: 'spec_build.fact_added',
    targetType: 'spec_build',
    targetId: id,
    metadata: {
      field: String(formData.get('field') || ''),
      note: String(formData.get('note') || ''),
      redrafted: result.redrafted,
    },
  })

  revalidatePath('/admin/spec-builds')
  redirect(
    `/admin/spec-builds/${id}?fact_added=${result.redrafted ? 'drafting' : 'stored'}`
  )
}

/**
 * Run (or re-run) research for one build and fill its intake row.
 *
 * Admin-triggered rather than automatic for the whole of Phase 2: research is
 * the step whose output has to be read by a person before anyone trusts it to
 * run unattended, and the fact ledger is what there is to read.
 */
export async function runResearchAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin()
  const id = String(formData.get('spec_build_id') || '')
  if (!id) return

  const build = await getSpecBuild(id)
  if (!build) return

  // Re-running a finished or failed build means starting its research over,
  // so put it back in the queue first.
  if (build.status !== 'queued' && build.status !== 'researching') {
    await transitionSpecBuild(id, build.status, 'queued', {
      last_error: null,
      status_reason: null,
    })
  }

  const result = await advanceSpecBuild(id)
  // Run the first step here so the admin sees an immediate result, then let the
  // worker carry the rest.
  if (!result.done) kickSpecBuild(id)

  await logAdminAction({
    actor: admin,
    action: 'spec_build.research_run',
    targetType: 'spec_build',
    targetId: id,
    metadata: { from: result.from, to: result.to, note: result.note },
  })

  revalidatePath('/admin/spec-builds')
  revalidatePath(`/admin/spec-builds/${id}`)
}

/** Update public research sources on an unprovisioned build, then rerun research. */
export async function updateResearchSourcesAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin()
  const id = String(formData.get('spec_build_id') || '')
  if (!id) return

  const build = await getSpecBuild(id)
  if (!build) return
  const facebookUrl = String(formData.get('facebook_url') || '').trim()
  const yelpUrl = String(formData.get('yelp_url') || '').trim()

  if (facebookUrl && !isFacebookUrl(facebookUrl)) {
    redirect(`/admin/spec-builds/${id}?source_error=${encodeURIComponent('Enter a valid Facebook page URL.')}`)
  }
  if (yelpUrl && !isYelpBusinessUrl(yelpUrl)) {
    redirect(`/admin/spec-builds/${id}?source_error=${encodeURIComponent('Enter a Yelp business URL whose path starts with /biz/.')}`)
  }
  if (build.tenant_id || !['queued', 'needs_attention'].includes(build.status)) {
    redirect(`/admin/spec-builds/${id}?source_error=${encodeURIComponent('Sources can only be changed before drafting or provisioning starts.')}`)
  }

  const { data, error } = await getSupabaseAdmin()
    .from('spec_builds')
    .update({
      lead_input: {
        ...withoutPublicProfileResearch(build.lead_input),
        socialProfileUrl: facebookUrl || null,
        yelpUrl: yelpUrl || null,
      },
      status: 'queued',
      status_reason: null,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .in('status', ['queued', 'needs_attention'])
    .is('tenant_id', null)
    .select('id')

  if (error || !data?.length) {
    redirect(`/admin/spec-builds/${id}?source_error=${encodeURIComponent(error?.message || 'The build changed before its sources could be saved.')}`)
  }

  const result = await advanceSpecBuild(id)
  if (!result.done) kickSpecBuild(id)

  await logAdminAction({
    actor: admin,
    action: 'spec_build.sources_updated',
    targetType: 'spec_build',
    targetId: id,
    metadata: { facebookUrl: facebookUrl || null, yelpUrl: yelpUrl || null },
  })

  revalidatePath('/admin/spec-builds')
  redirect(`/admin/spec-builds/${id}?sources_updated=1`)
}

/**
 * Move a build forward one step by hand.
 *
 * One step per press rather than looping to completion: site generation and
 * imaging each take tens of seconds and cost real money, and a server action
 * that ran the whole chain would blow past any request timeout and leave the
 * build half-done with nobody watching. Pressing again is cheap; a stuck
 * request is not.
 */
export async function advanceSpecBuildAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin()
  const id = String(formData.get('spec_build_id') || '')
  if (!id) return

  const result = await advanceSpecBuild(id)
  if (!result.done) kickSpecBuild(id)

  await logAdminAction({
    actor: admin,
    action: 'spec_build.advanced',
    targetType: 'spec_build',
    targetId: id,
    metadata: { from: result.from, to: result.to, note: result.note },
  })

  revalidatePath('/admin/spec-builds')
  redirect(
    `/admin/spec-builds/${id}?advanced=${encodeURIComponent(
      `${result.from} → ${result.to}${result.note ? ` (${result.note})` : ''}`
    )}`
  )
}

export async function overrideSpecBuildAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin()
  const id = String(formData.get('spec_build_id') || '')
  const note = String(formData.get('override_note') || '').trim()
  if (!id) return
  if (note.length < 15) {
    redirect(
      `/admin/spec-builds/${id}?fact_error=${encodeURIComponent('Add a short reason (at least 15 characters) before overriding.')}`
    )
  }

  const result = await overrideSpecBuildToDrafting(id)
  if (!result.ok) {
    redirect(`/admin/spec-builds/${id}?fact_error=${encodeURIComponent(result.reason)}`)
  }

  await logAdminAction({
    actor: admin,
    action: 'spec_build.override_to_drafting',
    targetType: 'spec_build',
    targetId: id,
    metadata: {
      note,
      from: result.from,
      to: result.to,
      intakeId: result.intakeId,
    },
  })

  revalidatePath('/admin/spec-builds')
  redirect(`/admin/spec-builds/${id}?advanced=${encodeURIComponent('needs_attention → drafting (admin override)')}`)
}

/**
 * Approve a finished build and start the offer clock.
 *
 * The last gate before a real business is contacted. approveSpecOffer refuses
 * unless site validation passed — that check is the reason this step is manual
 * rather than another automated transition.
 */
export async function approveSpecBuildAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin()
  const id = String(formData.get('spec_build_id') || '')
  if (!id) return

  const build = await getSpecBuild(id)
  if (!build) return

  const result = await approveSpecOffer(build)
  if (!result.ok) {
    revalidatePath(`/admin/spec-builds/${id}`)
    redirect(`/admin/spec-builds/${id}?fact_error=${encodeURIComponent(result.reason)}`)
  }

  // Send now rather than waiting for the cron. The button says send, so it
  // should send — and with a once-daily cron, "approved" would otherwise mean
  // "goes out sometime in the next 24 hours", which is not something to leave
  // ambiguous when the next step is a stranger's phone buzzing.
  const approved = await getSpecBuild(id)
  const outcome = approved
    ? await sendSpecOfferSms(approved, 1)
    : ({ sent: false, reason: 'no_offer' } as const)

  await logAdminAction({
    actor: admin,
    action: 'spec_build.approved',
    targetType: 'spec_build',
    targetId: id,
    metadata: {
      offerCents: result.pricing.offerCents,
      deadlineAt: result.deadlineAt,
      smsSent: outcome.sent,
      smsReason: outcome.sent ? null : outcome.reason,
    },
  })

  revalidatePath('/admin/spec-builds')
  redirect(`/admin/spec-builds/${id}?sent=${encodeURIComponent(outcome.sent ? 'yes' : outcome.reason)}`)
}

export async function rejectSpecBuildAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin()
  const id = String(formData.get('spec_build_id') || '')
  if (!id) return

  const build = await getSpecBuild(id)
  if (!build) return

  await transitionSpecBuild(id, build.status, 'rejected', {
    status_reason: String(formData.get('reason') || 'Rejected by admin'),
  })
  // Schedule the teardown. A rejected build is one we will never show anyone,
  // so there is no reason to keep a real business's name on a live subdomain.
  await getSupabaseAdmin()
    .from('spec_builds')
    .update({ purge_after: new Date().toISOString() })
    .eq('id', id)

  await logAdminAction({
    actor: admin,
    action: 'spec_build.rejected',
    targetType: 'spec_build',
    targetId: id,
  })

  revalidatePath('/admin/spec-builds')
  revalidatePath(`/admin/spec-builds/${id}`)
}

export async function deleteSpecBuildAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin()
  const id = String(formData.get('spec_build_id') || '')
  if (!id) return

  const build = await getSpecBuild(id)
  if (!build) redirect('/admin/spec-builds')

  const result = await deleteSpecBuild(id)
  if (!result.deleted) return

  await logAdminAction({
    actor: admin,
    action: 'spec_build.deleted',
    targetType: 'spec_build',
    targetId: id,
    metadata: {
      businessName: build.business_name,
      previousStatus: build.status,
      intakeDeleted: result.intakeDeleted,
    },
  })

  revalidatePath('/admin/spec-builds')
  redirect('/admin/spec-builds')
}
