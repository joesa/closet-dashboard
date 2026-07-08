import type { SupabaseClient } from '@supabase/supabase-js'
import { hashSeed } from '@/lib/catalog/designFingerprint'

/**
 * Choose a theme from an industry's theme pool so that new sites SPREAD across
 * the available themes instead of colliding on one.
 *
 * Why not just hash the business name into the pool? A single `hash % poolSize`
 * pick collides for ~1/poolSize of business pairs — e.g. two tree services can
 * (and did) hash to the same index and render with an identical palette +
 * typography. Structure is already made unique per-site by resolveDesignSeed,
 * but the theme (color + type voice) is the single strongest visual signal, so
 * two sites sharing it still read as cookie-cutter.
 *
 * This probes how many existing sites already use each theme in the pool and
 * picks the LEAST-used one (seeded tie-break for determinism + divergence).
 * Because sites are provisioned one at a time, the second business in a trade
 * sees the first's theme as "taken" and diverges to a different one — until the
 * pool is saturated, at which point it round-robins by usage. Deterministic and
 * overridable: it only *recommends*; the operator/AI can still pin a theme.
 */
export async function pickDiverseTheme(opts: {
  supabase: SupabaseClient
  pool: string[]
  seed: string
  fallback: string
}): Promise<string> {
  const { supabase, pool, seed, fallback } = opts
  const themes = pool.filter((t) => typeof t === 'string' && t.length > 0)
  if (themes.length === 0) return fallback
  if (themes.length === 1) return themes[0]

  const counts = new Map<string, number>(themes.map((t) => [t, 0]))
  try {
    const { data, error } = await supabase
      .from('site_configs')
      .select('theme')
      .in('theme', themes)
    if (!error && Array.isArray(data)) {
      for (const row of data as Array<{ theme: string | null }>) {
        if (row.theme && counts.has(row.theme)) {
          counts.set(row.theme, (counts.get(row.theme) ?? 0) + 1)
        }
      }
    }
  } catch {
    // DB probe failed — fall through to a purely seeded pick below.
  }

  const min = Math.min(...themes.map((t) => counts.get(t) ?? 0))
  const leastUsed = themes.filter((t) => (counts.get(t) ?? 0) === min)
  return leastUsed[hashSeed(seed) % leastUsed.length]
}
