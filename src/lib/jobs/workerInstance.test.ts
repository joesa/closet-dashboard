import { afterEach, describe, expect, it } from 'vitest'
import {
  buildWorkerIdentity,
  summarizeWorkerInstances,
  workerGitSha,
  WORKER_STALE_AFTER_MS,
  type WorkerInstanceRow,
} from './workerInstance'

const NOW = new Date('2026-08-15T06:00:00.000Z')

function row(over: Partial<WorkerInstanceRow> = {}): WorkerInstanceRow {
  return {
    id: 'vm-1-abc',
    git_sha: '2482b3dcafe',
    image_built_at: '2026-08-15T05:00:00.000Z',
    hostname: 'vm-1',
    concurrency: 3,
    task_ids: ['full_redesign'],
    started_at: '2026-08-15T05:00:00.000Z',
    last_seen_at: NOW.toISOString(),
    stopped_at: null,
    ...over,
  }
}

describe('workerGitSha', () => {
  const prev = process.env.WORKER_GIT_SHA

  afterEach(() => {
    if (prev === undefined) delete process.env.WORKER_GIT_SHA
    else process.env.WORKER_GIT_SHA = prev
  })

  it('is null when the image was built without a GIT_SHA build arg', () => {
    delete process.env.WORKER_GIT_SHA
    expect(workerGitSha()).toBeNull()
    // An empty build arg reaches the container as an empty string, not unset.
    process.env.WORKER_GIT_SHA = '   '
    expect(workerGitSha()).toBeNull()
  })

  it('reports the baked commit', () => {
    process.env.WORKER_GIT_SHA = '2482b3d'
    expect(workerGitSha()).toBe('2482b3d')
  })
})

describe('buildWorkerIdentity', () => {
  it('is unique per boot so a redeploy does not overwrite the last row', () => {
    const a = buildWorkerIdentity({
      hostname: 'vm-1',
      concurrency: 3,
      taskIds: ['full_redesign'],
      now: NOW,
      random: () => 0.5,
    })
    const b = buildWorkerIdentity({
      hostname: 'vm-1',
      concurrency: 3,
      taskIds: ['full_redesign'],
      now: new Date(NOW.getTime() + 1000),
      random: () => 0.5,
    })
    expect(a.id).not.toBe(b.id)
    expect(a.id.startsWith('vm-1-')).toBe(true)
    expect(a.concurrency).toBe(3)
  })
})

describe('summarizeWorkerInstances', () => {
  it('counts a recent heartbeat as alive', () => {
    const [inst] = summarizeWorkerInstances([row()], NOW)
    expect(inst.alive).toBe(true)
    expect(inst.msSinceHeartbeat).toBe(0)
  })

  it('counts a stale heartbeat as dead — a killed container never reports it', () => {
    const stale = row({
      last_seen_at: new Date(NOW.getTime() - WORKER_STALE_AFTER_MS - 1).toISOString(),
    })
    expect(summarizeWorkerInstances([stale], NOW)[0].alive).toBe(false)
  })

  it('tolerates a missed beat without flapping', () => {
    const oneMissed = row({
      last_seen_at: new Date(NOW.getTime() - WORKER_STALE_AFTER_MS + 1000).toISOString(),
    })
    expect(summarizeWorkerInstances([oneMissed], NOW)[0].alive).toBe(true)
  })

  it('treats a gracefully stopped instance as not alive even when just seen', () => {
    const stopped = row({ stopped_at: NOW.toISOString() })
    expect(summarizeWorkerInstances([stopped], NOW)[0].alive).toBe(false)
  })

  it('orders newest boot first so the current build reads off the top', () => {
    const older = row({ id: 'old', started_at: '2026-08-14T00:00:00.000Z', git_sha: 'aaa' })
    const newer = row({ id: 'new', started_at: '2026-08-15T05:30:00.000Z', git_sha: 'bbb' })
    expect(summarizeWorkerInstances([older, newer], NOW).map((i) => i.id)).toEqual([
      'new',
      'old',
    ])
  })
})
