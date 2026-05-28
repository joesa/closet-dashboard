'use server'

import { spawn } from 'node:child_process'
import path from 'node:path'

import { revalidatePath } from 'next/cache'

import { logAdminAction, requireAdmin } from '@/lib/admin'
import { normalizeScraperControlConfig } from '@/lib/scraper-control'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

function parseTextareaList(value: string): string[] {
  return value
    .split(/\r?\n/g)
    .map((v) => v.trim())
    .filter(Boolean)
}

function parseDelimitedList(value: string): string[] {
  return value
    .split(/[\n,]/g)
    .map((v) => v.trim())
    .filter(Boolean)
}

function makeTriggerRunId(): string {
  const d = new Date()
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mi = String(d.getUTCMinutes()).padStart(2, '0')
  const ss = String(d.getUTCSeconds()).padStart(2, '0')
  const suffix = Math.random().toString(36).slice(2, 8)
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}-${suffix}`
}

export async function updateScraperConfigAction(formData: FormData) {
  const me = await requireAdmin()

  const raw = {
    proxyGatewayUrl: String(formData.get('proxyGatewayUrl') || '').trim(),
    proxyUrls: parseTextareaList(String(formData.get('proxyUrls') || '')),
    proxyHealthcheckEnabled: formData.get('proxyHealthcheckEnabled') === 'on',
    proxyHealthcheckTimeoutMs: Number.parseInt(String(formData.get('proxyHealthcheckTimeoutMs') || ''), 10),
    proxyHealthcheckMinHealthy: Number.parseInt(String(formData.get('proxyHealthcheckMinHealthy') || ''), 10),
    startUrls: parseTextareaList(String(formData.get('startUrls') || '')),
    disableWebhooks: formData.get('disableWebhooks') === 'on',
    mapsKeywords: parseDelimitedList(String(formData.get('mapsKeywords') || '')),
    targetLocations: parseTextareaList(String(formData.get('targetLocations') || '')),
    cityPool: parseTextareaList(String(formData.get('cityPool') || '')),
    autoModeEnabled: formData.get('autoModeEnabled') === 'on',
    autoCitiesPerRun: Number.parseInt(String(formData.get('autoCitiesPerRun') || ''), 10),
    autoRandomize: formData.get('autoRandomize') === 'on',
    autoAvoidDuplicates: formData.get('autoAvoidDuplicates') === 'on',
    headless: formData.get('headless') === 'on',
    maxConcurrency: Number.parseInt(String(formData.get('maxConcurrency') || ''), 10),
    maxResultsPerQuery: Number.parseInt(String(formData.get('maxResultsPerQuery') || ''), 10),
    maxRequestsPerCrawl: Number.parseInt(String(formData.get('maxRequestsPerCrawl') || ''), 10),
    webhookBatchSize: Number.parseInt(String(formData.get('webhookBatchSize') || ''), 10),
    pipelineAWebhookUrl: String(formData.get('pipelineAWebhookUrl') || '').trim(),
    pipelineBWebhookUrl: String(formData.get('pipelineBWebhookUrl') || '').trim(),
    webhookAuthHeader: String(formData.get('webhookAuthHeader') || 'Authorization').trim(),
  }

  const config = normalizeScraperControlConfig(raw)
  const note = String(formData.get('changeNote') || '').trim().slice(0, 300)

  const admin = getSupabaseAdmin()
  const { error: upsertError } = await admin.from('scraper_config').upsert(
    {
      id: 'default',
      settings: config,
      updated_by: me.id,
      updated_by_email: me.email,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )

  if (upsertError) {
    throw new Error(`Failed to save scraper config: ${upsertError.message}`)
  }

  const { error: historyError } = await admin.from('scraper_config_history').insert({
    config_id: 'default',
    settings: config,
    changed_by: me.id,
    changed_by_email: me.email,
    change_note: note || null,
  })

  if (historyError) {
    throw new Error(`Failed to save scraper config history: ${historyError.message}`)
  }

  await logAdminAction({
    actor: me,
    action: 'scraper.config_updated',
    targetType: 'scraper_config',
    targetId: 'default',
    metadata: {
      change_note: note || null,
      key_count: Object.keys(config).length,
    },
  })

  revalidatePath('/admin/scraper')
}

export async function triggerScraperRunAction(formData: FormData) {
  const me = await requireAdmin()
  const mode = String(formData.get('mode') || 'manual').trim() || 'manual'
  const note = String(formData.get('changeNote') || '').trim().slice(0, 300)

  const admin = getSupabaseAdmin()

  const requestedAt = new Date().toISOString()
  const triggerRunId = makeTriggerRunId()

  const { data: queued, error: queueError } = await admin
    .from('scraper_trigger_requests')
    .insert({
      mode,
      requested_by: me.id,
      requested_by_email: me.email,
      trigger_status: 'queued',
      payload: {
        note: note || null,
        requested_at: requestedAt,
        run_id: triggerRunId,
      },
    })
    .select('id')
    .single()
  if (queueError) {
    throw new Error(`Failed to enqueue trigger: ${queueError.message}`)
  }

  const triggerRequestId = Number(queued?.id)
  const webhookUrl = (process.env.SCRAPER_TRIGGER_WEBHOOK_URL || '').trim()
  let dispatchStatus: 'queued' | 'dispatched' | 'dispatch_failed' = 'queued'
  let dispatcher: 'webhook' | 'local_process' | 'none' = 'none'
  let dispatchError: string | null = null
  let localCwd: string | null = null

  if (webhookUrl) {
    dispatcher = 'webhook'
    try {
      const token =
        (process.env.SCRAPER_TRIGGER_WEBHOOK_TOKEN || process.env.SCRAPER_CONTROL_PLANE_TOKEN || '').trim()
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          runId: triggerRunId,
          mode,
          requestedBy: me.email,
          requestedAt: new Date().toISOString(),
          note: note || null,
        }),
      })

      if (!response.ok) {
        dispatchStatus = 'dispatch_failed'
        dispatchError = `HTTP ${response.status}`
      } else {
        dispatchStatus = 'dispatched'
      }
    } catch (error) {
      dispatchStatus = 'dispatch_failed'
      dispatchError = error instanceof Error ? error.message : String(error)
    }
  } else {
    dispatcher = 'local_process'
    if (process.env.VERCEL === '1') {
      dispatchStatus = 'dispatch_failed'
      dispatchError =
        'Local process dispatch is not available on Vercel. Set SCRAPER_TRIGGER_WEBHOOK_URL for hosted triggering.'
    } else {
      try {
        const localDir = (process.env.SCRAPER_LOCAL_DIR || '../closet-scraper').trim()
        const localCommand = (process.env.SCRAPER_LOCAL_RUN_COMMAND || 'npm run start:dev').trim()
        const cwd = path.resolve(/* turbopackIgnore: true */ process.cwd(), localDir)

        localCwd = cwd
        const child = spawn(localCommand, {
          cwd,
          env: {
            ...process.env,
            SCRAPER_TRIGGER_MODE: mode,
            SCRAPER_TRIGGERED_BY: me.email || 'admin',
            SCRAPER_TRIGGER_REQUEST_ID: String(triggerRequestId),
            SCRAPER_TRIGGER_RUN_ID: triggerRunId,
          },
          shell: true,
          detached: true,
          stdio: 'ignore',
        })
        child.unref()
        dispatchStatus = 'dispatched'
      } catch (error) {
        dispatchStatus = 'dispatch_failed'
        dispatchError = error instanceof Error ? error.message : String(error)
      }
    }
  }

  await admin
    .from('scraper_trigger_requests')
    .update({
      trigger_status: dispatchStatus,
      payload: {
        note: note || null,
        requested_at: requestedAt,
        dispatcher,
        run_id: triggerRunId,
        dispatch_status: dispatchStatus,
        dispatch_error: dispatchError,
        webhook_url: webhookUrl || null,
        local_cwd: localCwd,
      },
    })
    .eq('id', triggerRequestId)

  await admin.from('scraper_run_events').insert({
    run_id: triggerRunId,
    phase: 'trigger_requested',
    source: 'dashboard',
    payload: {
      run_id: triggerRunId,
      mode,
      requested_by: me.email,
      note: note || null,
      trigger_request_id: triggerRequestId,
      dispatcher,
      dispatch_status: dispatchStatus,
      dispatch_error: dispatchError,
      local_cwd: localCwd,
    },
  })

  await logAdminAction({
    actor: me,
    action: 'scraper.trigger_requested',
    targetType: 'scraper_control_plane',
    targetId: 'default',
    metadata: {
      run_id: triggerRunId,
      mode,
      trigger_request_id: triggerRequestId,
      dispatcher,
      dispatch_status: dispatchStatus,
      dispatch_error: dispatchError,
      local_cwd: localCwd,
      change_note: note || null,
    },
  })

  revalidatePath('/admin/scraper')
}
