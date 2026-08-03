#!/usr/bin/env node
/**
 * Assert worker/worker.env.example keys match the checklist documented in
 * docs/ops/GRAPHILE_WORKER.md (fenced checklist block).
 *
 * Replaces check-render-env-checklist.mjs, which read worker/render.yaml before
 * the worker moved off Render. Same guard, new source of truth.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const envExamplePath = path.join(root, 'worker/worker.env.example')
const docsPath = path.join(root, 'docs/ops/GRAPHILE_WORKER.md')

const REQUIRED_KEYS = [
  'DATABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
  'OPENAI_API_KEY',
]

/**
 * Required keys are the uncommented `KEY=` lines. Optional settings are left
 * commented out in the example (e.g. WORKER_CONCURRENCY) and are not asserted.
 */
function keysFromEnvExample(text) {
  const keys = []
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)=/)
    if (m) keys.push(m[1])
  }
  return keys
}

function keysFromDocsChecklist(text) {
  const block = text.match(/<!--\s*worker-env-checklist\s*-->\s*```[\s\S]*?```/)
  if (!block) return null
  const keys = []
  for (const line of block[0].split('\n')) {
    const m = line.match(/^\s*-\s*([A-Z0-9_]+)\s*$/)
    if (m) keys.push(m[1])
  }
  return keys
}

const envText = fs.readFileSync(envExamplePath, 'utf8')
const docsText = fs.readFileSync(docsPath, 'utf8')
const envKeys = keysFromEnvExample(envText)
const docsKeys = keysFromDocsChecklist(docsText)

let failed = false

for (const key of REQUIRED_KEYS) {
  if (!envKeys.includes(key)) {
    console.error(`worker/worker.env.example missing required key: ${key}`)
    failed = true
  }
}

if (!docsKeys) {
  console.error(
    'docs/ops/GRAPHILE_WORKER.md missing <!-- worker-env-checklist --> fenced list'
  )
  failed = true
} else {
  const missingInDocs = envKeys.filter((k) => !docsKeys.includes(k))
  const missingInEnv = docsKeys.filter((k) => !envKeys.includes(k))
  for (const k of missingInDocs) {
    console.error(`Documented checklist missing worker.env.example key: ${k}`)
    failed = true
  }
  for (const k of missingInEnv) {
    console.error(`worker.env.example missing documented checklist key: ${k}`)
    failed = true
  }
}

if (failed) {
  process.exit(1)
}

console.log(
  `OK — worker env checklist (${envKeys.length} keys) matches docs + required set`
)
