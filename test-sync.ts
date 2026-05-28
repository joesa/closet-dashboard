import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(url, key)

async function testSync() {
  const { data: leads } = await supabase.from('leads').select('*').eq('phone', '+19999999999')
  console.log('Leads found:', leads)
}

testSync()
