import { afterEach, describe, expect, it, vi } from 'vitest'

import { assertInitialAdminPreviewReady } from '@/lib/launch/initialAdminPreview'
import { waitForInitialSiteDeployed } from './waitForInitialSite'

vi.mock('@/lib/launch/initialAdminPreview', () => ({
  assertInitialAdminPreviewReady: vi.fn(),
}))

const ready = vi.mocked(assertInitialAdminPreviewReady)

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('waitForInitialSiteDeployed', () => {
  it('returns as soon as the template site serves', async () => {
    ready.mockResolvedValueOnce(undefined)

    const result = await waitForInitialSiteDeployed('tenant-1', {
      timeoutMs: 60_000,
      intervalMs: 1,
    })

    expect(result.ready).toBe(true)
    expect(result.attempts).toBe(1)
    expect(ready).toHaveBeenCalledWith('tenant-1')
  })

  it('keeps probing while the new subdomain is still coming up', async () => {
    ready
      .mockRejectedValueOnce(new Error('Initial admin preview returned HTTP 404'))
      .mockRejectedValueOnce(new Error('Initial admin preview is not reachable yet'))
      .mockResolvedValueOnce(undefined)

    const result = await waitForInitialSiteDeployed('tenant-1', {
      timeoutMs: 60_000,
      intervalMs: 1,
    })

    expect(result.ready).toBe(true)
    expect(result.attempts).toBe(3)
  })

  it('gives up at the deadline and reports the last failure', async () => {
    ready.mockRejectedValue(new Error('Initial site has no admin-bypass preview URL yet'))

    const result = await waitForInitialSiteDeployed('tenant-1', {
      timeoutMs: 30,
      intervalMs: 10,
    })

    expect(result.ready).toBe(false)
    expect(result.lastError).toContain('no admin-bypass preview URL')
    // Bounded: it stops probing instead of holding the worker slot forever.
    expect(result.attempts).toBeGreaterThan(0)
    expect(result.attempts).toBeLessThan(10)
  })
})
