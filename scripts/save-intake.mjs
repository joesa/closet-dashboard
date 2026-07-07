import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  const { data: domains } = await supabase
    .from('domains')
    .select('*')
    .eq('hostname', 'ceteh-barbershop.localhost');

  if (domains && domains.length > 0) {
    const tenantId = domains[0].tenant_id;
    const { data: intake } = await supabase
      .from('prospect_intakes')
      .select('*')
      .eq('provisioned_contractor_id', tenantId)
      .maybeSingle();

    fs.writeFileSync('scripts/intake-dump.json', JSON.stringify(intake, null, 2));
    console.log('Saved to scripts/intake-dump.json');
  }
}

main().catch(console.error);
