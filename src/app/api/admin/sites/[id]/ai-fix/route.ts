import { NextResponse } from 'next/server'
import { requireAdmin, logAdminAction } from '@/lib/admin'
import { autoFixTenantSite } from '@/lib/validation/autoFixSiteIssues'

/**
 * Admin clicks "Fix with AI" on a validation issue (or "Fix all"): applies
 * deterministic repairs for fixable issues (theme/layout mismatch, missing
 * nav, duplicate design, broken images, process steps), re-validates, and
 * returns an AI-written plain-English summary of what changed / what still
 * needs manual attention.
 *
 * Optional JSON body: `{ "codes": ["theme_layout_mismatch"] }` to fix only
 * those issue codes. Omit / empty = fix every fixable issue.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tenantId } = await params

  try {
    const adminUser = await requireAdmin()

    let codes: string[] | undefined
    try {
      const body = (await req.json()) as { codes?: unknown }
      if (Array.isArray(body?.codes)) {
        codes = body.codes.filter((c): c is string => typeof c === 'string' && !!c.trim())
      }
    } catch {
      // Empty body is fine — fix all.
    }

    const result = await autoFixTenantSite(tenantId, codes?.length ? { codes } : undefined)

    await logAdminAction({
      actor: adminUser,
      action: 'site.ai_fix',
      targetType: 'tenant',
      targetId: tenantId,
      metadata: {
        status: result.report.status,
        fixesApplied: result.fixesApplied.length,
        remainingIssues: result.report.issues.length,
        codes: codes || null,
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
