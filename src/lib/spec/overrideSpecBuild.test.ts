import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SpecBuildRow } from '@/lib/spec/types'

const mocks = vi.hoisted(() => ({
  getSpecBuild: vi.fn(),
  createSpecIntake: vi.fn(),
  transitionSpecBuild: vi.fn(),
  kickSpecBuild: vi.fn(),
}))

vi.mock('@/lib/spec/specBuilds', () => ({
  getSpecBuild: mocks.getSpecBuild,
  transitionSpecBuild: mocks.transitionSpecBuild,
}))
vi.mock('@/lib/spec/createSpecIntake', () => ({
  createSpecIntake: mocks.createSpecIntake,
}))
vi.mock('@/lib/spec/kickSpecBuild', () => ({ kickSpecBuild: mocks.kickSpecBuild }))

import { overrideSpecBuildToDrafting } from '@/lib/spec/overrideSpecBuild'

const build = {
  id: 'build-1',
  status: 'needs_attention',
  lead_input: {},
  research: { facts: [{ field: 'shop_rule', value: 'Never skip prep.' }] },
  tenant_id: null,
} as unknown as SpecBuildRow

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getSpecBuild.mockResolvedValue(build)
  mocks.createSpecIntake.mockResolvedValue({ intakeId: 'intake-1', hasProprietaryDetail: false })
  mocks.transitionSpecBuild.mockResolvedValue(true)
})

describe('overrideSpecBuildToDrafting', () => {
  it('forces drafting from needs_attention and kicks the worker', async () => {
    const result = await overrideSpecBuildToDrafting('build-1')

    expect(result).toEqual({ ok: true, from: 'needs_attention', to: 'drafting', intakeId: 'intake-1' })
    expect(mocks.transitionSpecBuild).toHaveBeenCalledWith(
      'build-1',
      ['needs_attention', 'queued', 'researching'],
      'drafting',
      expect.objectContaining({ intake_id: 'intake-1', status_reason: null, last_error: null })
    )
    expect(mocks.kickSpecBuild).toHaveBeenCalledWith('build-1')
  })

  it('refuses override once provisioning has started', async () => {
    mocks.getSpecBuild.mockResolvedValue({ ...build, status: 'provisioning' })

    await expect(overrideSpecBuildToDrafting('build-1')).resolves.toEqual({
      ok: false,
      reason: 'Override is only allowed before provisioning (queued/researching/needs attention).',
    })
    expect(mocks.createSpecIntake).not.toHaveBeenCalled()
  })

  it('returns a conflict when compare-and-set transition fails', async () => {
    mocks.transitionSpecBuild.mockResolvedValue(false)

    await expect(overrideSpecBuildToDrafting('build-1')).resolves.toEqual({
      ok: false,
      reason: 'Build state changed before override could be applied. Retry.',
    })
    expect(mocks.kickSpecBuild).not.toHaveBeenCalled()
  })
})
