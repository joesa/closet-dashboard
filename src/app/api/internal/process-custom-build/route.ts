import { NextResponse } from 'next/server'

/**
 * DEPRECATED — Full redesign runs on Graphile Worker (Render), not Vercel.
 * Kept as a no-op so old kicks / bookmarks return a clear error instead of
 * reintroducing the 800s serverless timeout path.
 */
export const runtime = 'nodejs'
export const maxDuration = 10

function authorize(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

const GONE = {
  error:
    'Deprecated. Full redesign is processed by Graphile Worker via enqueueJob(full_redesign). Use DATABASE_URL + the Render worker.',
  deprecated: true,
}

export async function POST(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(GONE, { status: 410 })
}

export async function GET(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(GONE, { status: 410 })
}
