/**
 * Strip decorative outer-card CSS on widget mount shells in custom_config.
 * Usage: node scripts/strip-widget-mount-chrome.mjs <tenantId>
 *        node scripts/strip-widget-mount-chrome.mjs --all-custom
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

const MOUNT_CLASS =
  /\.(?:widget-container|closet-widget-slot|quote-embed|quote-slot|widget-wrap|quote-box|calculator-wrap)\b/i

function matchBrace(s, openIdx) {
  let depth = 0
  for (let i = openIdx; i < s.length; i++) {
    if (s[i] === '{') depth++
    else if (s[i] === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return s.length - 1
}

/** Neutralize card chrome in rules that target widget mount shells. */
function stripMountChromeCss(css) {
  if (!css) return css
  let out = ''
  let i = 0
  while (i < css.length) {
    while (i < css.length && /\s/.test(css[i])) {
      out += css[i]
      i++
    }
    if (i >= css.length) break

    if (css[i] === '@') {
      let headerEnd = i
      while (headerEnd < css.length && css[headerEnd] !== '{' && css[headerEnd] !== ';') {
        headerEnd++
      }
      const header = css.slice(i, headerEnd)
      out += header
      i = headerEnd
      if (css[i] === '{') {
        const bodyEnd = matchBrace(css, i)
        const body = css.slice(i + 1, bodyEnd)
        out += '{'
        if (/@(?:-?\w+-)?keyframes/i.test(header) || /@font-face/i.test(header)) {
          out += body
        } else {
          out += stripMountChromeCss(body)
        }
        out += '}'
        i = bodyEnd + 1
      }
      continue
    }

    const brace = css.indexOf('{', i)
    if (brace < 0) {
      out += css.slice(i)
      break
    }
    const selectors = css.slice(i, brace)
    const bodyEnd = matchBrace(css, brace)
    let body = css.slice(brace + 1, bodyEnd)
    if (MOUNT_CLASS.test(selectors)) {
      body = body
        .replace(
          /(?:^|;)\s*(?:background(?:-color|-image)?|border(?:-[a-z]+)?|box-shadow|outline(?:-[a-z]+)?)\s*:[^;]*/gi,
          ';'
        )
        .replace(/(?:^|;)\s*padding\s*:[^;]*/gi, ';padding:1.5rem 1rem 2.5rem')
        .replace(/;;+/g, ';')
        .replace(/^\s*;\s*/, '')
        .trim()
      if (body && !body.endsWith(';')) body += ';'
      // Ensure transparent shell even if rule only had padding before.
      if (!/background\s*:/i.test(body)) {
        body +=
          'background:transparent;border:none;box-shadow:none;padding:1.5rem 1rem 2.5rem;'
      }
    }
    out += `${selectors}{${body}}`
    i = bodyEnd + 1
  }
  return out
}

function neutralizeConfig(config) {
  if (!config || typeof config !== 'object') return config
  const pages = {}
  for (const [path, page] of Object.entries(config.pages || {})) {
    pages[path] = {
      ...page,
      css: page?.css ? stripMountChromeCss(page.css) : page?.css,
    }
  }
  return {
    ...config,
    globalCss: config.globalCss ? stripMountChromeCss(config.globalCss) : config.globalCss,
    pages,
  }
}

const arg = process.argv[2]
if (!arg) {
  console.error(
    'Usage: node scripts/strip-widget-mount-chrome.mjs <tenantId>|--all-custom'
  )
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

async function patchRow(row) {
  const beforeG = row.custom_config?.globalCss || ''
  const patch = {
    custom_config: row.custom_config
      ? neutralizeConfig(row.custom_config)
      : row.custom_config,
    custom_config_draft: row.custom_config_draft
      ? neutralizeConfig(row.custom_config_draft)
      : row.custom_config_draft,
  }
  const afterG = patch.custom_config?.globalCss || ''
  if (beforeG === afterG && JSON.stringify(row.custom_config_draft) === JSON.stringify(patch.custom_config_draft)) {
    console.log(row.tenant_id, 'unchanged')
    return false
  }
  const { error } = await sb.from('site_configs').update(patch).eq('tenant_id', row.tenant_id)
  if (error) {
    console.error(row.tenant_id, 'update failed', error.message)
    return false
  }
  const sample = (afterG.match(/\.widget-container\{[^}]*\}/) || ['(no widget-container rule)'])[0]
  console.log(row.tenant_id, 'OK →', sample.slice(0, 160))
  return true
}

if (arg === '--all-custom') {
  const { data, error } = await sb
    .from('site_configs')
    .select('tenant_id, custom_config, custom_config_draft, render_mode')
    .eq('render_mode', 'custom')
  if (error) {
    console.error(error.message)
    process.exit(1)
  }
  let n = 0
  for (const row of data || []) {
    if (await patchRow(row)) n++
  }
  console.log(`Updated ${n}/${(data || []).length} custom sites`)
} else {
  const { data, error } = await sb
    .from('site_configs')
    .select('tenant_id, custom_config, custom_config_draft, render_mode')
    .eq('tenant_id', arg)
    .maybeSingle()
  if (error || !data) {
    console.error(error?.message || 'not found')
    process.exit(1)
  }
  await patchRow(data)
}
