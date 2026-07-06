import type { SupabaseClient } from '@supabase/supabase-js'
import { designFingerprint, siteSeed } from '@/lib/catalog/designFingerprint'
import { isForcedPreset } from '@/lib/catalog/designVariantCatalog'

const MAX_PROBES = 250

type ConfigRow = {
  tenant_id: string | null
  design_variant: string | null
  brand_name: string | null
}

function isMissingDesignVariantColumn(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: string; message?: string; details?: string }
  const msg = `${e.message || ''} ${e.details || ''}`.toLowerCase()
  return e.code === 'PGRST204' || msg.includes('design_variant')
}

/** Lowercased, whitespace-collapsed token for stable, answer-derived seeds. */
function norm(s: unknown): string {
  return (s ?? '').toString().trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Deterministically choose a design seed for a new site so that:
 *  1. it is derived from the contractor's answers (so the look is *matched* to
 *     the brand, not arbitrary), and
 *  2. its resulting design fingerprint is not already used by another site in
 *     the same theme (so every build is bespoke — never an exact duplicate).
 *
 * The returned seed is stored on site_configs.design_variant and drives the
 * renderer's entire visual voice (structure + typography + accent color).
 */
export async function resolveDesignSeed(opts: {
  supabase: SupabaseClient
  theme: string
  answers: Array<string | null | undefined>
  fallbackId: string
  excludeTenantId?: string | null
}): Promise<string> {
  const { supabase, theme, answers, fallbackId, excludeTenantId } = opts

  const base = answers.map(norm).filter(Boolean).join('|') || norm(fallbackId)

  // Fingerprints already in use within this theme (auto-seeded sites only;
  // admin-forced presets are a deliberate choice and are left out of the probe).
  const used = new Set<string>()
  const { data, error } = await supabase
    .from('site_configs')
    .select('tenant_id, design_variant, brand_name')
    .eq('theme', theme)

  if (error && isMissingDesignVariantColumn(error)) {
    // Back-compat for environments where the new column migration hasn't been
    // applied or schema cache has not reloaded yet.
    return base
  }

  if (!error && Array.isArray(data)) {
    for (const row of data as ConfigRow[]) {
      if (excludeTenantId && row.tenant_id === excludeTenantId) continue
      const forced = isForcedPreset(row.design_variant)
      const seed = siteSeed({
        // A forced preset renders a fixed named style, not a composed seed, so
        // don't treat its id as a composition seed here.
        designVariant: forced ? null : row.design_variant,
        // widget_id === tenant id by data-model invariant.
        widgetId: row.tenant_id,
        brandName: row.brand_name,
      })
      if (forced || !seed) continue
      used.add(designFingerprint(theme, seed))
    }
  }

  for (let n = 0; n < MAX_PROBES; n++) {
    const candidate = n === 0 ? base : `${base}#${n + 1}`
    if (!used.has(designFingerprint(theme, candidate))) return candidate
  }

  // Theme's fingerprint space is exhausted (many thousands of sites). Fall back
  // to a seed that is at least guaranteed distinct from every other site.
  return `${base}#${norm(fallbackId)}`
}
