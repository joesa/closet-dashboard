import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'

const TENANT = process.argv[2]
const BACKUP = process.argv[3]

async function main() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data, error } = await db
    .from('site_configs')
    .select('id, tenant_id, custom_config_draft')
    .eq('tenant_id', TENANT)
    .single()
  if (error) throw error

  writeFileSync(BACKUP, JSON.stringify(data.custom_config_draft ?? null, null, 2))
  const pages = Object.keys(data.custom_config_draft?.pages ?? {})
  console.log(`backed up draft for site_config ${data.id}: ${pages.length} pages -> ${BACKUP}`)

  const { error: upErr } = await db
    .from('site_configs')
    .update({ custom_config_draft: null })
    .eq('tenant_id', TENANT)
  if (upErr) throw upErr
  console.log('custom_config_draft cleared — next run rebuilds foundation + every page')
}
main().catch((e) => { console.error(e); process.exit(1) })
