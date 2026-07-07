import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  const { data, error } = await supabase
    .from('domains')
    .select(`
      hostname,
      tenants (
        id,
        business_name,
        site_configs (
          brand_name,
          process_config
        )
      )
    `)
    .eq('hostname', 'ceteh-barbershop.localhost')
    .single();

  if (error) {
    console.error('Error fetching:', error);
    return;
  }

  fs.writeFileSync('scripts/db-dump.json', JSON.stringify(data, null, 2));
  console.log('Saved to scripts/db-dump.json');
}

main().catch(console.error);
