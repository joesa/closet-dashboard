import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  const { data: domains, error: domainError } = await supabase
    .from('domains')
    .select('*')
    .eq('hostname', 'ceteh-barbershop.localhost');

  if (domainError) {
    console.error('Domain error:', domainError);
    return;
  }

  console.log('Domains found:', domains);

  if (domains && domains.length > 0) {
    const tenantId = domains[0].tenant_id;
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (tenantError) {
      console.error('Tenant error:', tenantError);
      return;
    }

    console.log('Tenant:', JSON.stringify({
      id: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain,
      ai_site_config: tenant.ai_site_config
    }, null, 2));

    // Also let's find the prospect_intake if any
    const { data: intake, error: intakeError } = await supabase
      .from('prospect_intakes')
      .select('*')
      .eq('provisioned_contractor_id', tenantId)
      .maybeSingle();

    if (intakeError) {
      console.error('Intake error:', intakeError);
    } else {
      console.log('Intake:', JSON.stringify({
        id: intake?.id,
        business_name: intake?.business_name,
        ai_site_config: intake?.ai_site_config
      }, null, 2));
    }
  }
}

main().catch(console.error);
