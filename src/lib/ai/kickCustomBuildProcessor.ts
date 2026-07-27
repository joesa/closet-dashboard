/**
 * DEPRECATED — Full redesign no longer kicks a Vercel 800s function.
 * Jobs are enqueued with enqueueJob('full_redesign', …) for Graphile Worker.
 * This stub remains so accidental imports compile; it is a no-op.
 */
export function kickCustomBuildProcessor(_tenantId: string): void {
  console.warn(
    '[kickCustomBuildProcessor] no-op — use enqueueJob(full_redesign) / Graphile Worker'
  )
}
