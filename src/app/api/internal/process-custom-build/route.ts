import { NextResponse } from 'next/server'
import { processCustomBuildJob } from '@/lib/ai/processCustomBuildJob'
import {
  getAndReconcileCustomBuildJob,
  isCustomBuildJobActive,
  listActiveCustomBuildTenantIds,
} from '@/lib/ai/customBuildJob'
import { kickCustomBuildProcessor } from '@/lib/ai/kickCustomBuildProcessor'

/**
 * Dedicated Full redesign worker. Fresh maxDuration budget (not shared with
 * the admin click handler). Pro Fluid Compute allows up to 800s.
 */
export const runtime = 'nodejs'
export const maxDuration = 800

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

/** Process one tenant (body.tenantId) or all active jobs (cron / sweep). */
export async function POST(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const tenantId =
    typeof body.tenantId === 'string' && body.tenantId.trim()
      ? body.tenantId.trim()
      : null

  if (tenantId) {
    await processCustomBuildJob(tenantId)
    const job = await getAndReconcileCustomBuildJob(tenantId)
    return NextResponse.json({
      tenantId,
      status: job?.status ?? 'none',
      jobActive: isCustomBuildJobActive(job),
    })
  }

  // Sweep: process queued jobs one at a time in this invocation, kick the
  // rest so each gets its own duration budget.
  const ids = await listActiveCustomBuildTenantIds()
  if (ids.length === 0) {
    return NextResponse.json({ processed: 0, kicked: [] })
  }

  const [first, ...rest] = ids
  for (const id of rest) {
    kickCustomBuildProcessor(id)
  }
  await processCustomBuildJob(first)
  return NextResponse.json({ processed: 1, kicked: rest, first })
}

/** Cron entry — same as POST sweep. */
export async function GET(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const ids = await listActiveCustomBuildTenantIds()
  for (const id of ids) {
    kickCustomBuildProcessor(id)
  }
  return NextResponse.json({ kicked: ids.length, tenantIds: ids })
}
