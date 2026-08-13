import { describe, expect, it } from 'vitest'
import type { SpecBuildProgressResponse } from '@/lib/spec/specBuildProgress'
import { progressRevision } from './SpecBuildProgress'

const progress = (over: Partial<SpecBuildProgressResponse> = {}): SpecBuildProgressResponse => ({
  status: 'drafting',
  serverTime: '2026-08-12T12:00:00.000Z',
  updatedAt: '2026-08-12T11:59:00.000Z',
  statusReason: null,
  lastError: null,
  timeline: {
    stages: [],
    queueWaitMs: 1000,
    activeProcessingMs: 59000,
    currentStageStartedAt: '2026-08-12T11:59:00.000Z',
    pausedFromStage: null,
    partialHistory: false,
  },
  research: { completedAt: '2026-08-12T11:59:00.000Z', sourcesRead: 2 },
  provisioning: null,
  building: null,
  ...over,
})

describe('progressRevision', () => {
  it('ignores clock-only snapshots but detects meaningful backend changes', () => {
    const initial = progress()
    expect(progressRevision({ ...initial, serverTime: '2026-08-12T12:00:02.000Z' }))
      .toBe(progressRevision(initial))
    expect(progressRevision(progress({ status: 'imaging' })))
      .not.toBe(progressRevision(initial))
    expect(progressRevision(progress({ research: { completedAt: initial.research.completedAt, sourcesRead: 3 } })))
      .not.toBe(progressRevision(initial))
  })
})
