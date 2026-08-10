import type { SpecBuildStatus } from '@/lib/spec/types'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { isCustomBuildJob } from '@/lib/ai/customBuildJob'
import { SPEC_BUILD_SELECT, type SpecBuildRow } from '@/lib/spec/types'

export const SPEC_BUILD_PROGRESS_STAGES = [
  'queued',
  'researching',
  'drafting',
  'imaging',
  'provisioning',
  'building',
  'ready_for_review',
] as const satisfies readonly SpecBuildStatus[]

export type SpecBuildProgressStage = (typeof SPEC_BUILD_PROGRESS_STAGES)[number]

export type SpecBuildStageEvent = {
  id: string
  eventOrder: number
  fromStatus: SpecBuildStatus | null
  toStatus: SpecBuildStatus
  occurredAt: string
  metadata: { baseline?: boolean; initial?: boolean }
}

export type SpecBuildStageState = 'completed' | 'current' | 'pending' | 'paused'

export type SpecBuildStageSummary = {
  stage: SpecBuildProgressStage
  state: SpecBuildStageState
  attempts: number
  activeDurationMs: number
  currentStartedAt: string | null
}

export type SpecBuildTimeline = {
  stages: SpecBuildStageSummary[]
  queueWaitMs: number
  activeProcessingMs: number
  currentStageStartedAt: string | null
  pausedFromStage: SpecBuildProgressStage | null
  partialHistory: boolean
}

export type SpecBuildProgressResponse = {
  status: SpecBuildStatus
  serverTime: string
  updatedAt: string
  statusReason: string | null
  lastError: string | null
  timeline: SpecBuildTimeline
  research: { completedAt: string | null; sourcesRead: number }
  provisioning: {
    status: string
    attempts: number
    createdAt: string
    startedAt: string | null
    finishedAt: string | null
    lastError: string | null
  } | null
  building: {
    status: string
    startedAt: string
    heartbeatAt: string | null
    finishedAt: string | null
    pass: string | null
    completedPaths: number
    requiredPaths: number
  } | null
}

const ACTIVE_STAGES = new Set<SpecBuildStatus>([
  'researching',
  'drafting',
  'imaging',
  'provisioning',
  'building',
])

function millisecondsBetween(start: string, end: string): number {
  const startMs = Date.parse(start)
  const endMs = Date.parse(end)
  return Number.isFinite(startMs) && Number.isFinite(endMs)
    ? Math.max(0, endMs - startMs)
    : 0
}

export function deriveSpecBuildTimeline(input: {
  createdAt: string
  currentStatus: SpecBuildStatus
  events: SpecBuildStageEvent[]
  now: string
}): SpecBuildTimeline {
  const events = [...input.events].sort((a, b) => a.eventOrder - b.eventOrder)
  const partialHistory = events.some((event) => event.metadata.baseline === true)
  const durations = new Map<SpecBuildProgressStage, number>()
  const attempts = new Map<SpecBuildProgressStage, number>()

  for (const [index, event] of events.entries()) {
    if (SPEC_BUILD_PROGRESS_STAGES.includes(event.toStatus as SpecBuildProgressStage)) {
      const stage = event.toStatus as SpecBuildProgressStage
      attempts.set(stage, (attempts.get(stage) ?? 0) + 1)
      if (ACTIVE_STAGES.has(stage)) {
        const end = events[index + 1]?.occurredAt ?? input.now
        durations.set(stage, (durations.get(stage) ?? 0) + millisecondsBetween(event.occurredAt, end))
      }
    }
  }

  const baselineEvent = events.find((event) => event.metadata.baseline === true)
  const queueStart = baselineEvent?.toStatus === 'queued'
    ? baselineEvent.occurredAt
    : partialHistory
      ? null
      : input.createdAt
  const firstResearch = events.find(
    (event) => event.toStatus === 'researching' && (!baselineEvent || event.eventOrder > baselineEvent.eventOrder)
  )
  const queueWaitMs = queueStart && firstResearch
    ? millisecondsBetween(queueStart, firstResearch.occurredAt)
    : queueStart && input.currentStatus === 'queued'
      ? millisecondsBetween(queueStart, input.now)
      : 0

  const latestEvent = events.at(-1)
  const currentStage = SPEC_BUILD_PROGRESS_STAGES.includes(
    input.currentStatus as SpecBuildProgressStage
  )
    ? (input.currentStatus as SpecBuildProgressStage)
    : null
  const currentStageIndex = currentStage
    ? SPEC_BUILD_PROGRESS_STAGES.indexOf(currentStage)
    : -1
  const pausedFromStage = input.currentStatus === 'needs_attention' && latestEvent?.fromStatus &&
    SPEC_BUILD_PROGRESS_STAGES.includes(latestEvent.fromStatus as SpecBuildProgressStage)
      ? (latestEvent.fromStatus as SpecBuildProgressStage)
      : null
  const pausedStageIndex = pausedFromStage
    ? SPEC_BUILD_PROGRESS_STAGES.indexOf(pausedFromStage)
    : -1
  const readyWasReached = (attempts.get('ready_for_review') ?? 0) > 0
  const completedFrontier = currentStageIndex >= 0
    ? currentStageIndex
    : pausedStageIndex >= 0
      ? pausedStageIndex
      : readyWasReached
        ? SPEC_BUILD_PROGRESS_STAGES.length - 1
        : -1
  const stages = SPEC_BUILD_PROGRESS_STAGES.map((stage, index): SpecBuildStageSummary => {
    let state: SpecBuildStageState = 'pending'
    if (pausedFromStage === stage) state = 'paused'
    else if (currentStage === stage && stage !== 'ready_for_review') state = 'current'
    else if (
      index < completedFrontier ||
      (readyWasReached && index === SPEC_BUILD_PROGRESS_STAGES.length - 1)
    ) {
      state = 'completed'
    }

    return {
      stage,
      state,
      attempts: attempts.get(stage) ?? 0,
      activeDurationMs: durations.get(stage) ?? 0,
      currentStartedAt:
        state === 'current' && latestEvent?.toStatus === stage ? latestEvent.occurredAt : null,
    }
  })

  return {
    stages,
    queueWaitMs,
    activeProcessingMs: [...durations.values()].reduce((total, duration) => total + duration, 0),
    currentStageStartedAt:
      currentStage && latestEvent?.toStatus === currentStage ? latestEvent.occurredAt : null,
    pausedFromStage,
    partialHistory,
  }
}

