#!/usr/bin/env node
/**
 * Assert worker/render.yaml env keys match the Render checklist documented
 * in docs/ops/GRAPHILE_WORKER.md (fenced checklist block).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const renderPath = path.join(root, 'worker/render.yaml')
const docsPath = path.join(root, 'docs/ops/GRAPHILE_WORKER.md')

const REQUIRED_FROM_RENDER = [
  'DATABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
  'OPENAI_API_KEY',
]

function keysFromRenderYaml(text) {
  const keys = []
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*-\s*key:\s*([A-Z0-9_]+)\s*$/)
    if (m) keys.push(m[1])
  }
  return keys
}

function keysFromDocsChecklist(text) {
  const block = text.match(
    /<!--\s*render-env-checklist\s*-->\s*```[\s\S]*?```/
  )
  if (!block) return null
  const keys = []
  for (const line of block[0].split('\n')) {
    const m = line.match(/^\s*-\s*([A-Z0-9_]+)\s*$/)
    if (m) keys.push(m[1])
  }
  return keys
}

const renderText = fs.readFileSync(renderPath, 'utf8')
const docsText = fs.readFileSync(docsPath, 'utf8')
const renderKeys = keysFromRenderYaml(renderText)
const docsKeys = keysFromDocsChecklist(docsText)

let failed = false

for (const key of REQUIRED_FROM_RENDER) {
  if (!renderKeys.includes(key)) {
    console.error(`render.yaml missing required key: ${key}`)
    failed = true
  }
}

if (!docsKeys) {
  console.error(
    'docs/ops/GRAPHILE_WORKER.md missing <!-- render-env-checklist --> fenced list'
  )
  failed = true
} else {
  const missingInDocs = renderKeys.filter((k) => !docsKeys.includes(k))
  const missingInRender = docsKeys.filter((k) => !renderKeys.includes(k))
  for (const k of missingInDocs) {
    console.error(`Documented checklist missing render.yaml key: ${k}`)
    failed = true
  }
  for (const k of missingInRender) {
    console.error(`render.yaml missing documented checklist key: ${k}`)
    failed = true
  }
}

if (failed) {
  process.exit(1)
}

console.log(
  `OK — render env checklist (${renderKeys.length} keys) matches docs + required set`
)
