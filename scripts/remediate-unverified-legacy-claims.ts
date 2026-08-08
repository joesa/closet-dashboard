#!/usr/bin/env npx tsx
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'

loadEnvConfig(process.cwd())

const replacements = [
  {
    tenantId: 'f97a0c48-a65d-40d3-96a2-417b5a8651bb',
    column: 'custom_config',
    from: '<span class="num">No. 1</span>',
    to: '<span class="num">First</span>',
  },
  {
    tenantId: '4de55d59-8d02-4815-8143-cfa8562d5a5d',
    column: 'hero_config',
    from: 'Reliable, professional plumbing solutions delivered 24/7 for Boston homes and businesses.',
    to: 'Plumbing repairs and installations for Boston homes and businesses. Call to confirm current availability.',
  },
  {
    tenantId: 'c223e0dd-fb4e-48a4-ab22-ad58a02b2aab',
    column: 'pages_config',
    from: 'We provide 24/7 after-hours triage nurse access. Calling our main clinic line connects you to a trained pediatric nurse who can assess symptoms and advise if immediate care is required.',
    to: 'For after-hours concerns, call our main clinic line for current instructions. If your child may need immediate care, call emergency services.',
  },
  {
    tenantId: 'c223e0dd-fb4e-48a4-ab22-ad58a02b2aab',
    column: 'custom_config',
    from: 'We provide 24/7 after-hours triage nurse access. Calling our main clinic line connects you to a trained pediatric nurse who can assess symptoms and advise if immediate care is required.',
    to: 'For after-hours concerns, call our main clinic line for current instructions. If your child may need immediate care, call emergency services.',
  },
  {
    tenantId: 'd7f289ab-c7a0-4444-bead-6d10aad45898',
    column: 'pages_config',
    from: 'Using instant dispatch software and dedicated client portals, we keep you informed at every step. You will always have a 24/7 direct communication line to us.',
    to: 'We keep you informed as the work progresses. Call us directly with questions about the job.',
  },
  {
    tenantId: 'd7f289ab-c7a0-4444-bead-6d10aad45898',
    column: 'pages_config',
    from: 'We guarantee an initial response within two hours. We use instant dispatch software and 24/7 direct communication lines to handle urgent hazards quickly.',
    to: 'Call us about urgent hazards. We will confirm current response timing and next steps.',
  },
  {
    tenantId: '03b36d01-48f2-4b88-8b4e-1c882309f49b',
    column: 'custom_config',
    from: '<p>123-456-7890</p>',
    to: '',
    expectedCount: 4,
  },
  {
    tenantId: '03b36d01-48f2-4b88-8b4e-1c882309f49b',
    column: 'custom_config',
    from: '<p>MyCity, MS</p>',
    to: '',
    expectedCount: 4,
  },
] as const

function replaceDeep(value: unknown, from: string, to: string): number {
  let count = 0
  const visit = (node: unknown): unknown => {
    if (typeof node === 'string') {
      if (!node.includes(from)) return node
      count += node.split(from).length - 1
      return node.replaceAll(from, to)
    }
    if (Array.isArray(node)) return node.map(visit)
    if (node && typeof node === 'object') {
      return Object.fromEntries(Object.entries(node).map(([key, child]) => [key, visit(child)]))
    }
    return node
  }
  const updated = visit(value)
  if (value && typeof value === 'object' && updated && typeof updated === 'object') {
    Object.assign(value, updated)
  }
  return count
}

async function main() {
  const apply = process.argv.includes('--apply')
  const tenantArg = process.argv.indexOf('--tenant')
  const onlyTenant = tenantArg >= 0 ? process.argv[tenantArg + 1] : null
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing database credentials')
  const supabase = createClient(url, key)

  for (const replacement of replacements) {
    if (onlyTenant && replacement.tenantId !== onlyTenant) continue
    const { data, error } = await supabase
      .from('site_configs')
      .select(`id, ${replacement.column}`)
      .eq('tenant_id', replacement.tenantId)
      .single()
    if (error) throw error
    const row = data as Record<string, unknown>
    const value = structuredClone(row[replacement.column])
    const count = replaceDeep(value, replacement.from, replacement.to)
    const expectedCount = 'expectedCount' in replacement ? replacement.expectedCount : 1
    if (count === 0 && JSON.stringify(value).includes(replacement.to)) {
      console.log(`done ${replacement.tenantId}/${replacement.column}`)
      continue
    }
    if (count !== expectedCount) {
      throw new Error(`${replacement.tenantId}/${replacement.column}: expected ${expectedCount} match(es), found ${count}`)
    }
    console.log(`${apply ? 'apply' : 'dry'} ${replacement.tenantId}/${replacement.column}`)
    if (apply) {
      const { error: updateError } = await supabase
        .from('site_configs')
        .update({ [replacement.column]: value })
        .eq('id', row.id)
      if (updateError) throw updateError
    }
  }
  if (!apply) console.log('No writes made. Re-run with --apply after review.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})