import { extractBearerOrHeaderToken as extractToken } from '@/lib/webhook-auth'

export type ScraperControlConfig = {
  startUrls: string[]
  disableWebhooks: boolean
  mapsKeywords: string[]
  targetLocations: string[]
  cityPool: string[]
  autoModeEnabled: boolean
  autoCitiesPerRun: number
  autoRandomize: boolean
  autoAvoidDuplicates: boolean
  headless: boolean
  maxConcurrency: number
  maxResultsPerQuery: number
  maxRequestsPerCrawl: number
  webhookBatchSize: number
  pipelineAWebhookUrl: string
  pipelineBWebhookUrl: string
  webhookAuthHeader: string
  suppressionEmails: string[]
  suppressionDomains: string[]
  enableOmniFallback: boolean
  enableLumpyMailExport: boolean
}

const DEFAULT_CONFIG: ScraperControlConfig = {
  startUrls: [],
  disableWebhooks: true,
  mapsKeywords: ['custom closets', 'closet organizers', 'closet design'],
  targetLocations: ['Nashville TN'],
  cityPool: [],
  autoModeEnabled: false,
  autoCitiesPerRun: 5,
  autoRandomize: true,
  autoAvoidDuplicates: true,
  headless: true,
  maxConcurrency: 2,
  maxResultsPerQuery: 25,
  maxRequestsPerCrawl: 200,
  webhookBatchSize: 50,
  pipelineAWebhookUrl: '',
  pipelineBWebhookUrl: '',
  webhookAuthHeader: 'Authorization',
  suppressionEmails: [],
  suppressionDomains: [],
  enableOmniFallback: true,
  enableLumpyMailExport: true,
}

function asStringArray(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) {
    return value
      .map((v) => String(v || '').trim())
      .filter(Boolean)
  }
  if (typeof value === 'string') {
    return value
      .split(/\r?\n/g)
      .map((v) => v.trim())
      .filter(Boolean)
  }
  return []
}

function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const n = value.trim().toLowerCase()
    if (['1', 'true', 'yes', 'on'].includes(n)) return true
    if (['0', 'false', 'no', 'off'].includes(n)) return false
  }
  return fallback
}

function asInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function asString(value: unknown, fallback: string): string {
  const s = String(value ?? '').trim()
  return s || fallback
}

export function normalizeScraperControlConfig(input: unknown): ScraperControlConfig {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>

  return {
    startUrls: asStringArray(raw.startUrls),
    disableWebhooks: asBool(raw.disableWebhooks, DEFAULT_CONFIG.disableWebhooks),
    mapsKeywords: asStringArray(raw.mapsKeywords).length
      ? asStringArray(raw.mapsKeywords)
      : DEFAULT_CONFIG.mapsKeywords,
    targetLocations: asStringArray(raw.targetLocations).length
      ? asStringArray(raw.targetLocations)
      : DEFAULT_CONFIG.targetLocations,
    cityPool: asStringArray(raw.cityPool),
    autoModeEnabled: asBool(raw.autoModeEnabled, DEFAULT_CONFIG.autoModeEnabled),
    autoCitiesPerRun: asInt(raw.autoCitiesPerRun, DEFAULT_CONFIG.autoCitiesPerRun, 1, 50),
    autoRandomize: asBool(raw.autoRandomize, DEFAULT_CONFIG.autoRandomize),
    autoAvoidDuplicates: asBool(raw.autoAvoidDuplicates, DEFAULT_CONFIG.autoAvoidDuplicates),
    headless: asBool(raw.headless, DEFAULT_CONFIG.headless),
    maxConcurrency: asInt(raw.maxConcurrency, DEFAULT_CONFIG.maxConcurrency, 1, 20),
    maxResultsPerQuery: asInt(raw.maxResultsPerQuery, DEFAULT_CONFIG.maxResultsPerQuery, 1, 500),
    maxRequestsPerCrawl: asInt(raw.maxRequestsPerCrawl, DEFAULT_CONFIG.maxRequestsPerCrawl, 1, 5000),
    webhookBatchSize: asInt(raw.webhookBatchSize, DEFAULT_CONFIG.webhookBatchSize, 1, 500),
    pipelineAWebhookUrl: asString(raw.pipelineAWebhookUrl, ''),
    pipelineBWebhookUrl: asString(raw.pipelineBWebhookUrl, ''),
    webhookAuthHeader: asString(raw.webhookAuthHeader, DEFAULT_CONFIG.webhookAuthHeader),
    suppressionEmails: asStringArray(raw.suppressionEmails),
    suppressionDomains: asStringArray(raw.suppressionDomains),
    enableOmniFallback: asBool(raw.enableOmniFallback, DEFAULT_CONFIG.enableOmniFallback),
    enableLumpyMailExport: asBool(raw.enableLumpyMailExport, DEFAULT_CONFIG.enableLumpyMailExport),
  }
}

export function listToTextarea(value: string[]): string {
  return value.join('\n')
}

export function extractBearerOrHeaderToken(req: Request): string {
  return extractToken(req, ['x-scraper-token', 'x-api-key'])
}
