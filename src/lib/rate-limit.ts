import { getSupabaseAdmin } from '@/lib/supabase-admin'

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number }

/**
 * Fixed-window rate limit keyed by caller (e.g. contractor + IP hash).
 * Uses service role; safe for Edge routes that have SUPABASE_SERVICE_ROLE_KEY.
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
  const windowStart = new Date(windowStartMs).toISOString()

  const { data: existing, error: readError } = await admin
    .from('api_rate_limits')
    .select('count, window_start')
    .eq('key', key)
    .maybeSingle()

  if (readError) {
    console.error('rate-limit read failed:', readError.message)
    return { allowed: true }
  }

  const existingStart = existing?.window_start
    ? new Date(existing.window_start).getTime()
    : 0

  if (!existing || existingStart < windowStartMs) {
    const { error: upsertError } = await admin.from('api_rate_limits').upsert({
      key,
      window_start: windowStart,
      count: 1,
    })
    if (upsertError) {
      console.error('rate-limit upsert failed:', upsertError.message)
      return { allowed: true }
    }
    return { allowed: true }
  }

  if ((existing.count ?? 0) >= limit) {
    const retryAfterSeconds = Math.ceil(
      (windowStartMs + windowMs - now) / 1000
    )
    return { allowed: false, retryAfterSeconds: Math.max(1, retryAfterSeconds) }
  }

  const { error: updateError } = await admin
    .from('api_rate_limits')
    .update({ count: (existing.count ?? 0) + 1 })
    .eq('key', key)

  if (updateError) {
    console.error('rate-limit update failed:', updateError.message)
    return { allowed: true }
  }

  return { allowed: true }
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
