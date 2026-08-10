import { describe, expect, it } from 'vitest'

import {
  deriveSpecBuildTimeline,
  type SpecBuildStageEvent,
} from '@/lib/spec/specBuildProgress'

const at = (minute: number) => `2026-08-10T00:${String(minute).padStart(2, '0')}:00.000Z`

function event(
  id: string,
  fromStatus: SpecBuildStageEvent['fromStatus'],
  toStatus: SpecBuildStageEvent['toStatus'],
  minute: number,
  metadata: SpecBuildStageEvent['metadata'] = {}
): SpecBuildStageEvent {
  return { eventOrder: Number(id), id, fromStatus, toStatus, occurredAt: at(minute), metadata }
}

describe('deriveSpecBuildTimeline', () => {
  it('separates queue wait from active processing and marks the current stage', () => {
    const timeline = deriveSpecBuildTimeline({
      createdAt: at(0),
      currentStatus: 'drafting',
      now: at(12),
      events: [
        event('1', null, 'queued', 0, { initial: true }),
        event('2', 'queued', 'researching', 5),
        event('3', 'researching', 'drafting', 9),
      ],
    })

    expect(timeline.queueWaitMs).toBe(5 * 60_000)
    expect(timeline.activeProcessingMs).toBe(7 * 60_000)
    expect(timeline.currentStageStartedAt).toBe(at(9))
    expect(timeline.stages.find((stage) => stage.stage === 'researching')).toMatchObject({
      state: 'completed',
      activeDurationMs: 4 * 60_000,
    })
    expect(timeline.stages.find((stage) => stage.stage === 'drafting')?.state).toBe('current')
  })

  it('pauses active time in needs_attention and preserves retry attempts', () => {
    const timeline = deriveSpecBuildTimeline({
      createdAt: at(0),
      currentStatus: 'researching',
      now: at(20),
      events: [
        event('1', null, 'queued', 0, { initial: true }),
        event('2', 'queued', 'researching', 2),
        event('3', 'researching', 'needs_attention', 6),
        event('4', 'needs_attention', 'queued', 15),
        event('5', 'queued', 'researching', 17),
      ],
    })

    expect(timeline.activeProcessingMs).toBe(7 * 60_000)
    expect(timeline.stages.find((stage) => stage.stage === 'researching')).toMatchObject({
      state: 'current',
      attempts: 2,
      activeDurationMs: 7 * 60_000,
    })
  })

  it('resets later stage visuals when a build retries from research', () => {
    const timeline = deriveSpecBuildTimeline({
      createdAt: at(0),
      currentStatus: 'researching',
      now: at(20),
      events: [
        event('1', null, 'queued', 0, { initial: true }),
        event('2', 'queued', 'researching', 1),
        event('3', 'researching', 'drafting', 2),
        event('4', 'drafting', 'imaging', 3),
        event('5', 'imaging', 'needs_attention', 4),
        event('6', 'needs_attention', 'queued', 15),
        event('7', 'queued', 'researching', 17),
      ],
    })

    expect(timeline.stages.find((stage) => stage.stage === 'researching')?.state).toBe('current')
    expect(timeline.stages.find((stage) => stage.stage === 'drafting')?.state).toBe('pending')
    expect(timeline.stages.find((stage) => stage.stage === 'imaging')?.state).toBe('pending')
  })

  it('shows the stage where a build paused', () => {
    const timeline = deriveSpecBuildTimeline({
      createdAt: at(0),
      currentStatus: 'needs_attention',
      now: at(20),
      events: [
        event('1', null, 'queued', 0, { initial: true }),
        event('2', 'queued', 'researching', 2),
        event('3', 'researching', 'needs_attention', 6),
      ],
    })

    expect(timeline.activeProcessingMs).toBe(4 * 60_000)
    expect(timeline.pausedFromStage).toBe('researching')
    expect(timeline.stages.find((stage) => stage.stage === 'researching')?.state).toBe('paused')
  })

  it('marks migrated histories as partial instead of inventing earlier durations', () => {
    const timeline = deriveSpecBuildTimeline({
      createdAt: at(0),
      currentStatus: 'building',
      now: at(20),
      events: [event('1', null, 'building', 18, { baseline: true })],
    })

    expect(timeline.partialHistory).toBe(true)
    expect(timeline.queueWaitMs).toBe(0)
    expect(timeline.activeProcessingMs).toBe(2 * 60_000)
    expect(timeline.stages.slice(0, 5).every((stage) => stage.state === 'completed')).toBe(true)
    expect(timeline.stages.find((stage) => stage.stage === 'building')?.state).toBe('current')
  })

  it('starts legacy queued timing at the migration baseline', () => {
    const timeline = deriveSpecBuildTimeline({
      createdAt: at(0),
      currentStatus: 'queued',
      now: at(20),
      events: [event('1', null, 'queued', 18, { baseline: true })],
    })

    expect(timeline.queueWaitMs).toBe(2 * 60_000)
  })

  it('keeps the build timeline complete after the row enters outreach states', () => {
    const timeline = deriveSpecBuildTimeline({
      createdAt: at(0),
      currentStatus: 'approved',
      now: at(20),
      events: [
        event('1', null, 'queued', 0, { initial: true }),
        event('2', 'queued', 'researching', 1),
        event('3', 'researching', 'drafting', 2),
        event('4', 'drafting', 'imaging', 3),
        event('5', 'imaging', 'provisioning', 4),
        event('6', 'provisioning', 'building', 5),
        event('7', 'building', 'ready_for_review', 10),
        event('8', 'ready_for_review', 'approved', 15),
      ],
    })

    expect(timeline.stages.every((stage) => stage.state === 'completed')).toBe(true)
    expect(timeline.activeProcessingMs).toBe(9 * 60_000)
  })
})