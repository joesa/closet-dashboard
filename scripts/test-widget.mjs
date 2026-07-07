import { createClient } from '@supabase/supabase-js'
const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data, error } = await supa.from('contractor_settings').select('id, company_name, created_at, price_per_ft_basic').eq('company_name', 'cihobi6601 Roofing')
console.log(data)
