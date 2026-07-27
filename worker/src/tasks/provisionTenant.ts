import type { Task } from 'graphile-worker'
import { processProvisionQueue } from '@/lib/provision/processProvisionQueue'
import { PUBLIC_API_URL } from '@/lib/urls'

export type ProvisionTenantPayload = {
  intakeId: string
}

/**
 * Process a single provision_jobs row for this intake (or the next pending
 * batch if intakeId is omitted). Runs outside Vercel's 300s cron budget.
 */
export const provisionTenantTask: Task = async (payload, helpers) => {
  const { intakeId } = payload as ProvisionTenantPayload
  if (!intakeId || typeof intakeId !== 'string') {
    throw new Error('provision_tenant requires intakeId')
  }

  const loginOrigin = PUBLIC_API_URL.replace(/\/$/, '') || 'https://www.ditchtheform.com'
  helpers.logger.info(`provision_tenant start ${intakeId}`)
  const results = await processProvisionQueue(loginOrigin, {
    batchSize: 1,
    intakeId,
  })
  const failed = results.find((r) => r.status === 'failed' || r.status === 'needs_review')
  if (failed?.status === 'failed') {
    throw new Error(failed.error || 'Provision failed')
  }
  helpers.logger.info(
    `provision_tenant done ${intakeId}: ${results.map((r) => r.status).join(',') || 'noop'}`
  )
}