type StageEventRow = {
  id: string
  event_order: number
  from_status: SpecBuildStatus | null
  to_status: SpecBuildStatus
  occurred_at: string
  metadata: SpecBuildStageEvent['metadata'] | null
}

/** Read-only progress snapshot for the admin polling endpoint. */
export async function getSpecBuildProgress(
  id: string,
  now: Date = new Date()
): Promise<SpecBuildProgressResponse | null> {
  const supabase = getSupabaseAdmin()
  const { data: buildData, error: buildError } = await supabase
    .from('spec_builds')
    .select(SPEC_BUILD_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (buildError) throw new Error(`Failed to load Spec Build progress: ${buildError.message}`)
  if (!buildData) return null

  const build = buildData as SpecBuildRow
  const [eventsResult, provisionResult, siteConfigResult] = await Promise.all([
    supabase
      .from('spec_build_stage_events')
      .select('id, event_order, from_status, to_status, occurred_at, metadata')
      .eq('spec_build_id', id)
      .order('event_order', { ascending: true }),
    build.intake_id
      ? supabase
          .from('provision_jobs')
          .select('status, attempts, last_error, created_at, started_at, finished_at')
          .eq('intake_id', build.intake_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    build.tenant_id
      ? supabase
          .from('site_configs')
          .select('custom_build_job')
          .eq('tenant_id', build.tenant_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (eventsResult.error) {
    throw new Error(`Failed to load Spec Build stage events: ${eventsResult.error.message}`)
  }
  if (provisionResult.error) {
    throw new Error(`Failed to load Spec Build provisioning progress: ${provisionResult.error.message}`)
  }
  if (siteConfigResult.error) {
    throw new Error(`Failed to load Spec Build building progress: ${siteConfigResult.error.message}`)
  }

  const events = ((eventsResult.data ?? []) as StageEventRow[]).map((event) => ({
    id: event.id,
    eventOrder: event.event_order,
    fromStatus: event.from_status,
    toStatus: event.to_status,
    occurredAt: event.occurred_at,
    metadata: event.metadata ?? {},
  }))
  const serverTime = now.toISOString()
  const provision = provisionResult.data as {
    status: string
    attempts: number
    last_error: string | null
    created_at: string
    started_at: string | null
    finished_at: string | null
  } | null
  const rawJob = (siteConfigResult.data as { custom_build_job?: unknown } | null)
    ?.custom_build_job
  const job = isCustomBuildJob(rawJob) ? rawJob : null

  return {
    status: build.status,
    serverTime,
    updatedAt: build.updated_at,
    statusReason: build.status_reason,
    lastError: build.last_error,
    timeline: deriveSpecBuildTimeline({
      createdAt: build.created_at,
      currentStatus: build.status,
      events,
      now: serverTime,
    }),
    research: {
      completedAt: build.research_at,
      sourcesRead: build.research?.fetched?.length ?? 0,
    },
    provisioning: provision
      ? {
          status: provision.status,
          attempts: provision.attempts,
          createdAt: provision.created_at,
          startedAt: provision.started_at,
          finishedAt: provision.finished_at,
          lastError: provision.last_error,
        }
      : null,
    building: job
      ? {
          status: job.status,
          startedAt: job.started_at,
          heartbeatAt: job.heartbeat_at ?? null,
          finishedAt: job.finished_at ?? null,
          pass: job.pass ?? null,
          completedPaths: job.passes_done?.length ?? 0,
          requiredPaths: job.required_paths?.length ?? 0,
        }
      : null,
  }
}
