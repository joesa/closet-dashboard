/**
 * One-off backfill: fix the two look-alike tree-service sites created before the
 * theme-diversity + demo-contamination fixes. Gives each a DISTINCT,
 * trade-appropriate theme and replaces the leaked garage "about" + generic
 * "Consultation/Design/Install" process with trade-neutral, per-site copy.
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const PLAN = [
  {
    hostname: 'miwovo-trees.localhost',
    theme: 'rustic-pantry', // editorial / natural
    layout_style: 'storyteller',
    about:
      'Miwovo Trees delivers dependable, professional tree care for homeowners and businesses across Clarksville. Our experienced crew handles every removal, trim, and clearing with precision and genuine respect for your property. We stand behind our work and leave your landscape cleaner than we found it.',
    process: {
      title: 'Our Process',
      subtitle: 'How we work',
      steps: [
        { number: '01', title: 'Consult', description: 'Tell us about your trees and what you need done.' },
        { number: '02', title: 'Plan', description: 'We provide a clear, upfront quote and a safe plan of action.' },
        { number: '03', title: 'Deliver', description: 'Our crew completes the job and cleans the site thoroughly.' },
      ],
    },
  },
  {
    hostname: 'lemax-tree-service.localhost',
    theme: 'modern-office', // modern / clean
    layout_style: 'conversion-focus',
    about:
      'For Nashville, Lemax Tree Service is a trusted name in tree trimming, removal, and storm cleanup. We pair skilled, safety-first crews with honest, upfront service, so you always know exactly what to expect. Quality workmanship and fast, reliable response drive everything we do.',
    process: {
      title: 'How It Works',
      subtitle: 'Straightforward from day one',
      steps: [
        { number: '01', title: 'Assess', description: 'We review your tree service needs and answer your questions.' },
        { number: '02', title: 'Estimate', description: 'You get a transparent, no-surprises estimate.' },
        { number: '03', title: 'Complete', description: 'We do the work safely and stand behind the results.' },
      ],
    },
  },
]

async function main() {
  for (const p of PLAN) {
    const { data: domains } = await supabase
      .from('domains')
      .select('tenant_id')
      .eq('hostname', p.hostname)
    if (!domains || domains.length === 0) {
      console.log(`SKIP ${p.hostname}: no domain row`)
      continue
    }
    const tenantId = domains[0].tenant_id
    const { data: sc } = await supabase
      .from('site_configs')
      .select('id, about_config, process_config')
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (!sc) {
      console.log(`SKIP ${p.hostname}: no site_config`)
      continue
    }
    const { error } = await supabase
      .from('site_configs')
      .update({
        theme: p.theme,
        layout_style: p.layout_style,
        about_config: { ...(sc.about_config || {}), description: p.about },
        process_config: p.process,
      })
      .eq('id', sc.id)
    if (error) {
      console.log(`ERROR ${p.hostname}:`, error.message)
    } else {
      console.log(`OK ${p.hostname} -> theme=${p.theme}, layout=${p.layout_style}`)
    }
  }
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
