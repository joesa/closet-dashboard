import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import pkg from '../../package.json'

// The npm lifecycle hooks that copy the built widget bundle in from the
// sibling closet-widget checkout. These used to invoke an absolute
// Windows powershell.exe path, which meant they failed loudly on Linux
// (npm aborted before `next dev` ran) or silently did nothing, shipping a
// stale widget.js. These tests run the real command string out of
// package.json, so they fail if anyone reintroduces a platform-specific hook.
const HOOKS = ['predev'] as const

const SOURCE_REL = '../closet-widget/dist/widget.js'
const TARGET_REL = 'public/widget.js'

let sandbox: string
let projectDir: string
let sourcePath: string

beforeEach(() => {
  sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'widget-copy-hook-'))
  projectDir = path.join(sandbox, 'project')
  fs.mkdirSync(path.join(projectDir, 'public'), { recursive: true })
  sourcePath = path.join(projectDir, SOURCE_REL)
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true })
})

afterEach(() => {
  fs.rmSync(sandbox, { recursive: true, force: true })
})

function runHook(name: string) {
  const command = (pkg.scripts as Record<string, string>)[name]
  execSync(command, { cwd: projectDir, stdio: 'pipe' })
}

const target = () => path.join(projectDir, TARGET_REL)

describe.each(HOOKS)('%s widget copy hook', (hook) => {
  it('is defined', () => {
    expect((pkg.scripts as Record<string, string>)[hook]).toBeTruthy()
  })

  it('does not depend on a platform-specific interpreter', () => {
    const command = (pkg.scripts as Record<string, string>)[hook]
    // A drive-letter path or powershell/cmd invocation only works on one OS.
    expect(command).not.toMatch(/powershell|cmd\.exe|\b[A-Za-z]:\\/i)
  })

  it('copies the built widget bundle into public/', () => {
    fs.writeFileSync(sourcePath, 'console.log("widget build")')

    runHook(hook)

    expect(fs.readFileSync(target(), 'utf8')).toBe('console.log("widget build")')
  })

  it('overwrites a stale bundle that is already in place', () => {
    fs.writeFileSync(target(), 'console.log("stale")')
    fs.writeFileSync(sourcePath, 'console.log("fresh")')

    runHook(hook)

    expect(fs.readFileSync(target(), 'utf8')).toBe('console.log("fresh")')
  })

  it('succeeds without a copy when the widget has not been built', () => {
    // A fresh checkout with no closet-widget build must not block dev/build.
    expect(fs.existsSync(sourcePath)).toBe(false)

    expect(() => runHook(hook)).not.toThrow()

    expect(fs.existsSync(target())).toBe(false)
  })
})
