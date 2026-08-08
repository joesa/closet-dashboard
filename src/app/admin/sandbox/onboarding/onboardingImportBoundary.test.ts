import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('sandbox onboarding client imports', () => {
  it('uses the browser-safe presentation rules module', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/app/admin/sandbox/onboarding/GuidedBuilder.tsx'),
      'utf8'
    )

    expect(source).toContain("from '@/lib/ai/sitePresentationRules'")
    expect(source).not.toContain("from '@/lib/ai/resolveSitePresentation'")
  })
})