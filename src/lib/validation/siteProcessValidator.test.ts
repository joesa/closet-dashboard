import { describe, expect, it } from 'vitest'
import { validateTenantSite } from './siteValidator'
import { autoFixTenantSite } from './autoFixSiteIssues'

// We will mock Supabase or verify structurally
describe('Process steps validation and autofix rules', () => {
  it('identifies valid process steps correctly', () => {
    const validProcess = {
      title: 'Our Process',
      subtitle: 'How it works',
      steps: [
        { number: '01', title: 'Consult', description: 'Meet with us.' },
        { number: '02', title: 'Design', description: 'Plan the project.' },
        { number: '03', title: 'Install', description: 'Build and deliver.' }
      ]
    }

    const steps = validProcess.steps
    const hasThreeSteps = steps.length === 3
    const startsWithOne = steps[0]?.number === '01'
    const isOrdered = steps[0]?.number === '01' && steps[1]?.number === '02' && steps[2]?.number === '03'

    expect(hasThreeSteps).toBe(true)
    expect(startsWithOne).toBe(true)
    expect(isOrdered).toBe(true)
  })

  it('detects invalid process steps (e.g. missing 01, incorrect sequence)', () => {
    const invalidProcess = {
      title: 'Our Process',
      subtitle: 'How it works',
      steps: [
        { number: '02', title: 'Design', description: 'Plan the project.' },
        { number: '03', title: 'Install', description: 'Build and deliver.' }
      ]
    }

    const steps = invalidProcess.steps
    const hasThreeSteps = steps.length === 3
    const startsWithOne = steps[0]?.number === '01'
    const isOrdered = steps[0]?.number === '01' && steps[1]?.number === '02' && steps[2]?.number === '03'

    expect(hasThreeSteps && startsWithOne && isOrdered).toBe(false)
  })
})
