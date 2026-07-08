import { processProvisionQueue } from '@/lib/provision/processProvisionQueue'

function loginOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    'http://localhost:3001'
  )
}

/**
 * Fire-and-forget: start building as soon as the intake is submitted instead of
 * waiting for the daily cron window.
 */
export function kickProvisionAfterSubmit(intakeId: string): void {
  void processProvisionQueue(loginOrigin(), { batchSize: 1, intakeId }).catch((err) => {
    console.error('kickProvisionAfterSubmit failed:', err)
  })
}
