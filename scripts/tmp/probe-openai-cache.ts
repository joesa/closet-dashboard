import { generateTextWithFallback } from '../../src/lib/ai/aiTextProvider'

// OpenAI needs a >=1024-token prefix before automatic caching engages.
const bigDoctrine = Array.from(
  { length: 240 },
  (_v, i) => `Rule ${i}: derive every visual choice from the subject's own materials, tools, and locality.`
).join('\n')

async function one(label: string) {
  const r = await generateTextWithFallback({
    prompt: 'Reply with the JSON object {"ok":true} and nothing else.',
    systemBlocks: [
      { text: bigDoctrine, cache: true },
      { text: 'You answer with strict JSON.' },
    ],
    jsonMode: true,
    maxOutputTokens: 64,
    preferredProvider: 'openai',
    providerChain: ['openai'],
  })
  const t = r.telemetry
  console.log(
    `${label}: provider=${r.provider} input=${t?.inputTokens} cacheRead=${t?.cacheReadTokens ?? 0} cost=${t?.estimatedCostUsd ?? 'n/a'}`
  )
  return t
}

async function main() {
  const a = await one('call 1')
  const b = await one('call 2')
  const hit = (b?.cacheReadTokens ?? 0) > 0
  console.log(`\n${hit ? 'PASS' : 'INCONCLUSIVE'} — OpenAI cached_tokens ${hit ? 'captured' : 'not reported (prefix may be under the 1024-token minimum)'}`)
  if ((a?.inputTokens ?? 0) < 1024) console.log('note: prefix under OpenAI minimum; caching cannot engage')
}
main().catch((e) => { console.error(e); process.exit(1) })
