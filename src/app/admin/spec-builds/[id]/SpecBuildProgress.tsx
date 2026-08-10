'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Check,
  Circle,
  Clock3,
  LoaderCircle,
  Pause,
} from 'lucide-react'

import type {
  SpecBuildProgressResponse,
  SpecBuildProgressStage,
  SpecBuildStageState,
} from '@/lib/spec/specBuildProgress'

const ACTIVE_STATUSES = new Set([
  'queued',
  'researching',
  'drafting',
  'imaging',
  'provisioning',
  'building',
])

const STAGE_LABELS: Record<SpecBuildProgressStage, string> = {
  queued: 'Queued',
  researching: 'Research',
  drafting: 'Draft',
  imaging: 'Images',
  provisioning: 'Provision',
  building: 'Build',
  ready_for_review: 'Ready',
}

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

function stageIcon(state: SpecBuildStageState) {
  if (state === 'completed') return <Check className="h-4 w-4" aria-hidden="true" />
  if (state === 'current') return <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
  if (state === 'paused') return <Pause className="h-4 w-4" aria-hidden="true" />
  return <Circle className="h-3.5 w-3.5" aria-hidden="true" />
}

function stageColors(state: SpecBuildStageState): string {
  if (state === 'completed') return 'border-emerald-600 bg-emerald-600 text-white'
  if (state === 'current') return 'border-blue-600 bg-blue-600 text-white'
  if (state === 'paused') return 'border-amber-500 bg-amber-50 text-amber-700'
  return 'border-gray-300 bg-white text-gray-400'
}

