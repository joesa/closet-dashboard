import { PUBLIC_API_URL } from '@/lib/urls'

/**
 * Start Full redesign work in a *new* serverless invocation.
 *
 * Calling `processCustomBuildJob` inside `after()` still shares the parent
 * route's maxDuration (300s). Claude alone can use ~4.5 minutes, so the
 * worker is killed and the UI reports "timed out after ~5 minutes".
 *
 * Fire-and-forget POST to `/api/internal/process-custom-build` (maxDuration
 * 800s) so enhance + generate + images get a full fresh budget.
 */
export function kickCustomBuildProcessor(tenantId: string): void {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) {
    console.error(
      '[kickCustomBuildProcessor] CRON_SECRET missing — cannot start processor for',
      tenantId
    )
    return
  }

  const base =
    PUBLIC_API_URL.replace(/\/$/, '') ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')
  if (!base) {
    console.error('[kickCustomBuildProcessor] no base URL for', tenantId)
    return
  }

  const url = `${base}/api/internal/process-custom-build`
  void fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tenantId }),
    // Don't wait — parent after() must return quickly.
    cache: 'no-store',
  }).catch((err) => {
    console.error('[kickCustomBuildProcessor] fetch failed', tenantId, err)
  })
}
