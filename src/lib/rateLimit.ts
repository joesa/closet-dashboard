import { getSupabaseAdmin } from '@/lib/supabase-admin'

export type RateLimitResult = { allowed: boolean; remaining: number }

function windowStart(now: Date, windowMs: number): string {
  const bucket = Math.floor(now.getTime() / windowMs) * windowMs
  return new Date(bucket).toISOString()
}

/**
 * Fixed-window rate limit, decided in one statement.
 *
 * This used to read the current count, compare it in JavaScript, and write
 * count+1. Every request in flight read the same value and wrote the same
 * increment, so the real limit under concurrency was closer to "one per round
 * trip" than to `max` — on precisely the endpoints where that matters: signup
 * spam, lead capture, and the AI-spend caps on intake generation. The compare
 * and the increment now happen together inside `rate_limit_hit`
 * (20260818211500_rate_limit_hit_allowed_flag.sql), verified with 20 concurrent
 * hits against a limit of 5 admitting exactly 5.
 *
 * It also used to return `allowed: true` whenever the database errored, which
 * meant a failure of the limiter removed every limit at once — the one moment
 * you would least want that. It now fails closed.
 */
export async function checkRateLimit(
  key: string,
  max: number,
  windowMs: number
): Promise<RateLimitResult> {
  if (max <= 0) return { allowed: true, remaining: 0 }

  const admin = getSupabaseAdmin()
  const start = windowStart(new Date(), windowMs)

  const { data, error } = await admin.rpc('rate_limit_hit', {
    p_key: key,
    p_window_start: start,
    p_limit: max,
  })

  if (error) {
    console.error('[rateLimit] failing closed:', error.message)
    return { allowed: false, remaining: 0 }
  }

  const row = Array.isArray(data) ? data[0] : (data as { new_count?: number; allowed?: boolean })
  if (!row || typeof row.allowed !== 'boolean') {
    console.error('[rateLimit] unexpected response, failing closed')
    return { allowed: false, remaining: 0 }
  }

  return {
    allowed: row.allowed,
    remaining: Math.max(0, max - (row.new_count ?? max)),
  }
}

export function hashRateKey(prefix: string, value: string): string {
  return `${prefix}:${value.trim().toLowerCase()}`
}
