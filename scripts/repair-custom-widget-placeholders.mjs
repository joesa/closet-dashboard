/**
 * One-off: normalize CLOSET_WIDGET placeholders in custom_config (+ draft)
 * for a tenant so Full Redesign empty boxes get a live mount in-place.
 *
 * Usage: node scripts/repair-custom-widget-placeholders.mjs <tenantId>
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function loadEnv() {
  const raw = readFileSync(resolve(root, '.env.local'), 'utf8')
  const env = {}
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    env[m[1]] = v
  }
  return env
}

const WIDGET_PLACEHOLDER = '<!-- CLOSET_WIDGET -->'
const WIDGET_COMMENT_RE = /<!--\s*CLOSET_WIDGET\b[\s\S]*?-->/gi
const WIDGET_MUSTACHE_RE = /\{\{\s*CLOSET_WIDGET\s*\}\}/gi

function normalizeWidgetPlaceholders(html) {
  if (!html) return ''
  let out = html
  out = out.replace(WIDGET_COMMENT_RE, WIDGET_PLACEHOLDER)
  out = out.replace(WIDGET_MUSTACHE_RE, WIDGET_PLACEHOLDER)
  const first = out.indexOf(WIDGET_PLACEHOLDER)
  if (first >= 0) {
    const before = out.slice(0, first + WIDGET_PLACEHOLDER.length)
    const after = out
      .slice(first + WIDGET_PLACEHOLDER.length)
      .split(WIDGET_PLACEHOLDER)
      .join('')
    out = before + after
  }
  out = out.replace(
    /<(div|section)([^>]*\b(?:widget-container|closet-widget-slot)\b[^>]*)>\s*<\/\1>/gi,
    ''
  )
  return out
}

function normalizeConfig(config) {
  if (!config?.pages) return config
  const pages = {}
  for (const [path, page] of Object.entries(config.pages)) {
    pages[path] = {
      ...page,
      html: normalizeWidgetPlaceholders(page?.html || ''),
    }
  }
  return { ...config, pages }
}

const tenantId = process.argv[2]
if (!tenantId) {
  console.error('Usage: node scripts/repair-custom-widget-placeholders.mjs <tenantId>')
  process.exit(1)
}

const env = loadEnv()
const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const sb = createClient(url, key, { auth: { persistSession: false } })
const { data, error } = await sb
  .from('site_configs')
  .select('tenant_id, custom_config, custom_config_draft, render_mode')
  .eq('tenant_id', tenantId)
  .maybeSingle()

if (error || !data) {
  console.error('Load failed', error?.message || 'not found')
  process.exit(1)
}

const patch = {
  custom_config: data.custom_config ? normalizeConfig(data.custom_config) : data.custom_config,
  custom_config_draft: data.custom_config_draft
    ? normalizeConfig(data.custom_config_draft)
    : data.custom_config_draft,
}

const before = JSON.stringify(data.custom_config?.pages?.['/']?.html || '').slice(0, 200)
const after = JSON.stringify(patch.custom_config?.pages?.['/']?.html || '').slice(0, 200)
console.log('render_mode', data.render_mode)
console.log('before home html sample:', before)
console.log('after home html sample:', after)

const { error: upErr } = await sb
  .from('site_configs')
  .update(patch)
  .eq('tenant_id', tenantId)

if (upErr) {
  console.error('Update failed', upErr.message)
  process.exit(1)
}
console.log('OK — normalized custom_config (+ draft) for', tenantId)
