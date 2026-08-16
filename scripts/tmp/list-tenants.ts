import { createClient } from '@supabase/supabase-js'
async function main() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data, error } = await db
    .from('tenants')
    .select('id, business_name, updated_at')
    .order('updated_at', { ascending: false })
    .limit(15)
  if (error) throw error
  for (const t of data ?? []) console.log(t.id, '|', t.business_name, '|', t.updated_at)
}
main().catch((e) => { console.error(e); process.exit(1) })
