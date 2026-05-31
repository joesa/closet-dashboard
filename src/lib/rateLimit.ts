import { getSupabaseAdmin } from '@/lib/supabase-admin'

export type RateLimitResult = { allowed: boolean; remaining: number }

function windowStart(now: Date, windowMs: number): string {
  const bucket = Math.floor(now.getTime() / windowMs) * windowMs
  return new Date(bucket).toISOString()
}

/**
 * Increment a counter in rate_limit_buckets; reject when count would exceed max.
 */
export async function checkRateLimit(
  key: string,
  max: number,
  windowMs: number
): Promise<RateLimitResult> {
  const admin = getSupabaseAdmin()
  const start = windowStart(new Date(), windowMs)

  const { data: existing } = await admin
    .from('rate_limit_buckets')
    .select('count')
    .eq('bucket_key', key)
    .eq('window_start', start)
    .maybeSingle()

  const count = existing?.count ?? 0
  if (count >= max) {
    return { allowed: false, remaining: 0 }
  }

  const { error } = await admin.from('rate_limit_buckets').upsert(
    {
      bucket_key: key,
      window_start: start,
      count: count + 1,
    },
    { onConflict: 'bucket_key,window_start' }
  )

  if (error) {
    console.error('rate limit upsert failed:', error)
    return { allowed: true, remaining: max }
  }

  return { allowed: true, remaining: Math.max(0, max - count - 1) }
}

export function hashRateKey(prefix: string, value: string): string {
  return `${prefix}:${value.trim().toLowerCase()}`
}
