import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function fixWikidosPediatrics() {
  console.log('Finding Wikidos Pediatrics tenant...')
  
  const { data: tenants, error: tenantErr } = await supabase
    .from('tenants')
    .select('id, business_name')
    .ilike('business_name', '%wikidos%')

  if (tenantErr || !tenants || tenants.length === 0) {
    console.error('Tenant not found:', tenantErr)
    process.exit(1)
  }

  const tenantId = tenants[0].id
  console.log(`Found tenant ID: ${tenantId} (${tenants[0].business_name})`)

  // 1. Update site_configs using tenant_id
  const medicalProcess = {
    title: 'The Wikidos Care Approach',
    subtitle: 'Compassionate pediatric care',
    signatureEyebrow: 'Compassionate Care',
    signatureMotif: 'dot',
    steps: [
      {
        number: '01',
        title: 'Schedule Visit',
        description: 'Choose a convenient appointment time for your child online or by phone.',
      },
      {
        number: '02',
        title: 'Pediatric Evaluation',
        description: 'Our board-certified pediatric team provides thorough, gentle care in a welcoming setting.',
      },
      {
        number: '03',
        title: 'Care Plan & Support',
        description: 'Receive personalized care instructions, prescription routing, and direct follow-up access.',
      },
    ],
  }

  const medicalAbout = {
    description:
      'At Wikidos Pediatrics, we provide compassionate, dedicated medical care for infants, children, and teens across Clarksville, TN. Our board-certified pediatricians and care team ensure every child receives personalized, gentle attention in a warm, welcoming environment.',
  }

  // Fetch current site_config by tenant_id
  const { data: configs, error: fetchConfigErr } = await supabase
    .from('site_configs')
    .select('*')
    .eq('tenant_id', tenantId)

  if (fetchConfigErr) {
    console.error('Error fetching site_configs:', fetchConfigErr)
  }

  if (configs && configs.length > 0) {
    const configId = configs[0].id
    console.log(`Updating site_config ID: ${configId}`)
    const currentProducts = Array.isArray(configs[0].products_config)
      ? configs[0].products_config.filter((p) => !/dental/i.test(p?.title || ''))
      : []

    const { error: updateErr } = await supabase
      .from('site_configs')
      .update({
        theme: 'care-comfort',
        process_config: medicalProcess,
        about_config: medicalAbout,
        products_config: currentProducts,
      })
      .eq('id', configId)

    if (updateErr) {
      console.error('Failed to update site_config:', updateErr)
    } else {
      console.log('Successfully updated site_config theme to care-comfort & medical copy!')
    }
  } else {
    console.warn('No site_config found for tenant_id:', tenantId)
  }

  // 2. Set price_cents = 0 on service_catalog for medical appointments & remove dental
  const { data: catalogItems } = await supabase
    .from('service_catalog')
    .select('*')
    .eq('contractor_id', tenantId)

  if (catalogItems && catalogItems.length > 0) {
    for (const item of catalogItems) {
      if (/dental/i.test(item.name)) {
        await supabase.from('service_catalog').delete().eq('id', item.id)
        console.log(`Deleted non-pediatric item: ${item.name}`)
      } else {
        await supabase
          .from('service_catalog')
          .update({ price_cents: 0 })
          .eq('id', item.id)
        console.log(`Updated price_cents to 0 for: ${item.name}`)
      }
    }
  }

  console.log('Done fixing Wikidos Pediatrics!')
}

fixWikidosPediatrics().catch(console.error)
