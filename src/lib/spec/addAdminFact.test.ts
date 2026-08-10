import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SpecBuildRow, SpecFact } from '@/lib/spec/types'

const mocks = vi.hoisted(() => ({
  createSpecIntake: vi.fn(),
  transitionSpecBuild: vi.fn(),
  kickSpecBuild: vi.fn(),
}))

vi.mock('@/lib/spec/createSpecIntake', () => ({
  createSpecIntake: mocks.createSpecIntake,
}))
vi.mock('@/lib/spec/specBuilds', () => ({
  getSpecBuild: vi.fn(),
  transitionSpecBuild: mocks.transitionSpecBuild,
}))
vi.mock('@/lib/spec/kickSpecBuild', () => ({ kickSpecBuild: mocks.kickSpecBuild }))

import { isResearchAttention, redraftFromFacts } from '@/lib/spec/addAdminFact'

const build = { id: 'build-1', status: 'needs_attention', lead_input: {} } as SpecBuildRow
const facts = [{ field: 'client_artifact', value: 'Named customer report' }] as SpecFact[]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.createSpecIntake.mockResolvedValue({
    intakeId: 'intake-1',
    hasProprietaryDetail: true,
  })
})

describe('redraftFromFacts', () => {
  it('clears the stale source error only when the status transition succeeds', async () => {
    mocks.transitionSpecBuild.mockResolvedValue(true)

    await expect(redraftFromFacts(build, facts)).resolves.toBe(true)
    expect(mocks.transitionSpecBuild).toHaveBeenCalledWith(
      'build-1',
      ['needs_attention', 'queued', 'researching'],
      'drafting',
      expect.objectContaining({
        research: { facts },
        status_reason: null,
        last_error: null,
      })
    )
    expect(mocks.kickSpecBuild).toHaveBeenCalledWith('build-1')
  })

  it('does not claim redrafting or kick work when the row was not transitioned', async () => {
    mocks.transitionSpecBuild.mockResolvedValue(false)

    await expect(redraftFromFacts(build, facts)).resolves.toBe(false)
    expect(mocks.kickSpecBuild).not.toHaveBeenCalled()
  })
})

describe('isResearchAttention', () => {
  it('recognizes source and evidence failures superseded by a manual fact', () => {
    expect(isResearchAttention('No source produced readable text. facebook_about failed', null)).toBe(true)
    expect(isResearchAttention('No proprietary detail found.', null)).toBe(true)
  })

  it('preserves unrelated operational failures', () => {
    expect(isResearchAttention('Image generation failed', 'OpenAI timeout')).toBe(false)
    expect(isResearchAttention('Provisioning failed', 'Tenant insert rejected')).toBe(false)
  })
})