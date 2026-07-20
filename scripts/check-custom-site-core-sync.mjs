/**
 * Fail if shared libs drift between dashboard and websites:
 *   - src/lib/customSite.ts (widget mount / sanitize core)
 *   - src/lib/widgetCdn.ts (CDN URL + cache-bust version)
 *
 * Usage (from closet-dashboard):
 *   node scripts/check-custom-site-core-sync.mjs
 *   node scripts/check-custom-site-core-sync.mjs --websites-root ../custom-closets-websites
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dashboardRoot = resolve(__dirname, '..')

function argValue(flag) {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : null
}

const websitesRoot = resolve(
  dashboardRoot,
  argValue('--websites-root') || '../custom-closets-websites'
)

const CHECKS = [
  {
    label: 'customSite',
    relativePath: 'src/lib/customSite.ts',
    consts: [
      'WIDGET_PLACEHOLDER',
      'WIDGET_PLACEHOLDER_ALT',
      'WIDGET_MOUNT_RESET_CSS',
    ],
    functions: [
      'normalizeWidgetPlaceholders',
      'htmlHasInjectableWidget',
      'findEmptyWidgetShells',
      'findUnmountedWidgetShells',
      'sanitizeCustomHtml',
      'sanitizeCustomCss',
      'validateCustomConfig',
    ],
  },
  {
    label: 'widgetCdn',
    relativePath: 'src/lib/widgetCdn.ts',
    consts: ['DEFAULT_WIDGET_CDN_BASE', 'DEFAULT_WIDGET_VERSION'],
    functions: ['withWidgetCacheBust'],
  },
]

function normalize(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function hash(s) {
  return createHash('sha256').update(s).digest('hex').slice(0, 16)
}

function extractConst(source, name) {
  const re = new RegExp(
    `export\\s+const\\s+${name}\\s*=\\s*(\`[\\s\\S]*?\`(?:\\.trim\\(\\))?|'[^']*'|"[^"]*")`
  )
  const m = source.match(re)
  return m ? normalize(m[1]) : null
}

function extractFunction(source, name) {
  const start = source.search(new RegExp(`export\\s+function\\s+${name}\\s*\\(`))
  if (start < 0) return null
  let i = source.indexOf('{', start)
  if (i < 0) return null
  let depth = 0
  for (; i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}') {
      depth--
      if (depth === 0) {
        return normalize(source.slice(start, i + 1))
      }
    }
  }
  return null
}

const inCi = Boolean(process.env.CI || process.env.GITHUB_ACTIONS)
let failed = 0

for (const check of CHECKS) {
  const dashPath = resolve(dashboardRoot, check.relativePath)
  const webPath = resolve(websitesRoot, check.relativePath)

  if (!existsSync(dashPath) || !existsSync(webPath)) {
    console.error(`Missing ${check.label} — expected:`)
    console.error(' ', dashPath)
    console.error(' ', webPath)
    if (!inCi && process.env.CUSTOM_SITE_SYNC_SKIP === '1') {
      console.warn('CUSTOM_SITE_SYNC_SKIP=1 — exiting 0')
      process.exit(0)
    }
    process.exit(1)
  }

  const dash = readFileSync(dashPath, 'utf8')
  const web = readFileSync(webPath, 'utf8')
  console.log(`\n[${check.label}]`)

  for (const name of check.consts) {
    const a = extractConst(dash, name)
    const b = extractConst(web, name)
    if (!a || !b) {
      console.error(`✗ ${name}: missing in ${!a ? 'dashboard' : 'websites'}`)
      failed++
    } else if (a !== b) {
      console.error(`✗ ${name}: drift (dashboard=${hash(a)} websites=${hash(b)})`)
      failed++
    } else {
      console.log(`✓ ${name}`)
    }
  }
  for (const name of check.functions) {
    const a = extractFunction(dash, name)
    const b = extractFunction(web, name)
    if (!a || !b) {
      console.error(`✗ ${name}: missing in ${!a ? 'dashboard' : 'websites'}`)
      failed++
    } else if (a !== b) {
      console.error(`✗ ${name}: drift (dashboard=${hash(a)} websites=${hash(b)})`)
      failed++
    } else {
      console.log(`✓ ${name}`)
    }
  }
}

if (failed) {
  console.error(
    `\n${failed} shared symbol(s) out of sync. Update both copies together.`
  )
  process.exit(1)
}
console.log('\nShared libs (customSite + widgetCdn) in sync.')
