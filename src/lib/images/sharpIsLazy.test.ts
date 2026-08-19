import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * sharp must never be imported at module scope.
 *
 * A static import links libvips as soon as anything in the import graph loads,
 * and that dlopen fails on Vercel. The blast radius is not image handling: it
 * is every route that transitively reaches the module. Two have already died
 * this way — /api/intake/pro/start, and the provisioning fallback cron, which
 * meant the only automatic recovery for a stuck provision job answered 500 to
 * every call for as long as nobody checked it.
 *
 * Tests may import it statically; they run on a machine that has libvips.
 */
const SRC = resolve(__dirname, '..', '..')

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

describe('sharp', () => {
  const files = walk(SRC)

  it('scans a real file list', () => {
    expect(files.length).toBeGreaterThan(100)
  })

  it('is never imported at module scope in shipped code', () => {
    const offenders = files
      .filter((file) => /^\s*import\s+[^;]*\bfrom\s+['"]sharp['"]/m.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC, file).split('\\').join('/'))

    expect(offenders).toEqual([])
  })
})
