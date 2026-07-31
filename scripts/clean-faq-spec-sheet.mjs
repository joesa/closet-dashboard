import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function cleanFaqSpecSheet() {
  console.log('Cleaning spec sheet numbering & REF tags from FAQ page...')

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
  const custom = config.custom_config || {}
  const pages = custom.pages || {}

  const cleanPages = {}

  Object.keys(pages).forEach((slug) => {
    let html = pages[slug]?.html || ''

    // Strip DOC:, REV:, REF: 0x spec tags completely
    html = html
      .replace(/<div class="dossier-meta">\s*<span>DOC:[\s\S]*?<\/div>/gi, '')
      .replace(/<div class="dossier-meta">\s*<span>REF: \d+<\/span>\s*<\/div>/gi, '')
      .replace(/<span>DOC:[\s\S]*?<\/span>/gi, '')
      .replace(/<span>REV: \d+<\/span>/gi, '')
      .replace(/<span>REF: \d+<\/span>/gi, '')

    cleanPages[slug] = {
      ...pages[slug],
      html,
    }
  })

  // Update custom_config & custom_config_draft
  const updatedCustomConfig = {
    ...custom,
    pages: cleanPages,
  }

  const { error: updateErr } = await supabase
    .from('site_configs')
    .update({
      custom_config: updatedCustomConfig,
      custom_config_draft: updatedCustomConfig,
    })
    .eq('id', config.id)

  if (updateErr) {
    console.error('Failed to update custom_config:', updateErr)
  } else {
    console.log('Successfully removed all DOC:, REV:, and REF: spec sheet tags from FAQ & all pages!')
  }
}

cleanFaqSpecSheet().catch(console.error)
