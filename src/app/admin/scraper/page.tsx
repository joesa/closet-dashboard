import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { listToTextarea, normalizeScraperControlConfig } from '@/lib/scraper-control'

import AutoRefresh from './AutoRefresh'
import ScraperGeoHelper from './ScraperGeoHelper'
import ScraperInsightsPanels from './ScraperInsightsPanels'
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

type RunResultRow = {
  run_id: string
  phase: string
  lead_count: number
  selected_cities: string[] | null
  target_locations: string[] | null
  created_at: string
}

type StateCatalogRow = {
  state_code: string
  state_name: string
  cities: string[] | null
}

export default async function AdminScraperConfigPage() {
  const admin = getSupabaseAdmin()

  const [{ data: configRow }, { data: historyRows }, { data: runRows }, { data: cityRows }, { data: statRows }, { data: resultRows }, { data: stateRows }] = await Promise.all([
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
    admin
      .from('scraper_run_results')
      .select('run_id, phase, lead_count, selected_cities, target_locations, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
    admin
      .from('scraper_us_state_catalog')
      .select('state_code, state_name, cities')
      .order('state_name', { ascending: true }),
  ])

  const cfg = normalizeScraperControlConfig(configRow?.settings ?? {})
  const updatedAt = configRow?.updated_at ? new Date(configRow.updated_at).toLocaleString() : '—'
  const updatedBy = configRow?.updated_by_email || '—'

  const history = (historyRows ?? []) as ConfigHistoryRow[]
  const runEvents = (runRows ?? []) as RunEventRow[]
  const cityLedger = (cityRows ?? []) as CityLedgerRow[]
  const statsEvents = (statRows ?? []) as Array<Pick<RunEventRow, 'run_id' | 'phase' | 'created_at'>>
  const runResults = (resultRows ?? []) as RunResultRow[]
  const stateCatalog = ((stateRows ?? []) as StateCatalogRow[]).map((row) => ({
    state_code: row.state_code,
    state_name: row.state_name,
    cities: Array.isArray(row.cities) ? row.cities.map((v) => String(v || '').trim()).filter(Boolean) : [],
  }))

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
    <div className="space-y-6">
      <header className="rounded-xl border border-sky-100 bg-gradient-to-r from-white via-sky-50 to-cyan-50 p-5 shadow-sm">
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

      <section className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <a href="#scraper-config" className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
          Config
        </a>
        <a href="#scraper-trigger" className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
          Trigger
        </a>
        <a href="#scraper-events" className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
          Events
        </a>
        <a href="#scraper-results" className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
          Run Results
        </a>
        <a href="#scraper-cities" className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
          City Ledger
        </a>
      </section>

      <ScraperGeoHelper states={stateCatalog} defaultKeywords={cfg.mapsKeywords} />

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

      <form id="scraper-config" action={updateScraperConfigAction} className="scraper-control-form space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">


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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      <form id="scraper-trigger" action={triggerScraperRunAction} className="scraper-control-form rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
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

      <ScraperInsightsPanels
        history={history}
        runEvents={runEvents}
        runResults={runResults}
        cityLedger={cityLedger}
      />
    </div>
  )
}
