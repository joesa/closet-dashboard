import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Guard for the intake submit payload.
 *
 * Encoding a photo as a base64 data URL and posting it inside the submit JSON
 * inflates it ~33% and routinely pushed the body past the platform's
 * request-body limit. The edge then answered with a plain-text 413 that the
 * form could not parse, so a prospect who had filled in seven steps saw
 * `Unexpected token 'R', "Request En"... is not valid JSON` and could not
 * submit at all.
 *
 * The rule that prevents it: intake images are uploaded to storage as soon as
 * they are picked (POST /api/intake/[token]/upload-image) and only their URLs
 * travel in the submit payload. These tests fail loudly if someone wires a
 * FileReader back into the form.
 */

const intakeDir = path.join(process.cwd(), 'src/app/intake/[token]')
const read = (file: string) => readFileSync(path.join(intakeDir, file), 'utf8')

describe('intake image upload contract', () => {
  const clientFiles = ['IntakeFormClient.tsx', 'IntakeImageStudio.tsx']

  it.each(clientFiles)('%s never reads user images into base64', (file) => {
    const src = read(file)
    expect(src).not.toMatch(/readAsDataURL/)
  })

  it.each(clientFiles)('%s uploads images to storage instead', (file) => {
    const src = read(file)
    expect(src).toMatch(/upload-image/)
  })

  it('the submit payload carries no image bytes', () => {
    const src = read('IntakeFormClient.tsx')
    // `logoDataUrl` / `dataUrl:` were the payload keys that carried base64.
    expect(src).not.toMatch(/logoDataUrl/)
    expect(src).not.toMatch(/dataUrl:/)
  })

  it('reads intake responses through the safe JSON reader', () => {
    const src = read('IntakeFormClient.tsx')
    expect(src).toMatch(/readJsonResponse/)
    // A bare res.json() throws on the plain-text bodies the platform returns
    // for 413/502/504, which is how the raw parse error reached customers.
    expect(src).not.toMatch(/await res\.json\(\)/)
  })
})
