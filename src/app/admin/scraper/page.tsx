import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { listToTextarea, normalizeScraperControlConfig } from '@/lib/scraper-control'

import AutoRefresh from './AutoRefresh'
import { triggerScraperRunAction, updateScraperConfigAction } from './actions'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type ConfigHistoryRow = {
  id: number
  changed_by_email: string | null
  change_note: string | null
  created_at: string
}

type RunEventRow = {
  id: number
  run_id: string | null
  phase: string
  created_at: string
  payload: Record<string, unknown> | null
}

type CityLedgerRow = {
  city_key: string
  city_label: string
  run_count: number
  last_scraped_at: string
  last_run_id: string | null
}

type RunStatusSummary = {
  successful: number
  failed: number
  running: number
}

type LatestRunStatus = {
  runId: string
  phase: string
  createdAt: string
}

function payloadText(payload: Record<string, unknown> | null, key: string): string {
  if (!payload) return '—'
  const value = payload[key]
  if (typeof value === 'string') return value.trim() || '—'
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return '—'
}

export default async function AdminScraperConfigPage() {
  const admin = getSupabaseAdmin()

  const [{ data: configRow }, { data: historyRows }, { data: runRows }, { data: cityRows }, { data: statRows }] = await Promise.all([
    admin
      .from('scraper_config')
      .select('settings, updated_at, updated_by_email')
      .eq('id', 'default')
      .maybeSingle(),
    admin
      .from('scraper_config_history')
      .select('id, changed_by_email, change_note, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
    admin
      .from('scraper_run_events')
      .select('id, run_id, phase, created_at, payload')
      .order('created_at', { ascending: false })
      .limit(20),
    admin
      .from('scraper_city_ledger')
      .select('city_key, city_label, run_count, last_scraped_at, last_run_id')
      .order('last_scraped_at', { ascending: false })
      .limit(30),
    admin
      .from('scraper_run_events')
      .select('run_id, phase, created_at')
      .not('run_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500),
  ])

  const cfg = normalizeScraperControlConfig(configRow?.settings ?? {})
  const updatedAt = configRow?.updated_at ? new Date(configRow.updated_at).toLocaleString() : '—'
  const updatedBy = configRow?.updated_by_email || '—'

  const history = (historyRows ?? []) as ConfigHistoryRow[]
  const runEvents = (runRows ?? []) as RunEventRow[]
  const cityLedger = (cityRows ?? []) as CityLedgerRow[]
  const statsEvents = (statRows ?? []) as Array<Pick<RunEventRow, 'run_id' | 'phase' | 'created_at'>>

  const latestByRun = new Map<string, { phase: string; created_at: string }>()
  for (const event of statsEvents) {
    const runId = event.run_id
    if (!runId) continue
    if (!latestByRun.has(runId)) {
      latestByRun.set(runId, { phase: event.phase, created_at: event.created_at })
    }
  }

  const runStats: RunStatusSummary = { successful: 0, failed: 0, running: 0 }
  for (const run of latestByRun.values()) {
    if (run.phase === 'completed') {
      runStats.successful += 1
    } else if (run.phase === 'failed') {
      runStats.failed += 1
    } else if (run.phase === 'started' || run.phase === 'trigger_requested') {
      runStats.running += 1
    }
  }

  let latestRunStatus: LatestRunStatus | null = null
  for (const event of runEvents) {
    if (!event.run_id) continue
    latestRunStatus = {
      runId: event.run_id,
      phase: event.phase,
      createdAt: event.created_at,
    }
    break
  }

  const isLatestRunDone = latestRunStatus ? ['completed', 'failed'].includes(latestRunStatus.phase) : false

  const mostRecentEventAt = runEvents[0]?.created_at ? new Date(runEvents[0].created_at).toLocaleTimeString() : '—'

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">Scraper Control Plane</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage runtime scraper settings used by the secure config endpoint consumed at startup.
        </p>
        <p className="mt-2 text-xs text-gray-500">
          Last updated: {updatedAt} by {updatedBy}
        </p>
        <div className="mt-2">
          <AutoRefresh intervalMs={5000} />
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Successful Runs</div>
          <div className="mt-1 text-2xl font-semibold text-emerald-900">{runStats.successful}</div>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-red-700">Failed Runs</div>
          <div className="mt-1 text-2xl font-semibold text-red-900">{runStats.failed}</div>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">Running Now</div>
          <div className="mt-1 text-2xl font-semibold text-blue-900">{runStats.running}</div>
          <div className="mt-1 text-xs text-blue-700">Last event: {mostRecentEventAt}</div>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Latest Run Status</h2>
        {latestRunStatus ? (
          <div className="mt-2 space-y-1 text-sm text-gray-700">
            <div>
              phase: <span className="font-mono">{latestRunStatus.phase}</span>
            </div>
            <div>
              run_id: <span className="font-mono">{latestRunStatus.runId}</span>
            </div>
            <div>updated: {new Date(latestRunStatus.createdAt).toLocaleString()}</div>
            <div className={isLatestRunDone ? 'text-emerald-700' : 'text-amber-700'}>
              {isLatestRunDone ? 'Done: run reached terminal phase.' : 'In progress: waiting for completed or failed.'}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-500">No run with run_id has been recorded yet.</p>
        )}
      </section>

      <form action={updateScraperConfigAction} className="scraper-control-form space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm md:col-span-2">
            <span className="font-medium text-gray-800">Proxy Gateway URL</span>
            <input
              name="proxyGatewayUrl"
              defaultValue={cfg.proxyGatewayUrl}
              placeholder="http://user:pass@gateway.webshare.io:80"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-gray-500">
              If set, scraper uses this single stable gateway and ignores proxy URL list.
            </span>
          </label>

          <label className="block text-sm md:col-span-2">
            <span className="font-medium text-gray-800">Proxy URL List</span>
            <textarea
              name="proxyUrls"
              defaultValue={listToTextarea(cfg.proxyUrls)}
              rows={4}
              placeholder="One proxy URL per line"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs"
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-gray-800">Start URLs</span>
            <textarea
              name="startUrls"
              defaultValue={listToTextarea(cfg.startUrls)}
              rows={4}
              placeholder="One URL per line"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-gray-800">Maps Keywords</span>
            <textarea
              name="mapsKeywords"
              defaultValue={cfg.mapsKeywords.join(', ')}
              rows={4}
              placeholder="custom closets, closet organizers"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm md:col-span-2">
            <span className="font-medium text-gray-800">Target Locations</span>
            <textarea
              name="targetLocations"
              defaultValue={listToTextarea(cfg.targetLocations)}
              rows={4}
              placeholder="One city per line"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm md:col-span-2">
            <span className="font-medium text-gray-800">City Pool (Auto Mode Source)</span>
            <textarea
              name="cityPool"
              defaultValue={listToTextarea(cfg.cityPool)}
              rows={4}
              placeholder="One city per line, e.g. Nashville TN"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">
            <span className="font-medium text-gray-800">Proxy Health Timeout (ms)</span>
            <input
              name="proxyHealthcheckTimeoutMs"
              type="number"
              min={250}
              max={20000}
              defaultValue={cfg.proxyHealthcheckTimeoutMs}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-gray-800">Min Healthy Proxies</span>
            <input
              name="proxyHealthcheckMinHealthy"
              type="number"
              min={1}
              max={1000}
              defaultValue={cfg.proxyHealthcheckMinHealthy}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-gray-800">Max Concurrency</span>
            <input
              name="maxConcurrency"
              type="number"
              min={1}
              max={20}
              defaultValue={cfg.maxConcurrency}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-gray-800">Max Results/Query</span>
            <input
              name="maxResultsPerQuery"
              type="number"
              min={1}
              max={500}
              defaultValue={cfg.maxResultsPerQuery}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-gray-800">Max Requests/Crawl</span>
            <input
              name="maxRequestsPerCrawl"
              type="number"
              min={1}
              max={5000}
              defaultValue={cfg.maxRequestsPerCrawl}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-gray-800">Webhook Batch Size</span>
            <input
              name="webhookBatchSize"
              type="number"
              min={1}
              max={500}
              defaultValue={cfg.webhookBatchSize}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-gray-800">Auto Cities Per Run</span>
            <input
              name="autoCitiesPerRun"
              type="number"
              min={1}
              max={50}
              defaultValue={cfg.autoCitiesPerRun}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-gray-800">Pipeline A Webhook URL</span>
            <input
              name="pipelineAWebhookUrl"
              defaultValue={cfg.pipelineAWebhookUrl}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-gray-800">Pipeline B Webhook URL</span>
            <input
              name="pipelineBWebhookUrl"
              defaultValue={cfg.pipelineBWebhookUrl}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-gray-800">Webhook Auth Header</span>
            <input
              name="webhookAuthHeader"
              defaultValue={cfg.webhookAuthHeader}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-sm">
            <span className="font-medium text-gray-800">Change Note</span>
            <input
              name="changeNote"
              placeholder="Why this update?"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-5 text-sm">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" name="autoModeEnabled" defaultChecked={cfg.autoModeEnabled} />
            Auto run mode (city pool)
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" name="autoRandomize" defaultChecked={cfg.autoRandomize} />
            Randomize city selection
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" name="autoAvoidDuplicates" defaultChecked={cfg.autoAvoidDuplicates} />
            Skip cities already scraped
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" name="proxyHealthcheckEnabled" defaultChecked={cfg.proxyHealthcheckEnabled} />
            Proxy health check at startup
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" name="disableWebhooks" defaultChecked={cfg.disableWebhooks} />
            Disable webhooks
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" name="headless" defaultChecked={cfg.headless} />
            Headless mode
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Save Scraper Config
          </button>
          <span className="text-xs text-gray-500">
            Secrets stay in env vars when preferred: WEBHOOK_AUTH_TOKEN, SCRAPER_CONTROL_PLANE_TOKEN.
          </span>
        </div>
      </form>

      <form action={triggerScraperRunAction} className="scraper-control-form rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="mode" value={cfg.autoModeEnabled ? 'auto' : 'manual'} />
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            Trigger Scraper Run Now
          </button>
          <p className="text-xs text-gray-600">
            Queues a manual trigger request. If SCRAPER_TRIGGER_WEBHOOK_URL is configured, dashboard dispatches to that
            webhook. If not configured, dashboard starts the local scraper process (testing mode).
          </p>
        </div>
      </form>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Recent Config Changes</h2>
          <ul className="mt-3 divide-y divide-gray-100 text-sm">
            {history.length === 0 ? (
              <li className="py-2 text-gray-500">No changes yet.</li>
            ) : (
              history.map((row) => (
                <li key={row.id} className="py-2">
                  <div className="text-gray-800">{row.changed_by_email ?? '—'}</div>
                  <div className="text-xs text-gray-500">{new Date(row.created_at).toLocaleString()}</div>
                  <div className="text-xs text-gray-600">{row.change_note || '—'}</div>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Recent Scraper Run Events</h2>
          <ul className="mt-3 divide-y divide-gray-100 text-sm">
            {runEvents.length === 0 ? (
              <li className="py-2 text-gray-500">No run events yet.</li>
            ) : (
              runEvents.map((row) => (
                <li key={row.id} className="py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-gray-800">{row.phase}</span>
                    {row.phase === 'trigger_requested' ? (
                      <>
                        <span className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 font-mono text-[11px] text-blue-700">
                          via: {payloadText(row.payload, 'dispatcher')}
                        </span>
                        <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-700">
                          dispatch: {payloadText(row.payload, 'dispatch_status')}
                        </span>
                      </>
                    ) : null}
                    {row.phase === 'failed' ? (
                      <>
                        <span className="rounded border border-red-200 bg-red-50 px-2 py-0.5 font-mono text-[11px] text-red-700">
                          class: {payloadText(row.payload, 'errorClass')}
                        </span>
                        <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 font-mono text-[11px] text-amber-700">
                          code: {payloadText(row.payload, 'errorCode')}
                        </span>
                      </>
                    ) : null}
                  </div>
                  <div className="text-xs text-gray-600">run_id: {row.run_id || '—'}</div>
                  {row.phase === 'trigger_requested' ? (
                    <>
                      <div className="text-xs text-gray-600">trigger_request_id: {payloadText(row.payload, 'trigger_request_id')}</div>
                      <div className="text-xs text-gray-600">dispatch_error: {payloadText(row.payload, 'dispatch_error')}</div>
                    </>
                  ) : null}
                  <div className="text-xs text-gray-500">{new Date(row.created_at).toLocaleString()}</div>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-900">Cities Already Scraped (Dedupe Ledger)</h2>
          <ul className="mt-3 divide-y divide-gray-100 text-sm">
            {cityLedger.length === 0 ? (
              <li className="py-2 text-gray-500">No cities tracked yet.</li>
            ) : (
              cityLedger.map((row) => (
                <li key={row.city_key} className="py-2">
                  <div className="font-medium text-gray-800">{row.city_label}</div>
                  <div className="text-xs text-gray-600">runs: {row.run_count} | last_run_id: {row.last_run_id || '—'}</div>
                  <div className="text-xs text-gray-500">last scraped: {new Date(row.last_scraped_at).toLocaleString()}</div>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </div>
  )
}
