import { beforeEach, describe, expect, it, vi } from 'vitest'

import { canEnqueueBackgroundJobs, enqueueJob } from '@/lib/jobs/enqueueJob'
import { processProvisionQueue } from '@/lib/provision/processProvisionQueue'
import { kickProvisionAfterSubmit } from './kickProvisionAfterSubmit'

vi.mock('@/lib/jobs/enqueueJob', () => ({
  canEnqueueBackgroundJobs: vi.fn(() => true),
  enqueueJob: vi.fn(async () => ({ id: '1' })),
}))
vi.mock('@/lib/provision/processProvisionQueue', () => ({
  processProvisionQueue: vi.fn(async () => []),
}))
vi.mock('@/lib/urls', () => ({ publicAppOrigin: () => 'https://example.test' }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(canEnqueueBackgroundJobs).mockReturnValue(true)
  vi.mocked(enqueueJob).mockResolvedValue({ id: '1' })
})

describe('kickProvisionAfterSubmit', () => {
  it('awaits the enqueue so the deploy survives the response', async () => {
    // Regression: this was fire-and-forget, and the serverless instance froze on
    // response — the job never committed and the intake sat undeployed until the
    // daily cron. Resolving only after add_job commits is the whole fix.
    let committed = false
    vi.mocked(enqueueJob).mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5))
      committed = true
      return { id: '1' }
    })

    const result = await kickProvisionAfterSubmit('intake-1')

    expect(committed).toBe(true)
    expect(result).toMatchObject({ queued: true, via: 'worker' })
    expect(enqueueJob).toHaveBeenCalledWith(
      'provision_tenant',
      { intakeId: 'intake-1' },
      expect.objectContaining({ jobKey: 'provision_tenant:intake-1' })
    )
  })

  it('reports the failure instead of claiming the deploy is queued', async () => {
    vi.mocked(enqueueJob).mockRejectedValue(new Error('no DATABASE_URL'))

    const result = await kickProvisionAfterSubmit('intake-1')

    expect(result.queued).toBe(false)
    expect(result.via).toBe('failed')
    expect(result.error).toContain('no DATABASE_URL')
    // Still tries in-process rather than dropping the intake entirely.
    expect(processProvisionQueue).toHaveBeenCalled()
  })

  it('falls back to in-process provisioning when no worker is configured', async () => {
    vi.mocked(canEnqueueBackgroundJobs).mockReturnValue(false)

    const result = await kickProvisionAfterSubmit('intake-1')

    expect(result.via).toBe('in_process')
    expect(enqueueJob).not.toHaveBeenCalled()
    expect(processProvisionQueue).toHaveBeenCalledWith('https://example.test', {
      batchSize: 1,
      intakeId: 'intake-1',
    })
  })
})
