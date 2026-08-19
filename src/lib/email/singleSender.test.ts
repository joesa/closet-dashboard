import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * All outbound mail goes through src/lib/email/send.ts.
 *
 * Nine call sites each built their own Resend client, so a customer could get
 * a lead alert, a launch email and a password reset that looked like three
 * different companies — and none of them left a record, which meant a bounced
 * lead notification was invisible to us and to them. Now that the delivery
 * webhook writes receipts, a send that bypasses the module is a send nobody
 * can account for.
 */

const SRC = resolve(__dirname, '..', '..')
const ALLOWED = new Set(['lib/email/send.ts'])

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

describe('outbound mail', () => {
  const files = walk(SRC)

  it('finds the source tree (guards against a walk that silently returns nothing)', () => {
    expect(files.length).toBeGreaterThan(100)
  })

  it('is sent only through the email module', () => {
    const offenders = files
      .filter((file) => /\.emails\.send\(|new Resend\(/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC, file).split('\\').join('/'))
      .filter((rel) => !ALLOWED.has(rel))

    expect(offenders).toEqual([])
  })
})
