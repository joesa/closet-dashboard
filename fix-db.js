const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: domainData } = await supabase.from('domains').select('tenant_id').eq('hostname', 'yaweg-food-truck-service.localhost').single();
  if (domainData) {
    console.log("Found tenant ID:", domainData.tenant_id);
    const { error } = await supabase.from('site_configs').update({ engagement_model: 'order' }).eq('tenant_id', domainData.tenant_id);
    if (error) console.error("Error:", error);
    else console.log("Updated site_configs engagement_model to 'order'");
  } else {
    console.log("Domain not found!");
  }
}
run();
