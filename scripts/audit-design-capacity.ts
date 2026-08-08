#!/usr/bin/env npx tsx
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { analyzeDesignCapacity } from '../src/lib/design/designCapacity'

loadEnvConfig(process.cwd())

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing database credentials')
  const supabase = createClient(url, key)
  const [fingerprintsResult, reservationsResult] = await Promise.all([
    supabase
      .from('custom_design_fingerprints')
      .select('font_key, updated_at')
      .order('updated_at', { ascending: false }),
    supabase
      .from('custom_design_direction_reservations')
      .select('status, expires_at'),
  ])
  if (fingerprintsResult.error) throw fingerprintsResult.error
  if (reservationsResult.error) throw reservationsResult.error
  const report = analyzeDesignCapacity(
    fingerprintsResult.data || [],
    reservationsResult.data || []
  )
  console.log(JSON.stringify(report, null, 2))
  for (const warning of report.warnings) console.warn(`WARNING: ${warning}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})