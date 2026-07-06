import { NextResponse } from 'next/server'
import { requireAdmin, logAdminAction } from '@/lib/admin'
import { autoFixTenantSite } from '@/lib/validation/autoFixSiteIssues'

/**
 * Admin clicks "Fix with AI" on a failed validation report: applies every
 * deterministic repair available for the current issues (theme/layout
 * mismatch, missing nav, duplicate design, broken images), re-validates, and
 * returns an AI-written plain-English summary of what changed / what still
 * needs manual attention.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await params

  try {
    const adminUser = await requireAdmin()

    const result = await autoFixTenantSite(tenantId)

    await logAdminAction({
      actor: adminUser,
      action: 'site.ai_fix',
      targetType: 'tenant',
      targetId: tenantId,
      metadata: {
        status: result.report.status,
        fixesApplied: result.fixesApplied.length,
        remainingIssues: result.report.issues.length,
      },
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Site auto-fix error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Auto-fix failed' },
      { status: 500 }
    )
  }
}
