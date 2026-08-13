import { NextResponse } from 'next/server'
import { getIntakeByToken } from '@/lib/intake/getIntakeByToken'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { canEnqueueBackgroundJobs, enqueueJob } from '@/lib/jobs/enqueueJob'
import { TASK_INTAKE_GENERATION } from '@/lib/jobs/taskIds'

export const INTAKE_GENERATION_OPERATIONS = [
  'generate-logo',
  'suggest-customers',
  'generate-page-copy',
  'suggest-pages',
  'resolve-custom-industry',
  'suggest-craft',
  'suggest-domains',
  'preview-presentation',
] as const

export type IntakeGenerationOperation = (typeof INTAKE_GENERATION_OPERATIONS)[number]

const ORACLE_EXECUTION = Symbol.for('ditchtheform.intake-generation.oracle-execution')
type OracleRequest = Request & { [ORACLE_EXECUTION]?: true }

/** In-process marker: cannot be supplied by an external HTTP caller. */
export function markOracleExecution(req: Request): Request {
  ;(req as OracleRequest)[ORACLE_EXECUTION] = true
  return req
}

export function isOracleExecution(req: Request): boolean {
  return (req as OracleRequest)[ORACLE_EXECUTION] === true
}

export async function enqueueIntakeGeneration(
  req: Request,
  token: string,
  operation: IntakeGenerationOperation
) {
  if (!canEnqueueBackgroundJobs()) {
    return NextResponse.json(
      { error: 'Background generation is temporarily unavailable.' },
      { status: 503 }
    )
  }

  const intake = await getIntakeByToken(token)
  if (!intake) return NextResponse.json({ error: 'Intake not found' }, { status: 404 })
  if (intake.status === 'archived') {
    return NextResponse.json({ error: 'This intake link is no longer active' }, { status: 410 })
  }

  const payload = await req.json().catch(() => ({}))
  const admin = getSupabaseAdmin()
  const { data: job, error } = await admin
    .from('intake_generation_jobs')
    .insert({ intake_id: intake.id, operation, payload, status: 'queued' })
    .select('id')
    .single()

  if (error || !job) {
    console.error('Unable to create intake generation job:', error)
    return NextResponse.json({ error: 'Unable to queue generation.' }, { status: 500 })
  }

  try {
    await enqueueJob(
      TASK_INTAKE_GENERATION,
      { jobId: job.id, token, operation },
      { jobKey: `intake_generation:${job.id}`, maxAttempts: 1 }
    )
  } catch (enqueueError) {
    const message = enqueueError instanceof Error ? enqueueError.message : String(enqueueError)
    await admin
      .from('intake_generation_jobs')
      .update({ status: 'failed', error: message, finished_at: new Date().toISOString() })
      .eq('id', job.id)
    throw enqueueError
  }

  return NextResponse.json(
    {
      async: true,
      queued: true,
      jobId: job.id,
      statusUrl: `/api/intake/${token}/generation-jobs/${job.id}`,
    },
    { status: 202 }
  )
}
