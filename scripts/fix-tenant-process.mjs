import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  const tenantId = '1eb56b33-0d69-42fa-a87d-ca7ca291a9c6';

  // 1. Fetch current site_config
  const { data: siteConfig, error: fetchErr } = await supabase
    .from('site_configs')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  if (fetchErr) {
    console.error('Error fetching site_config:', fetchErr);
    return;
  }

  const currentProcess = siteConfig.process_config || {};
  const currentSteps = currentProcess.steps || [];

  const updatedSteps = [
    {
      title: 'Consult',
      number: '01',
      description: 'We begin with a personalized consultation to understand your style preferences, hair type, and grooming goals.'
    },
    ...currentSteps
  ];

  const updatedProcess = {
    ...currentProcess,
    steps: updatedSteps
  };

  // 2. Update site_configs table
  const { error: updateErr } = await supabase
    .from('site_configs')
    .update({ process_config: updatedProcess })
    .eq('tenant_id', tenantId);

  if (updateErr) {
    console.error('Error updating site_configs table:', updateErr);
    return;
  }

  console.log('Successfully updated site_configs table!');

  // 3. Fetch prospect_intake
  const { data: intake, error: intakeFetchErr } = await supabase
    .from('prospect_intakes')
    .select('*')
    .eq('provisioned_contractor_id', tenantId)
    .maybeSingle();

  if (intakeFetchErr) {
    console.error('Error fetching prospect_intake:', intakeFetchErr);
    return;
  }

  if (intake) {
    const currentIntakeConfig = intake.ai_site_config || {};
    const currentIntakeSiteConfig = currentIntakeConfig.siteConfig || {};
    const currentIntakeProcess = currentIntakeSiteConfig.process || {};

    const updatedIntakeProcess = {
      ...currentIntakeProcess,
      steps: [
        {
          title: 'Consult',
          number: '01',
          description: 'We begin with a personalized consultation to understand your style preferences, hair type, and grooming goals.'
        },
        ...(currentIntakeProcess.steps || [])
      ]
    };

    const updatedIntakeConfig = {
      ...currentIntakeConfig,
      siteConfig: {
        ...currentIntakeSiteConfig,
        process: updatedIntakeProcess
      }
    };

    const { error: intakeUpdateErr } = await supabase
      .from('prospect_intakes')
      .update({ ai_site_config: updatedIntakeConfig })
      .eq('id', intake.id);

    if (intakeUpdateErr) {
      console.error('Error updating prospect_intakes table:', intakeUpdateErr);
      return;
    }

    console.log('Successfully updated prospect_intakes table!');
  }
}

main().catch(console.error);
