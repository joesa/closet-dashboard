import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const tenantId = '8c8b432a-5d7c-409b-9301-96baf024cee6'

const mergedCustomRooms = [
  { name: 'Test Room Basic', basic: 100, standard: 200, premium: 300 }
];

const { data, error } = await supabase.from('contractor_rooms').insert(
  mergedCustomRooms.map((r) => ({
    contractor_id: tenantId,
    name: r.name,
    price_basic: r.basic || 0,
    price_standard: r.standard || 0,
    price_premium: r.premium || 0,
  }))
).select()
console.log(data, error)
