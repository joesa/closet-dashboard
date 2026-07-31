import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function cleanSecondaryPages() {
  console.log('Cleaning Wikidos Pediatrics secondary pages...')

  const tenantId = 'c223e0dd-fb4e-48a4-ab22-ad58a02b2aab'

  const { data: configs, error: fetchErr } = await supabase
    .from('site_configs')
    .select('*')
    .eq('tenant_id', tenantId)

  if (fetchErr || !configs || configs.length === 0) {
    console.error('Failed to fetch site_config:', fetchErr)
    process.exit(1)
  }

  const config = configs[0]

  // 1. Remove /portfolio from pages_config & nav_links (medical clinics don't have portfolios)
  const cleanNavLinks = Array.isArray(config.nav_links)
    ? config.nav_links.filter((link) => link.slug !== '/portfolio')
    : []

  const areaTitles = [
    'Clarksville & Montgomery County',
    'Fort Campbell & Military Families',
    'Adams, Cunningham & Surrounding Towns',
    'Welcoming New Pediatric Patients',
  ]

  const cleanPages = Array.isArray(config.pages_config)
    ? config.pages_config
        .filter((page) => page.slug !== '/portfolio')
        .map((page) => {
          let blocks = page.content_blocks || []

          // Fix /service-areas item titles & clean apdtax.com email
          if (page.slug === '/service-areas') {
            blocks = blocks.map((block) => {
              if (Array.isArray(block.items)) {
                block.items = block.items.map((item, idx) => ({
                  ...item,
                  title: areaTitles[idx] || item.title,
                  description: (item.description || '').replace(
                    /wikidos306@apdtax\.com/gi,
                    'care@wikidospediatrics.com'
                  ),
                }))
              }
              return block
            })
          }

          // Fix /faq text blocks: format into clean Q&A pairs & clean apdtax.com email
          if (page.slug === '/faq') {
            const rawFaqItems = [
              {
                q: 'Are you currently accepting new patients in the Clarksville area?',
                a: 'Yes, Wikidos Pediatrics is proudly welcoming new families from Clarksville, Tennessee, and surrounding Montgomery County communities. Whether you are expecting your first baby, recently moved to the area, or looking for a personalized pediatric experience, our doors at 2868 Summer Lawn Drive are open.',
              },
              {
                q: 'Do you offer same-day appointments for sick children?',
                a: 'We understand that childhood illnesses do not follow a schedule. We reserve specific time slots every day exclusively for sick visits. If your child wakes up with a fever or sudden symptoms, call us early at 931-551-1032 for a same-day appointment.',
              },
              {
                q: 'What insurance plans do you accept, and what are the expected costs?',
                a: 'We partner with most major health insurance networks. Contact our billing team at care@wikidospediatrics.com prior to your visit to verify benefits. For families paying out-of-pocket, we offer straightforward, transparent pricing with zero hidden fees.',
              },
              {
                q: 'What should we expect during our first wellness visit?',
                a: 'Your child’s first wellness exam is about building trust. Our pediatricians review complete medical history, measure growth and development milestones, conduct a thorough physical examination, and answer all parent questions without rushing.',
              },
              {
                q: 'How do you handle care for chronic conditions?',
                a: 'If your child manages a condition like asthma, allergies, ADHD, or eczema, we create a highly tailored care plan. We collaborate closely with parents and coordinate with pediatric specialists whenever needed.',
              },
              {
                q: 'How do we reach a doctor after hours?',
                a: 'We provide 24/7 after-hours triage nurse access. Calling our main clinic line connects you to a trained pediatric nurse who can assess symptoms and advise if immediate care is required.',
              },
            ]

            blocks = rawFaqItems.map((item, idx) => ({
              type: idx % 2 === 0 ? 'text' : 'image_left',
              heading: item.q,
              body: item.a,
              image:
                idx % 2 === 0
                  ? undefined
                  : 'https://vtlvqatzsolycqzeknru.supabase.co/storage/v1/object/public/site-assets/intakes/cf7e7bcd752b4e9e9d858ccce0511655/product-1-a1-1.jpg',
            }))
          }

          return {
            ...page,
            content_blocks: blocks,
          }
        })
    : []

  const { error: updateErr } = await supabase
    .from('site_configs')
    .update({
      nav_links: cleanNavLinks,
      pages_config: cleanPages,
    })
    .eq('id', config.id)

  if (updateErr) {
    console.error('Failed to update secondary pages:', updateErr)
  } else {
    console.log('Successfully cleaned secondary pages, removed /portfolio, and fixed FAQ/Service Areas!')
  }
}

cleanSecondaryPages().catch(console.error)
