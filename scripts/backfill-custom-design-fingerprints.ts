import { isCustomSiteConfig, sanitizeCustomConfig } from '../src/lib/customSite'
import { recordCustomDesignFingerprint } from '../src/lib/design/designAvoidList'
import { getSupabaseAdmin } from '../src/lib/supabase-admin'

async function main() {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('site_configs')
    .select('tenant_id, custom_config, custom_config_draft')

  if (error) throw new Error(`Could not load custom site configs: ${error.message}`)

  let published = 0
  let drafts = 0
  for (const row of data || []) {
    if (isCustomSiteConfig(row.custom_config)) {
      await recordCustomDesignFingerprint({
        supabase,
        tenantId: row.tenant_id,
        status: 'published',
        config: sanitizeCustomConfig(row.custom_config),
      })
      published += 1
    }
    if (isCustomSiteConfig(row.custom_config_draft)) {
      await recordCustomDesignFingerprint({
        supabase,
        tenantId: row.tenant_id,
        status: 'draft',
        config: sanitizeCustomConfig(row.custom_config_draft),
      })
      drafts += 1
    }
  }

  console.info(`Backfilled ${published} published designs and ${drafts} drafts.`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
