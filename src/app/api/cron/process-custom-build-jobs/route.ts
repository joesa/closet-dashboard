import { NextResponse } from 'next/server'
import {
  listActiveCustomBuildTenantIds,
} from '@/lib/ai/customBuildJob'
import { kickCustomBuildProcessor } from '@/lib/ai/kickCustomBuildProcessor'

/**
 * Safety-net cron: re-kick any queued/processing Full redesign jobs so a
 * missed fire-and-forget fetch cannot leave the admin stuck.
 */
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ids = await listActiveCustomBuildTenantIds()
  for (const id of ids) {
    kickCustomBuildProcessor(id)
  }

  return NextResponse.json({
    kicked: ids.length,
    tenantIds: ids,
  })
}
