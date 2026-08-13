import type { Task } from 'graphile-worker'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { markOracleExecution, type IntakeGenerationOperation } from '@/lib/jobs/intakeGeneration'
import { POST as runIntakeGenerateLogo } from '@/app/api/intake/[token]/generate-logo/route'
import { POST as runIntakeSuggestCustomers } from '@/app/api/intake/[token]/suggest-customers/route'
import { POST as runIntakeGeneratePageCopy } from '@/app/api/intake/[token]/generate-page-copy/route'
import { POST as runIntakeSuggestPages } from '@/app/api/intake/[token]/suggest-pages/route'
import { POST as runIntakeResolveCustomIndustry } from '@/app/api/intake/[token]/resolve-custom-industry/route'
import { POST as runIntakeSuggestCraft } from '@/app/api/intake/[token]/suggest-craft/route'
import { POST as runIntakeSuggestDomains } from '@/app/api/intake/[token]/suggest-domains/route'
import { POST as runIntakePreviewPresentation } from '@/app/api/intake/[token]/preview-presentation/route'

type Payload = { jobId?: string; token?: string; operation?: IntakeGenerationOperation }
type Runner = (
  req: Request,
  context: { params: Promise<{ token: string }> }
) => Promise<Response>

const RUNNERS: Record<IntakeGenerationOperation, Runner> = {
  'generate-logo': runIntakeGenerateLogo,
  'suggest-customers': runIntakeSuggestCustomers,
  'generate-page-copy': runIntakeGeneratePageCopy,
  'suggest-pages': runIntakeSuggestPages,
  'resolve-custom-industry': runIntakeResolveCustomIndustry,
  'suggest-craft': runIntakeSuggestCraft,
  'suggest-domains': runIntakeSuggestDomains,
  'preview-presentation': runIntakePreviewPresentation,
}

export const intakeGenerationTask: Task = async (rawPayload, helpers) => {
  const { jobId, token, operation } = rawPayload as Payload
  if (!jobId || !token || !operation || !RUNNERS[operation]) {
    throw new Error('intake_generation requires a valid jobId, token, and operation')
  }

  const admin = getSupabaseAdmin()
  const { data: job, error: loadError } = await admin
    .from('intake_generation_jobs')
    .select('payload, status')
    .eq('id', jobId)
    .single()
  if (loadError || !job) throw new Error('Intake generation job not found')
  if (job.status === 'succeeded') return

  await admin
    .from('intake_generation_jobs')
    .update({
      status: 'processing',
      error: null,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)

  try {
    const request = markOracleExecution(new Request(`http://oracle.local/intake/${token}/${operation}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(job.payload ?? {}),
    }))
    const response = await RUNNERS[operation](request, { params: Promise.resolve({ token }) })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      const message =
        result && typeof result === 'object' && 'error' in result && typeof result.error === 'string'
          ? result.error
          : `${operation} failed with status ${response.status}`
      throw new Error(message)
    }

    await admin
      .from('intake_generation_jobs')
      .update({
        status: 'succeeded',
        result,
        error: null,
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
    helpers.logger.info(`intake_generation ${operation} succeeded ${jobId}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await admin
      .from('intake_generation_jobs')
      .update({
        status: 'failed',
        error: message,
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
    throw error
  }
}
