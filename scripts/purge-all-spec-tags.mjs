import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function purgeAllSpecTags() {
  console.log('Purging all spec-sheet tags and bracket pseudo-elements...')

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
  let globalCss = custom.globalCss || ''

  // 1. Purge bracket pseudo-elements and monospace spec styling from globalCss
  globalCss = globalCss
    .replace(/\.dossier-meta span::before\s*\{[^}]*\}/gi, '')
    .replace(/\.dossier-meta span::after\s*\{[^}]*\}/gi, '')
    .replace(
      /\.dossier-meta\s*\{[^}]*\}/gi,
      `.dossier-meta {
  font-family: var(--font-body);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--acc);
  display: flex;
  gap: 1.5rem;
}`
    )

  // 2. Clean spec tags from HTML pages
  const cleanPages = {}

  Object.keys(pages).forEach((slug) => {
    let html = pages[slug]?.html || ''

    // Remove spec prefixes: REF:, LOC:, DEPT:, DOC:, REV:, FILE:, VISIT:, TENURE:, FIG
    html = html
      .replace(/<span>Ref:\s*([^<]+)<\/span>/gi, '<span>$1</span>')
      .replace(/<span>Loc:\s*([^<]+)<\/span>/gi, '<span>$1</span>')
      .replace(/<span>REF:\s*([^<]+)<\/span>/gi, '<span>$1</span>')
      .replace(/<span>LOC:\s*([^<]+)<\/span>/gi, '<span>$1</span>')
      .replace(/<span>DEPT:\s*([^<]+)<\/span>/gi, '<span>$1</span>')
      .replace(/<span>DOC\.?\s*[^<]*<\/span>/gi, '')
      .replace(/<span>REV:\s*[^<]*<\/span>/gi, '')
      .replace(/<span>Rev\.\s*[^<]*<\/span>/gi, '')
      .replace(/<span>FILE:\s*[^<]*<\/span>/gi, '')
      .replace(/<span>VISIT:\s*([^<]+)<\/span>/gi, '<span>$1</span>')
      .replace(/<span>TENURE:\s*([^<]+)<\/span>/gi, '<span>$1</span>')
      .replace(/<span>PATIENT:\s*([^<]+)<\/span>/gi, '<span>$1</span>')
      .replace(/<span>ACTION:\s*([^<]+)<\/span>/gi, '<span>$1</span>')
      .replace(/<span>Intake<\/span>/gi, '')
      .replace(/<span>Action Required<\/span>/gi, '')
      .replace(/<span>PATIENT FEEDBACK LOG<\/span>/gi, '<span>Patient Reviews</span>')
      .replace(/<span>FACILITY INFO<\/span>/gi, '<span>Clarksville Clinic</span>')

    cleanPages[slug] = {
      ...pages[slug],
      html,
    }
  })

  // Update custom_config & custom_config_draft
  const updatedCustomConfig = {
    ...custom,
    globalCss,
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
    console.log('Successfully purged all spec-sheet tags and bracket pseudo-elements!')
  }
}

purgeAllSpecTags().catch(console.error)
