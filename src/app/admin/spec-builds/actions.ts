'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { logAdminAction, requireAdmin } from '@/lib/admin'
import { addAdminFact } from '@/lib/spec/addAdminFact'
import { advanceSpecBuild } from '@/lib/spec/advanceSpecBuild'
import { deleteSpecBuild, getSpecBuild, transitionSpecBuild } from '@/lib/spec/specBuilds'

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

export async function rejectSpecBuildAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin()
  const id = String(formData.get('spec_build_id') || '')
  if (!id) return

  const build = await getSpecBuild(id)
  if (!build) return

  await transitionSpecBuild(id, build.status, 'rejected', {
    status_reason: String(formData.get('reason') || 'Rejected by admin'),
  })

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
