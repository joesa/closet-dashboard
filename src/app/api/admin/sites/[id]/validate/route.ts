import { NextResponse } from 'next/server'
import { requireAdmin, logAdminAction } from '@/lib/admin'
import { validateTenantSite, saveValidationReport } from '@/lib/validation/siteValidator'

/**
 * Re-runs the full site-validation battery for a tenant on demand (admin
 * clicks "Re-validate" from /admin/sites/[id] after fixing something
 * themselves, or just to refresh the report).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await params

  try {
    const adminUser = await requireAdmin()

    const report = await validateTenantSite(tenantId)
    await saveValidationReport(tenantId, report)

    await logAdminAction({
      actor: adminUser,
      action: 'site.validate',
      targetType: 'tenant',
      targetId: tenantId,
      metadata: { status: report.status, issueCount: report.issues.length },
    })

    return NextResponse.json({ report })
  } catch (error) {
    console.error('Site validation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Validation failed' },
      { status: 500 }
    )
  }
}
