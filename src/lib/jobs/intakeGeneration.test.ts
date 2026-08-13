import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  canEnqueue: vi.fn(),
  enqueue: vi.fn(),
  getIntake: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}))

vi.mock('@/lib/jobs/enqueueJob', () => ({
  canEnqueueBackgroundJobs: mocks.canEnqueue,
  enqueueJob: mocks.enqueue,
}))
vi.mock('@/lib/intake/getIntakeByToken', () => ({ getIntakeByToken: mocks.getIntake }))
vi.mock('@/lib/supabase-admin', () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }))

import {
  enqueueIntakeGeneration,
  INTAKE_GENERATION_OPERATIONS,
} from '@/lib/jobs/intakeGeneration'

function request(payload: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/intake/token/suggest-craft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

describe('intake generation queue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.canEnqueue.mockReturnValue(true)
    mocks.getIntake.mockResolvedValue({ id: 'intake-1', status: 'draft' })
    mocks.enqueue.mockResolvedValue({ id: 'graphile-1' })
    const single = vi.fn().mockResolvedValue({ data: { id: 'generation-1' }, error: null })
    const select = vi.fn(() => ({ single }))
    const insert = vi.fn(() => ({ select }))
    mocks.getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => ({ insert })) })
  })

  it('fails closed instead of running generation in Vercel when Oracle is unavailable', async () => {
    mocks.canEnqueue.mockReturnValue(false)
    const response = await enqueueIntakeGeneration(request(), 'token', 'suggest-craft')

    expect(response.status).toBe(503)
    expect(mocks.getIntake).not.toHaveBeenCalled()
    expect(mocks.enqueue).not.toHaveBeenCalled()
  })

  it('persists a job and sends only its identity to Graphile Worker', async () => {
    const response = await enqueueIntakeGeneration(
      request({ industry: 'Cabinet maker' }),
      'token',
      'suggest-craft'
    )

    expect(response.status).toBe(202)
    expect(await response.json()).toEqual({
      async: true,
      queued: true,
      jobId: 'generation-1',
      statusUrl: '/api/intake/token/generation-jobs/generation-1',
    })
    expect(mocks.enqueue).toHaveBeenCalledWith(
      'intake_generation',
      { jobId: 'generation-1', token: 'token', operation: 'suggest-craft' },
      { jobKey: 'intake_generation:generation-1', maxAttempts: 1 }
    )
  })

  it('covers every intake endpoint that can invoke a model or availability generator', () => {
    expect([...INTAKE_GENERATION_OPERATIONS].sort()).toEqual([
      'generate-logo',
      'generate-page-copy',
      'preview-presentation',
      'resolve-custom-industry',
      'suggest-craft',
      'suggest-customers',
      'suggest-domains',
      'suggest-pages',
    ])
  })
})
