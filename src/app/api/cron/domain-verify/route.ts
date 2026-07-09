import { NextResponse } from 'next/server'
import { pollPendingDomains } from '@/lib/domains/manage'

export const runtime = 'nodejs'
export const maxDuration = 300

async function run(req: Request) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await pollPendingDomains(40)
  return NextResponse.json(result)
}

export async function GET(req: Request) {
  return run(req)
}

export async function POST(req: Request) {
  return run(req)
}
