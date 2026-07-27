import { describe, expect, it } from 'vitest'
import {
  CUSTOM_BUILD_JOB_REQUEUE_MS,
  CUSTOM_BUILD_JOB_STALE_MS,
  classifyCustomBuildError,
  expireStaleCustomBuildJob,
  isCustomBuildJobActive,
  shouldRequeueCustomBuildJob,
  type CustomBuildJob,
} from './customBuildJob'

function job(partial: Partial<CustomBuildJob> & Pick<CustomBuildJob, 'status'>): CustomBuildJob {
  return {
    intent: 'full',
    prompt: 'test',
    started_at: new Date().toISOString(),
    ...partial,
  }
}

describe('expireStaleCustomBuildJob', () => {
  it('marks long-running processing jobs as failed', () => {
    const now = Date.parse('2026-07-24T23:10:00.000Z')
    const started = new Date(now - CUSTOM_BUILD_JOB_STALE_MS - 1000).toISOString()
    const out = expireStaleCustomBuildJob(
      job({ status: 'processing', started_at: started }),
      now
    )
    expect(out?.status).toBe('failed')
    expect(out?.error).toMatch(/silent|Re-queue|re-queue|heartbeat/i)
    expect(out?.dead_lettered).toBe(true)
    expect(out?.finished_at).toBeTruthy()
  })

  it('expires after a long Graphile heartbeat silence (~45 minutes)', () => {
    expect(CUSTOM_BUILD_JOB_STALE_MS).toBeGreaterThanOrEqual(40 * 60 * 1000)
    expect(CUSTOM_BUILD_JOB_STALE_MS).toBeLessThanOrEqual(50 * 60 * 1000)
  })

  it('keeps processing jobs alive while heartbeat is fresh', () => {
    const now = Date.now()
    const current = job({
      status: 'processing',
      started_at: new Date(now - 10 * 60 * 1000).toISOString(),
      heartbeat_at: new Date(now - 10_000).toISOString(),
    })
    expect(expireStaleCustomBuildJob(current, now)).toBe(current)
    expect(isCustomBuildJobActive(current)).toBe(true)
  })

  it('leaves fresh queued jobs alone', () => {
    const now = Date.now()
    const current = job({
      status: 'queued',
      started_at: new Date(now - 10_000).toISOString(),
    })
    expect(expireStaleCustomBuildJob(current, now)).toBe(current)
    expect(isCustomBuildJobActive(current)).toBe(true)
  })

  it('does not treat succeeded jobs as active', () => {
    expect(
      isCustomBuildJobActive(job({ status: 'succeeded', started_at: '2020-01-01T00:00:00Z' }))
    ).toBe(false)
  })
})

describe('classifyCustomBuildError', () => {
  it('classifies known failure kinds', () => {
    expect(classifyCustomBuildError('cancelled by admin').kind).toBe('cancelled')
    expect(classifyCustomBuildError('worker went silent').kind).toBe('worker_offline')
    expect(classifyCustomBuildError('Claude terminated (OOM)').kind).toBe('oom')
    expect(
      classifyCustomBuildError('Full redesign incomplete — missing pages: /faq').kind
    ).toBe('incomplete_pages')
  })
})

describe('shouldRequeueCustomBuildJob', () => {
  it('requeues queued jobs after the grace window', () => {
    const now = Date.now()
    expect(
      shouldRequeueCustomBuildJob(
        job({
          status: 'queued',
          started_at: new Date(now - CUSTOM_BUILD_JOB_REQUEUE_MS - 1).toISOString(),
        }),
        now
      )
    ).toBe(true)
  })

  it('does not requeue processing jobs', () => {
    const now = Date.now()
    expect(
      shouldRequeueCustomBuildJob(
        job({
          status: 'processing',
          started_at: new Date(now - CUSTOM_BUILD_JOB_REQUEUE_MS * 2).toISOString(),
        }),
        now
      )
    ).toBe(false)
  })
})
