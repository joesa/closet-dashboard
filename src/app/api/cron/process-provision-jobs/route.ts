import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  provisionFromIntakeJob,
  classifyProvisionError,
  type ProvisionJobRow,
} from '@/lib/provision/provisionFromIntake'

export const runtime = 'nodejs'
export const maxDuration = 300

const MAX_ATTEMPTS = parseInt(process.env.PROVISION_MAX_ATTEMPTS || '3', 10)
const BATCH_SIZE = parseInt(process.env.PROVISION_BATCH_SIZE || '5', 10)

function loginOrigin(req: Request): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    new URL(req.url).origin
  )
}

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getSupabaseAdmin()
  const origin = loginOrigin(req)
  const results: Array<{ jobId: string; status: string; error?: string }> = []

  const { data: pending } = await admin
    .from('provision_jobs')
    .select('id, intake_id, status, mode, attempts')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)

  for (const job of pending ?? []) {
    const started = new Date().toISOString()
    await admin
      .from('provision_jobs')
      .update({ status: 'processing', started_at: started, attempts: job.attempts + 1 })
      .eq('id', job.id)
      .eq('status', 'pending')

    try {
      await provisionFromIntakeJob(job as ProvisionJobRow, origin)
      await admin
        .from('provision_jobs')
        .update({
          status: 'succeeded',
          finished_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('id', job.id)
      results.push({ jobId: job.id, status: 'succeeded' })
    } catch (err) {
      const kind = classifyProvisionError(err)
      const message = err instanceof Error ? err.message : String(err)
      const attempts = job.attempts + 1
      const needsReview = kind === 'needs_review'
      const terminal = needsReview || attempts >= MAX_ATTEMPTS
      const nextStatus = needsReview ? 'needs_review' : terminal ? 'failed' : 'pending'

      await admin
        .from('provision_jobs')
        .update({
          status: nextStatus,
          last_error: message,
          finished_at: terminal ? new Date().toISOString() : null,
        })
        .eq('id', job.id)

      results.push({ jobId: job.id, status: nextStatus, error: message })
      console.error('provision job error', job.id, message)
    }
  }

  return NextResponse.json({
    processed: results.length,
    results,
  })
}
