import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function cleanWikidosAiTells() {
  console.log('Fetching Wikidos Pediatrics site_config...')

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

  // 1. Clean Main Hero Headline
  const cleanHero = {
    ...config.hero_config,
    headline: 'Compassionate Pediatric Care in Clarksville',
    subheadline: 'Dedicated care for infants, children, and teens in a gentle, welcoming environment.',
  }

  // 2. Clean Products / Services Descriptions (replace contractor boilerplate)
  const cleanProducts = Array.isArray(config.products_config)
    ? config.products_config.map((p) => {
        let desc = p.description || ''
        if (/urgent care/i.test(p.title)) {
          desc = 'Same-day evaluation and gentle treatment for fever, minor injuries, and sudden childhood illness.'
        } else if (/family clinic/i.test(p.title)) {
          desc = 'Comprehensive wellness exams, growth tracking, and immunizations for infants, children, and teens.'
        } else if (/specialty/i.test(p.title)) {
          desc = 'Coordinated pediatric specialty care, chronic condition management, and specialist referrals.'
        } else if (/handled with care from first call/i.test(desc) || /completion/i.test(desc)) {
          desc = 'Attentive pediatric medical care tailored to your child’s health and development.'
        }

        return {
          ...p,
          description: desc,
          details: {
            ...(p.details || {}),
            subtitle: 'Pediatric Care',
            longDescription: desc,
          },
        }
      })
    : []

  // 3. Clean Page Subheadlines in pages_config
  const SUBHEADLINE_MAP = {
    '/about': 'Dedicated to the health, growth, and wellbeing of Clarksville families.',
    '/services': 'Comprehensive pediatric medical services tailored to every stage of childhood.',
    '/portfolio': 'A look inside our welcoming clinic and pediatric care environments.',
    '/contact': 'Reach out to our caring pediatric team — we’re here for your family.',
    '/testimonials': 'What Clarksville parents and families say about our pediatric care.',
    '/service-areas': 'Serving families across Clarksville, Oak Grove, Adams, and Montgomery County.',
    '/faq': 'Answers to common questions about pediatric visits, insurance, and after-hours care.',
  }

  const cleanPages = Array.isArray(config.pages_config)
    ? config.pages_config.map((page) => {
        const newSub = SUBHEADLINE_MAP[page.slug] || 'Dedicated pediatric care for your family.'
        const cleanPageHero = {
          ...(page.hero || {}),
          headline: page.title || 'Pediatric Care',
          subheadline: newSub,
        }

        // Also clean up any "Offering 1", "Offering 2" titles in content_blocks if present
        const cleanBlocks = Array.isArray(page.content_blocks)
          ? page.content_blocks.map((block) => {
              if (block.heading && /^offering \d+$/i.test(block.heading)) {
                block.heading = 'Our Care Commitment'
              }
              if (Array.isArray(block.items)) {
                block.items = block.items.map((item, idx) => {
                  if (item.title && /^offering \d+$/i.test(item.title)) {
                    item.title = `Pediatric Care Focus ${idx + 1}`
                  }
                  return item
                })
              }
              return block
            })
          : page.content_blocks

        return {
          ...page,
          hero: cleanPageHero,
          content_blocks: cleanBlocks,
        }
      })
    : []

  const { error: updateErr } = await supabase
    .from('site_configs')
    .update({
      hero_config: cleanHero,
      products_config: cleanProducts,
      pages_config: cleanPages,
    })
    .eq('id', config.id)

  if (updateErr) {
    console.error('Failed to update site_config:', updateErr)
  } else {
    console.log('Successfully cleaned all AI tells from Wikidos Pediatrics site_config!')
  }
}

cleanWikidosAiTells().catch(console.error)
