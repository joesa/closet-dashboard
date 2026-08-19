import { getSupabaseAdmin } from '@/lib/supabase-admin'

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number }

/**
 * Fixed-window rate limit keyed by caller (e.g. contractor + IP hash).
 * Uses service role; safe for Edge routes that have SUPABASE_SERVICE_ROLE_KEY.
 */
/**
 * Fixed-window rate limit for the public widget endpoints.
 *
 * Kept as a separate module because its callers need `retryAfterSeconds` for a
 * 429 response, but the counting itself is now the same atomic primitive the
 * rest of the app uses — this was previously a second read-then-write
 * implementation against a second table, with the same race and the same
 * fail-open behaviour on a database error. Both are fixed here: one statement,
 * and a refusal rather than a free pass when the limiter itself fails.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  if (limit <= 0) return { allowed: true }

  const admin = getSupabaseAdmin()
  const now = Date.now()
  const windowMs = windowSeconds * 1000
  const windowStartMs = Math.floor(now / windowMs) * windowMs
  const retryAfterSeconds = Math.max(1, Math.ceil((windowStartMs + windowMs - now) / 1000))

  const { data, error } = await admin.rpc('rate_limit_hit', {
    p_key: key,
    p_window_start: new Date(windowStartMs).toISOString(),
    p_limit: limit,
  })

  if (error) {
    console.error('[rate-limit] failing closed:', error.message)
    return { allowed: false, retryAfterSeconds }
  }

  const row = Array.isArray(data) ? data[0] : (data as { allowed?: boolean })
  if (!row || typeof row.allowed !== 'boolean') {
    console.error('[rate-limit] unexpected response, failing closed')
    return { allowed: false, retryAfterSeconds }
  }

  return row.allowed ? { allowed: true } : { allowed: false, retryAfterSeconds }
}

export async function hashIpForRateLimit(ip: string): Promise<string> {
  if (!ip.trim()) return 'unknown'
  const data = new TextEncoder().encode(ip.trim())
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16)
}
