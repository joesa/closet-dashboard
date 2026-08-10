import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentAdmin: vi.fn(),
  getSpecBuildProgress: vi.fn(),
}))

vi.mock('@/lib/admin', () => ({ getCurrentAdmin: mocks.getCurrentAdmin }))
vi.mock('@/lib/spec/specBuildProgress', () => ({
  getSpecBuildProgress: mocks.getSpecBuildProgress,
}))

import { GET } from './route'

function callGet(id = 'build-1') {
  return GET(new Request(`http://localhost/api/admin/spec-builds/${id}/progress`), {
    params: Promise.resolve({ id }),
  })
}

describe('GET Spec Build progress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentAdmin.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com' })
    mocks.getSpecBuildProgress.mockResolvedValue({
      status: 'researching',
      serverTime: '2026-08-10T00:00:00.000Z',
      timeline: { stages: [] },
    })
  })

  it('rejects unauthenticated requests before loading progress', async () => {
    mocks.getCurrentAdmin.mockResolvedValue(null)

    const response = await callGet()

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.getSpecBuildProgress).not.toHaveBeenCalled()
  })

  it('returns a private no-store progress snapshot', async () => {
    const response = await callGet()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0')
    expect((await response.json()).status).toBe('researching')
    expect(mocks.getSpecBuildProgress).toHaveBeenCalledWith('build-1')
  })

  it('returns 404 when the build no longer exists', async () => {
    mocks.getSpecBuildProgress.mockResolvedValue(null)

    const response = await callGet('missing')

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Spec Build not found' })
  })
})