import { NextResponse } from 'next/server'
import { requireAdmin, logAdminAction } from '@/lib/admin'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { isLaunchBuildPaid } from '@/lib/intake/intakePaymentStage'
import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: intakeId } = await params
  const base = new URL(req.url)

  try {
    const adminUser = await requireAdmin()
    const admin = getSupabaseAdmin()

    const { data: row, error: loadErr } = await admin
      .from('prospect_intakes')
      .select(
        'id, intake_tier, build_paid_at, balance_paid_at, provisioned_contractor_id'
      )
      .eq('id', intakeId)
      .maybeSingle()

    if (loadErr) throw loadErr
    if (!row) {
      return NextResponse.redirect(
        new URL('/admin/intakes?error=intake_not_found', base),
        303
      )
    }

    if (!isLaunchBuildPaid(row as ProspectIntakeRow)) {
      return NextResponse.redirect(
        new URL(`/admin/intakes/${intakeId}?error=launch_not_paid`, base),
        303
      )
    }

    if (!row.provisioned_contractor_id) {
      return NextResponse.redirect(
        new URL(`/admin/intakes/${intakeId}?error=no_contractor`, base),
        303
      )
    }

    const { data: tenant, error: tenantErr } = await admin
      .from('tenants')
      .update({ site_status: 'active' })
      .eq('id', row.provisioned_contractor_id)
      .select('id, site_status')
      .maybeSingle()

    if (tenantErr) throw tenantErr
    if (!tenant) {
      return NextResponse.redirect(
        new URL(`/admin/intakes/${intakeId}?error=tenant_not_found`, base),
        303
      )
    }

    await logAdminAction({
      actor: adminUser,
      action: 'intake.publish_after_launch',
      targetType: 'intake',
      targetId: intakeId,
      metadata: {
        contractor_id: row.provisioned_contractor_id,
        site_status: tenant.site_status,
      },
    })

    const dest = new URL(`/admin/intakes/${intakeId}`, base)
    if (tenant.site_status === 'active') {
      dest.searchParams.set('site_published', '1')
    }
    return NextResponse.redirect(dest, 303)
  } catch (error) {
    console.error('publish-site error:', error)
    return NextResponse.redirect(
      new URL(`/admin/intakes/${intakeId}?error=publish_failed`, base),
      303
    )
  }
}
