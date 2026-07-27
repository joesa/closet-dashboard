import { NextResponse } from 'next/server'
import {
  canEnqueueBackgroundJobs,
  createGraphilePool,
  getGraphileDatabaseUrl,
} from '@/lib/jobs/databaseUrl'

/**
 * Production readiness for Graphile enqueue.
 * Returns 503 when DATABASE_URL is missing or unusable (Vercel healthcheck target).
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const isProd = process.env.NODE_ENV === 'production'
  const configured = canEnqueueBackgroundJobs()

  if (!configured) {
    return NextResponse.json(
      {
        ok: false,
        graphile: false,
        error: 'DATABASE_URL is not configured',
      },
      { status: isProd ? 503 : 200 }
    )
  }

  let reachable = false
  let detail: string | null = null
  const pool = createGraphilePool()
  try {
    getGraphileDatabaseUrl()
    await pool.query('select 1 as ok')
    reachable = true
  } catch (err) {
    detail = err instanceof Error ? err.message : String(err)
  } finally {
    await pool.end().catch(() => undefined)
  }

  if (!reachable) {
    return NextResponse.json(
      {
        ok: false,
        graphile: false,
        error: detail || 'DATABASE_URL unreachable',
      },
      { status: isProd ? 503 : 200 }
    )
  }

  return NextResponse.json({
    ok: true,
    graphile: true,
  })
}
