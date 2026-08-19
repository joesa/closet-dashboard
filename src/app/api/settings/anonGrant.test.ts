import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * /api/settings runs as `anon`, and anon's grant on contractor_settings is
 * column-scoped (supabase/migrations/20260601150000). PostgREST fails the WHOLE
 * query with 42501 when any selected column falls outside that grant — so one
 * extra column in this select does not degrade the response, it returns a 500
 * to every embedded widget on every customer site, which then falls back to
 * stock closet pricing. That is exactly what shipped when the install-signal
 * columns were added here.
 *
 * This asserts the select stays inside the grant. Add a column to the grant in
 * a migration first, then here.
 */
const GRANTED_TO_ANON = new Set([
  'id',
  'company_name',
  'primary_color_hex',
  'price_per_ft_basic',
  'price_per_ft_standard',
  'price_per_ft_premium',
  'price_drawer',
  'price_shoe_rack',
  'room_pricing',
  'disabled_default_rooms',
  'disabled_default_finishes',
  // added by later migrations, verified readable by anon in production
  'domain_config',
  'tier_names',
  'tier_colors',
  'widget_theme_id',
])

const SOURCE = readFileSync(join(__dirname, 'route.ts'), 'utf8')

describe('/api/settings stays inside the anon column grant', () => {
  it('selects only columns anon is granted', () => {
    const match = SOURCE.match(/\.from\('contractor_settings'\)[\s\S]{0,400}?\.select\('([^']+)'\)/)
    expect(match, 'contractor_settings select not found — did it move?').toBeTruthy()
    const selected = match![1]
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)
    const ungranted = selected.filter((c) => !GRANTED_TO_ANON.has(c))
    expect(
      ungranted,
      'these columns are not granted to anon; selecting them 500s the widget'
    ).toEqual([])
  })
})
