import { readFileSync } from 'fs'
const lines = readFileSync(process.argv[2], 'utf8').split('\n')
const calls = []
for (const l of lines) {
  const i = l.indexOf('{"event":"ai_text_call"')
  if (i < 0) continue
  try { calls.push(JSON.parse(l.slice(i))) } catch {}
}
if (!calls.length) { console.log('no ai_text_call events found'); process.exit(0) }
const n = (v) => (v ?? 0)
let fresh = 0, write = 0, read = 0, out = 0
console.log('pass                 provider   input   cacheW   cacheR  output')
for (const c of calls) {
  console.log(
    `${String(c.pass ?? c.purpose ?? '?').padEnd(20)} ${String(c.provider).padEnd(9)} ` +
    `${String(n(c.inputTokens)).padStart(6)} ${String(n(c.cacheWriteTokens)).padStart(8)} ` +
    `${String(n(c.cacheReadTokens)).padStart(8)} ${String(n(c.outputTokens)).padStart(7)}`
  )
  fresh += n(c.inputTokens); write += n(c.cacheWriteTokens)
  read += n(c.cacheReadTokens); out += n(c.outputTokens)
}
console.log('-'.repeat(62))
console.log(`${'TOTAL'.padEnd(30)} ${String(fresh).padStart(6)} ${String(write).padStart(8)} ${String(read).padStart(8)} ${String(out).padStart(7)}`)
const billedNow = fresh + write * 1.25 + read * 0.1
const billedUncached = fresh + write + read
console.log(`\nprompt tokens billed (cached):   ${Math.round(billedNow).toLocaleString()}`)
console.log(`prompt tokens billed (uncached): ${Math.round(billedUncached).toLocaleString()}`)
if (billedNow > 0) console.log(`saving on prompt tokens:         ${(100 * (1 - billedNow / billedUncached)).toFixed(1)}%`)
