import { createClient } from '@supabase/supabase-js'

const TENANT = process.argv[2]

async function main() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data, error } = await db
    .from('full_redesign_prompts')
    .select('*')
    .eq('tenant_id', TENANT)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return console.log('no recorded prompts')

  const prompts = (data.prompts ?? []) as Array<{
    pass: string | null
    provider: string
    model: string
    systemPrompt: string | null
    userPrompt: string
    durationMs: number
  }>

  console.log(`run ${data.run_id} · ${data.brand_name} · ${prompts.length} calls\n`)

  const check = (label: string, ok: boolean, detail = '') =>
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)

  // 1. Truncation
  const dangling = prompts.filter((p) => /Your complete visual sys$/m.test(p.systemPrompt ?? ''))
  check('avoid-list closing rule not truncated', dangling.length === 0,
    dangling.length ? `${dangling.length} prompts still end mid-sentence` : '')
  const withFleet = prompts.filter((p) => (p.systemPrompt ?? '').includes('ALREADY USED ON THIS PLATFORM'))
  const fullRule = withFleet.filter((p) =>
    (p.systemPrompt ?? '').includes('Recoloring or reordering the same template is not sufficient.'))
  check('closing rule present wherever the fleet block is',
    withFleet.length > 0 && fullRule.length === withFleet.length,
    `${fullRule.length}/${withFleet.length} fleet blocks complete`)

  // 2. Duplicate ban lists
  const dupes = prompts.filter((p) => ((p.systemPrompt ?? '').match(/Banned defaults/g) ?? []).length > 1)
  check('banned-defaults list appears once per prompt', dupes.length === 0,
    dupes.length ? `${dupes.length} prompts carry it twice` : '')

  // 3. Foreign client data
  const wrapping = prompts.filter((p) => /Vehicle Wrapping/i.test(p.systemPrompt ?? ''))
  check('no other client\'s services in the prompt', wrapping.length === 0)

  // 4. Palette contradiction
  const contradiction = prompts.filter((p) =>
    /Prefer light\/mid surfaces/.test(p.userPrompt) && /bg #[0-2][0-9a-f]{5}/i.test(p.userPrompt))
  check('no light-surface instruction beside a dark bg', contradiction.length === 0)

  // 5. Layering — system prompt should be byte-identical across the build calls
  const build = prompts.filter((p) => p.pass === 'foundation' || p.pass?.startsWith('page:'))
  const prefixes = new Set(build.map((p) => (p.systemPrompt ?? '').slice(0, 14_000)))
  check('build calls share one cached prefix', prefixes.size === 1,
    `${prefixes.size} distinct 14k prefixes across ${build.length} build calls`)

  // 6. Direction survived to the build
  const foundation = prompts.find((p) => p.pass === 'foundation')
  const lock = foundation?.userPrompt.match(/- Signature: (.*)/)?.[1] ?? '(none)'
  const templated = /A compact utility composition with dense labels|compact service index|full-width color-field/.test(lock)
  check('locked direction is not the deterministic template', !templated)
  console.log(`\n   signature: ${lock.slice(0, 150)}`)
  const palette = foundation?.userPrompt.match(/- Palette: (.*)/)?.[1] ?? '(none)'
  const type = foundation?.userPrompt.match(/- Type: (.*)/)?.[1] ?? '(none)'
  console.log(`   palette:   ${palette}`)
  console.log(`   type:      ${type}`)

  console.log('\ncalls:')
  for (const p of prompts) {
    console.log(`  ${(p.pass ?? '?').padEnd(18)} ${p.provider}/${p.model} sys=${(p.systemPrompt ?? '').length} usr=${p.userPrompt.length} ${(p.durationMs / 1000).toFixed(1)}s`)
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
