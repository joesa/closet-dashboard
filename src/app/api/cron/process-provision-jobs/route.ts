import { NextResponse } from 'next/server'
import { processProvisionQueue } from '@/lib/provision/processProvisionQueue'
import { publicAppOrigin } from '@/lib/urls'

export const runtime = 'nodejs'
export const maxDuration = 300

function loginOrigin(req: Request): string {
  return publicAppOrigin(new URL(req.url).origin)
}

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = await processProvisionQueue(loginOrigin(req))

  return NextResponse.json({
    processed: results.length,
    results,
  })
}
