import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(url, key)

async function check() {
  const { data, error } = await supabase.from('global_suppressions').select('*')
  console.log('Suppressions:', JSON.stringify(data, null, 2))
  if (error) console.error('Error:', error)
}
check()
