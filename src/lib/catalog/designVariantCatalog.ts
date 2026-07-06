/**
 * Design-variant presets — admin override catalog.
 *
 * MUST stay in sync with the canonical source of truth in
 * custom-closets-websites/src/lib/designVariants.ts (the `STUDIO_NAMES` list).
 * The renderer validates/uses these ids; this file only powers the admin
 * dropdown and server-side validation in closet-dashboard.
 *
 * An empty id ('') means "Auto" — the renderer composes a unique structural
 * variant procedurally from the site seed (widget id / brand name).
 */

export const DESIGN_VARIANT_PRESET_IDS = [
  'atelier', 'broadsheet', 'pavilion', 'salon', 'manifesto', 'reverie',
  'beacon', 'monolith', 'lumen', 'vellum', 'cascade', 'harbor',
  'meridian', 'aria', 'foundry', 'lattice', 'marble', 'ember',
  'copper', 'slate', 'ivory', 'cobalt', 'verdant', 'dune',
  'cirrus', 'tundra', 'quarry', 'basalt', 'zephyr', 'halcyon',
  'obsidian', 'porcelain', 'atrium', 'loft', 'terrace', 'cornice',
  'plinth', 'frieze', 'rotunda', 'alcove', 'mantle', 'horizon',
  'vantage', 'summit', 'equinox', 'solstice', 'prism', 'facet',
  'contour', 'cadence', 'tempo', 'vector', 'helix', 'nimbus',
  'quartz', 'onyx',
] as const

export type DesignVariantPresetId = (typeof DESIGN_VARIANT_PRESET_IDS)[number]

function titleCase(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1)
}

/** Options for an admin <select>: "Auto" plus every named preset. */
export const DESIGN_VARIANT_OPTIONS: Array<{ id: string; label: string }> = [
  { id: '', label: 'Auto (seeded — unique per site)' },
  ...DESIGN_VARIANT_PRESET_IDS.map((id) => ({ id, label: titleCase(id) })),
]

const PRESET_SET = new Set<string>(DESIGN_VARIANT_PRESET_IDS)

/** True when `id` is a known preset. Empty string is treated as valid (Auto). */
export function isDesignVariantId(id?: string | null): boolean {
  if (id == null) return false
  const trimmed = id.trim()
  return trimmed === '' || PRESET_SET.has(trimmed)
}

/** True only when `id` names an actual preset (empty/Auto is NOT a preset). */
export function isForcedPreset(id?: string | null): boolean {
  const trimmed = (id ?? '').trim()
  return trimmed !== '' && PRESET_SET.has(trimmed)
}

/** Normalize admin input to a storable value: a valid preset id or null (Auto). */
export function coerceDesignVariant(id?: string | null): string | null {
  const trimmed = (id ?? '').trim()
  if (trimmed === '') return null
  return PRESET_SET.has(trimmed) ? trimmed : null
}
