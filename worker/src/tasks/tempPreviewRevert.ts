import type { Task } from 'graphile-worker'
import { revertTempPreviewIfDue } from '@/lib/intake/tempPreviewAccess'

export type TempPreviewRevertPayload = { tenantId: string }

/**
 * Auto-expire an admin-granted temporary preview window back to the real
 * payment-gated site_status — the "cron" half of the temp-preview feature.
 * Scheduled by grantTempPreview() via runAt; a later grant replaces this job
 * (jobKeyMode: 'replace'), so a stale invocation firing after the window was
 * extended or manually ended is a defensive no-op, not a bug.
 */
export const tempPreviewRevertTask: Task = async (payload, helpers) => {
  const { tenantId } = (payload ?? {}) as TempPreviewRevertPayload
  if (!tenantId) throw new Error('temp_preview_revert requires tenantId')

  const result = await revertTempPreviewIfDue(tenantId)
  helpers.logger.info(
    result.reverted
      ? `temp_preview_revert ${tenantId}: reverted to payment-gated status`
      : `temp_preview_revert ${tenantId}: no-op (already reverted or extended)`
  )
}
