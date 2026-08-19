/** How long after a submission a repeat from the same address is a duplicate. */
export const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000

export type DedupCandidate = { id: string; created_at: string; duplicate_of?: string | null }

/**
 * Which earlier lead, if any, a new submission repeats.
 *
 * Kept separate from the route and free of I/O so the window arithmetic is
 * testable. Returns the id of the *original* — when a duplicate is itself
 * repeated, the chain is flattened rather than nested, so the inbox only ever
 * has to look one level deep.
 */
export function findRecentDuplicate(
  candidates: DedupCandidate[],
  nowMs: number,
  windowMs: number = DEDUP_WINDOW_MS
): string | null {
  let best: { id: string; at: number } | null = null

  for (const candidate of candidates) {
    const at = new Date(candidate.created_at).getTime()
    if (!Number.isFinite(at)) continue
    if (nowMs - at > windowMs) continue
    // A submission dated in the future is a clock problem, not a duplicate.
    if (at > nowMs) continue
    if (!best || at > best.at) {
      best = { id: candidate.duplicate_of ?? candidate.id, at }
    }
  }

  return best?.id ?? null
}
