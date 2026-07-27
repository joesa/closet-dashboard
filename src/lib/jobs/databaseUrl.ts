import { Pool, type PoolConfig } from 'pg'

/**
 * Session-mode Postgres URI for Graphile Worker (LISTEN/NOTIFY).
 * Prefer DATABASE_URL; never use the transaction pooler (:6543).
 */
export function getGraphileDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    throw new Error(
      'DATABASE_URL is required to enqueue background jobs (Supabase session-mode Postgres URI on port 5432).'
    )
  }
  if (/:(?:6543)\b/.test(url)) {
    throw new Error(
      'DATABASE_URL appears to use the transaction pooler (:6543). Use session mode on port 5432 for Graphile Worker.'
    )
  }
  return normalizeConnectionString(url)
}

export function canEnqueueBackgroundJobs(): boolean {
  return !!process.env.DATABASE_URL?.trim()
}

/**
 * Normalize URI for node-pg + Supabase.
 * Avoid bare `sslmode=require` (pg v8 treats it as verify-full). Prefer
 * uselibpqcompat so rejectUnauthorized:false in PoolConfig is honored.
 */
function normalizeConnectionString(url: string): string {
  let out = url.trim()
  // Drop sslmode= so Pool `ssl` options win; re-add libpq-compat require.
  out = out.replace(/([?&])sslmode=[^&]*/gi, '$1').replace(/[?&]$/, '')
  out = out.replace(/\?&/, '?').replace(/&&+/g, '&')
  const join = out.includes('?') ? '&' : '?'
  if (!/[?&]uselibpqcompat=/i.test(out)) {
    out = `${out}${join}uselibpqcompat=true&sslmode=require`
  } else if (!/[?&]sslmode=/i.test(out)) {
    out = `${out}&sslmode=require`
  }
  return out
}

/** pg.Pool options that work with Supabase session pooler TLS. */
export function graphilePoolConfig(connectionString?: string): PoolConfig {
  const cs = normalizeConnectionString(
    connectionString?.trim() || getGraphileDatabaseUrl()
  )
  return {
    connectionString: cs,
    // Supabase presents a chain that Node rejects under verify-full aliases.
    ssl: { rejectUnauthorized: false },
    max: 2,
  }
}

export function createGraphilePool(connectionString?: string): Pool {
  const pool = new Pool(graphilePoolConfig(connectionString))
  // Graphile Worker requires both listeners when you pass a custom pgPool.
  pool.on('error', (err) => {
    console.error('[graphile-pool] idle client error:', err.message)
  })
  pool.on('connect', () => {
    /* required by graphile-worker assertPool; no-op */
  })
  return pool
}
