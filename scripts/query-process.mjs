import { createClient } from '@supabase/supabase-js';

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
    const { data: tenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    // Query site_configs table
    const { data: siteConfig } = await supabase
      .from('site_configs')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    console.log('Site Configs Table Process:', JSON.stringify(siteConfig.process_config, null, 2));

    // Also let's find the prospect_intake if any
    const { data: intake } = await supabase
      .from('prospect_intakes')
      .select('*')
      .eq('provisioned_contractor_id', tenantId)
      .maybeSingle();

    console.log('Intake AI Site Config keys:', Object.keys(intake?.ai_site_config || {}));
    if (intake?.ai_site_config) {
      console.log('Intake AI Site Config SiteConfig keys:', Object.keys(intake.ai_site_config.siteConfig || {}));
      console.log('Intake AI Site Config process:', JSON.stringify(intake.ai_site_config.process || intake.ai_site_config.siteConfig?.process || null, null, 2));
    }
  }
}

main().catch(console.error);
