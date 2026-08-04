#!/usr/bin/env node
/**
 * Print every process.env key reachable from the worker entrypoint.
 *
 * Walks the import graph from worker/src/index.ts rather than grepping a list
 * of directories. That distinction is not academic: TENANT_BASE_DOMAIN and
 * ADMIN_BYPASS_SECRET were both missed by directory greps because the files
 * that read them (src/lib/provision/resolveSubdomain.ts, src/lib/urls.ts,
 * src/lib/admin-preview.ts) are reached transitively, and both failures showed
 * up only as broken behaviour on a live host — a tenant provisioned onto
 * `localhost`, and an auto-launch that dead-lettered on `fetch failed`.
 *
 * Follows `@/*` (-> src/*) and relative specifiers; ignores bare package
 * imports. Type-only imports are followed too, which can over-report slightly —
 * a false positive here costs a documented env var, a false negative costs a
 * production incident.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ENTRY = path.join(root, 'worker/src/index.ts')
const EXTS = ['.ts', '.tsx', '.js', '.mjs']

function resolveSpecifier(spec, fromFile) {
  let base
  if (spec.startsWith('@/')) base = path.join(root, 'src', spec.slice(2))
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec)
  else return null // bare package import

  for (const ext of ['', ...EXTS]) {
    const p = base + ext
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p
  }
  for (const ext of EXTS) {
    const p = path.join(base, 'index' + ext)
    if (fs.existsSync(p)) return p
  }
  return null
}

const seen = new Set()
const envKeys = new Map() // key -> Set of files that read it

function walk(file) {
  if (seen.has(file)) return
  seen.add(file)
  const text = fs.readFileSync(file, 'utf8')

  for (const m of text.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
    const rel = path.relative(root, file)
    if (!envKeys.has(m[1])) envKeys.set(m[1], new Set())
    envKeys.get(m[1]).add(rel)
  }

  // static imports/exports, plus dynamic import() — the sharp path is reached
  // through `await import('@/lib/images/optimizeUpload')`, so missing these
  // would reintroduce exactly the blind spot this script exists to close.
  const specs = [
    ...text.matchAll(/(?:from|import)\s*['"]([^'"]+)['"]/g),
    ...text.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g),
  ].map((m) => m[1])

  for (const spec of specs) {
    const resolved = resolveSpecifier(spec, file)
    if (resolved && !resolved.includes('node_modules')) walk(resolved)
  }
}

if (!fs.existsSync(ENTRY)) {
  console.error(`entrypoint not found: ${ENTRY}`)
  process.exit(1)
}
walk(ENTRY)

const verbose = process.argv.includes('--verbose')
for (const key of [...envKeys.keys()].sort()) {
  if (verbose) console.log(`${key}\t${[...envKeys.get(key)].sort().join(', ')}`)
  else console.log(key)
}
console.error(`# ${envKeys.size} env keys across ${seen.size} reachable files`)
