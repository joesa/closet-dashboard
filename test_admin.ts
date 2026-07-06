import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: users, error } = await supabase.auth.admin.listUsers();
  if (error) console.error(error);
  
  const yawkyeinketia = users?.users.find(u => u.email === 'yawkyeinketia@hotmail.com');
  console.log('yawkyeinketia found:', !!yawkyeinketia);

  const { data: tenants } = await supabase.from('tenants').select('id, business_name, site_status').order('created_at', { ascending: false }).limit(5);
  console.log("Recent tenants:", tenants);
}
main();
