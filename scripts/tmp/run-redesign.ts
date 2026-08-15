import { config } from 'dotenv'
config({ path: '.env.local' })

const TENANT = '559a0391-fa5a-40c5-ac8d-64531d9cdc46'

async function main() {
  const { getSupabaseAdmin } = await import('@/lib/supabase-admin')
  const { setCustomBuildJob } = await import('@/lib/ai/customBuildJob')
  const { enqueueFullRedesign } = await import('@/lib/jobs/enqueueFullRedesign')

  const startedAt = new Date().toISOString()
  const admin = getSupabaseAdmin()

  // Same sequence as autoLaunch / the admin "Full redesign" button.
  await admin
    .from('site_configs')
    .update({ custom_config_draft: null, custom_updated_at: startedAt })
    .eq('tenant_id', TENANT)

  await setCustomBuildJob(TENANT, {
    status: 'queued',
    intent: 'full',
    prompt: '',
    error: null,
    reply: null,
    started_at: startedAt,
    finished_at: null,
    ever_full: true,
    pass: 'queued',
    passes_done: [],
    dead_lettered: false,
  } as never)

  await enqueueFullRedesign(TENANT, startedAt)
  console.log('enqueued full redesign; started_at =', startedAt)
}
main().catch((e) => { console.error('FAILED:', e.message); process.exitCode = 1 })
