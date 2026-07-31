import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function applyAuditFixes() {
  console.log('Applying surgical audit fixes to Wikidos Pediatrics...')

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

  const standardNavHtml = `<nav class="nav-links">
      <a href="/about">About Us</a>
      <a href="/services">Services</a>
      <a href="/testimonials">Reviews</a>
      <a href="/service-areas">Service Areas</a>
      <a href="/faq">FAQ</a>
      <a href="/contact">Contact</a>
    </nav>`

  const cleanPages = {}

  Object.keys(pages).forEach((slug) => {
    let html = pages[slug]?.html || ''

    // 1. Fix Email Leak
    html = html.replace(/wikidos306@apdtax\.com/gi, 'care@wikidospediatrics.com')

    // 2. Fix Pseudo-Technical Badges & Code Comments
    html = html
      .replace(/<span>The Clinical Dossier<\/span>/gi, '<span>Pediatric Care</span>')
      .replace(/<span>Case File 2024-PED<\/span>/gi, '<span>Pediatric Practice</span>')
      .replace(/<span>DOC\. REF: ABT-01<\/span>/gi, '<span>Clarksville Practice</span>')
      .replace(/<span>LOCATION: CLARKSVILLE, TN<\/span>/gi, '<span>Clarksville, TN</span>')
      .replace(/<span>System Spec \/\/ Patient Care<\/span>/gi, '<span>Compassionate Care</span>')
      .replace(/<span>DEPT: URGENT CARE<\/span>/gi, '<span>Urgent Care</span>')
      .replace(/<span>PRIORITY: ACUTE<\/span>/gi, '<span>Same-Day Visits</span>')
      .replace(/<span>DEPT: FAMILY CLINIC<\/span>/gi, '<span>Primary Care</span>')
      .replace(/<span>PATIENT: 1-18 YEARS<\/span>/gi, '<span>Infants to Teens</span>')
      .replace(/<span>DEPT: SPECIALTY CARE<\/span>/gi, '<span>Specialty Care</span>')
      .replace(/<span>FREQ: ONGOING<\/span>/gi, '<span>Continuity of Care</span>')
      .replace(/<span>REQ: ATHLETIC CLEARANCE<\/span>/gi, '<span>School & Sports</span>')
      .replace(/<span>FIG 1\. WELLNESS EXAM<\/span>/gi, '<span>Clinical Excellence</span>')
      .replace(/<span>ACTION: SCHEDULING<\/span>/gi, '<span>Appointment Scheduler</span>')
      .replace(/<span>Intake Action Required<\/span>/gi, '<span>Schedule a Visit</span>')
      .replace(/<span>Demographics &amp; Districts<\/span>/gi, '<span>Local Communities</span>')
      .replace(/<span>Coverage Map<\/span>/gi, '<span>Service Region</span>')

    // 3. Standardize Header Navigation
    html = html.replace(/<nav class="nav-links">[\s\S]*?<\/nav>/gi, standardNavHtml)

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
    console.log('Successfully applied all audit fixes to Wikidos Pediatrics custom_config!')
  }
}

applyAuditFixes().catch(console.error)