export default function SpecBuildProgress({
  buildId,
  initialProgress,
}: {
  buildId: string
  initialProgress: SpecBuildProgressResponse
}) {
  const router = useRouter()
  const [progress, setProgress] = useState(initialProgress)
  const [now, setNow] = useState(() => Date.parse(initialProgress.serverTime))
  const [pollError, setPollError] = useState<string | null>(null)
  const statusRef = useRef(initialProgress.status)
  const requestRef = useRef<AbortController | null>(null)

  const refresh = useCallback(async () => {
    if (requestRef.current) return
    const controller = new AbortController()
    requestRef.current = controller
    try {
      const response = await fetch(`/api/admin/spec-builds/${buildId}/progress`, {
        cache: 'no-store',
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`Progress refresh failed (${response.status})`)
      const next = (await response.json()) as SpecBuildProgressResponse
      const statusChanged = statusRef.current !== next.status
      statusRef.current = next.status
      setProgress(next)
      setPollError(null)
      if (statusChanged) router.refresh()
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      setPollError(error instanceof Error ? error.message : 'Progress refresh failed')
    } finally {
      if (requestRef.current === controller) requestRef.current = null
    }
  }, [buildId, router])

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(clock)
  }, [])

  useEffect(() => {
    if (!ACTIVE_STATUSES.has(progress.status)) return

    let poll: number | null = null
    const start = () => {
      if (document.visibilityState !== 'visible' || poll !== null) return
      void refresh()
      poll = window.setInterval(() => void refresh(), 4000)
    }
    const stop = () => {
      if (poll !== null) window.clearInterval(poll)
      poll = null
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') start()
      else stop()
    }

    start()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', start)
    return () => {
      stop()
      requestRef.current?.abort()
      requestRef.current = null
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', start)
    }
  }, [progress.status, refresh])

  const snapshotAge = Math.max(0, now - Date.parse(progress.serverTime))
  const queueWait = progress.timeline.queueWaitMs +
    (progress.status === 'queued' ? snapshotAge : 0)
  const activeProcessing = progress.timeline.activeProcessingMs +
    (progress.timeline.currentStageStartedAt && progress.status !== 'queued' ? snapshotAge : 0)
  const currentElapsed = progress.timeline.currentStageStartedAt
    ? Math.max(0, now - Date.parse(progress.timeline.currentStageStartedAt))
    : null
  const freshnessAt = progress.status === 'building' && progress.building?.heartbeatAt
    ? progress.building.heartbeatAt
    : progress.updatedAt
  const lastUpdateAge = Math.max(0, now - Date.parse(freshnessAt))

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5" aria-label="Build progress">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Build progress
          </h2>
          <p className="mt-1 text-sm text-gray-700" role="status" aria-live="polite">
            {currentElapsed !== null
              ? `${STAGE_LABELS[progress.status as SpecBuildProgressStage]} for ${formatDuration(currentElapsed)}`
              : progress.status === 'needs_attention'
                ? `Paused after ${progress.timeline.pausedFromStage ? STAGE_LABELS[progress.timeline.pausedFromStage] : 'the last step'}`
                : progress.status === 'ready_for_review'
                  ? 'Build complete and waiting for review'
                  : progress.status.replace(/_/g, ' ')}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
          {progress.status === 'building' && progress.building?.heartbeatAt ? 'Heartbeat' : 'Updated'}{' '}
          {formatDuration(lastUpdateAge)} ago
        </div>
      </div>

      <ol className="mt-6 grid gap-3 md:grid-cols-7">
        {progress.timeline.stages.map((stage, index) => (
          <li key={stage.stage} className="relative flex items-center gap-3 md:block md:text-center">
            {index > 0 && (
              <span
                className={`absolute -left-3 top-5 hidden h-px w-3 md:block ${
                  stage.state === 'completed' || stage.state === 'current'
                    ? 'bg-emerald-500'
                    : 'bg-gray-200'
                }`}
                aria-hidden="true"
              />
            )}
            <span
              className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${stageColors(stage.state)}`}
              aria-hidden="true"
            >
              {stageIcon(stage.state)}
            </span>
            <div className="min-w-0 md:mt-2">
              <span className="block text-xs font-medium text-gray-800">
                {STAGE_LABELS[stage.stage]}
              </span>
              {stage.attempts > 1 && (
                <span className="block text-[11px] text-gray-500">Attempt {stage.attempts}</span>
              )}
              <span className="sr-only">{stage.state}</span>
            </div>
          </li>
        ))}
      </ol>

      <dl className="mt-6 grid gap-4 border-t border-gray-100 pt-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Queue wait</dt>
          <dd className="mt-1 font-mono text-lg text-gray-900">{formatDuration(queueWait)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Active processing</dt>
          <dd className="mt-1 font-mono text-lg text-gray-900">{formatDuration(activeProcessing)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Current detail</dt>
          <dd className="mt-1 text-sm text-gray-700">{currentDetail(progress)}</dd>
        </div>
      </dl>

      {progress.timeline.partialHistory && (
        <p className="mt-4 text-xs text-gray-500">
          Timing is exact from when progress tracking was enabled. Earlier stage timing is unavailable.
        </p>
      )}
      {pollError && (
        <p className="mt-4 flex items-center gap-2 text-xs text-amber-700" role="alert">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          Live refresh is temporarily unavailable. The last saved progress is still shown.
        </p>
      )}
    </section>
  )
}

function currentDetail(progress: SpecBuildProgressResponse): string {
  if (progress.status === 'researching') {
    return progress.research.sourcesRead > 0
      ? `${progress.research.sourcesRead} source${progress.research.sourcesRead === 1 ? '' : 's'} read`
      : 'Checking public sources'
  }
  if (progress.status === 'provisioning' && progress.provisioning) {
    return `${progress.provisioning.status} · ${progress.provisioning.attempts} attempt${progress.provisioning.attempts === 1 ? '' : 's'}`
  }
  if (progress.status === 'building' && progress.building) {
    const paths = progress.building.requiredPaths > 0
      ? ` · ${progress.building.completedPaths}/${progress.building.requiredPaths} pages`
      : ''
    return `${progress.building.pass || progress.building.status}${paths}`
  }
  if (progress.status === 'needs_attention') {
    return progress.statusReason || progress.lastError || 'Waiting for attention'
  }
  return progress.status === 'ready_for_review' ? 'Ready for admin review' : 'Working automatically'
}
