import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { decryptSecret } from '@/lib/crypto/secretBox'
import type { AiProviderKind } from '@/lib/ai/modelRouting'

/**
 * Live reachability check for a configured provider.
 *
 * Worth its own module because a local endpoint fails in ways a hosted one
 * does not — wrong port, tunnel down, model not pulled, no images support —
 * and "the redesign produced nothing four hours later" is a terrible way to
 * discover any of them.
 *
 * Server-only.
 */

export type ProviderTestResult = {
  ok: boolean
  /** Model ids the endpoint reports, when it can list them. */
  models?: string[]
  error?: string
  latencyMs: number
}

const TEST_TIMEOUT_MS = 20_000

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/ECONNREFUSED/i.test(msg)) {
    return `Connection refused. The endpoint is not listening, or the tunnel is down. ${msg}`
  }
  if (/ENOTFOUND|EAI_AGAIN/i.test(msg)) {
    return `Host not found. Check the base URL hostname. ${msg}`
  }
  if (/certificate|self-signed|SSL/i.test(msg)) {
    return `TLS failed. A tunnel with a self-signed certificate will not work from Vercel. ${msg}`
  }
  if (/timeout|aborted/i.test(msg)) {
    return `Timed out after ${TEST_TIMEOUT_MS / 1000}s. A cold local model can exceed this even when it is working. ${msg}`
  }
  if (/401|403|unauthor|invalid.*key/i.test(msg)) {
    return `Rejected the credentials. ${msg}`
  }
  if (/404/.test(msg)) {
    return `Endpoint returned 404. For OpenAI-compatible runtimes the base URL usually has to end in /v1. ${msg}`
  }
  return msg
}

async function testOpenAiCompatible(opts: {
  apiKey: string | null
  baseUrl: string | null
  headers: Record<string, string>
}): Promise<string[]> {
  const client = new OpenAI({
    apiKey: opts.apiKey ?? (opts.baseUrl ? 'not-required' : (process.env.OPENAI_API_KEY ?? '')),
    ...(opts.baseUrl ? { baseURL: opts.baseUrl } : {}),
    ...(Object.keys(opts.headers).length ? { defaultHeaders: opts.headers } : {}),
    timeout: TEST_TIMEOUT_MS,
  })
  // Listing models costs nothing and works on OpenAI, Ollama, LM Studio and
  // vLLM alike, so it is a better probe than a token of generation.
  const list = await client.models.list()
  return list.data.map((m) => m.id).slice(0, 50)
}

async function testAnthropic(apiKey: string | null, baseUrl: string | null): Promise<string[]> {
  const client = new Anthropic({
    apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY ?? '',
    ...(baseUrl ? { baseURL: baseUrl } : {}),
    timeout: TEST_TIMEOUT_MS,
  })
  const list = await client.models.list()
  return list.data.map((m) => m.id).slice(0, 50)
}

async function testGemini(apiKey: string | null, baseUrl: string | null): Promise<string[]> {
  const key = apiKey ?? process.env.GEMINI_API_KEY
  if (!key) throw new Error('No API key stored and GEMINI_API_KEY is not set')
  const root = baseUrl?.replace(/\/$/, '') || 'https://generativelanguage.googleapis.com'
  const res = await fetch(`${root}/v1beta/models?key=${encodeURIComponent(key)}`, {
    signal: AbortSignal.timeout(TEST_TIMEOUT_MS),
  })
  if (!res.ok) {
    throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`)
  }
  const payload = (await res.json()) as { models?: { name?: string }[] }
  return (payload.models ?? [])
    .map((m) => (m.name ?? '').replace(/^models\//, ''))
    .filter(Boolean)
    .slice(0, 50)
}

/** Test a stored provider by id. Never throws — the result is the report. */
export async function testProviderEndpointById(id: string): Promise<ProviderTestResult> {
  const startedAt = Date.now()
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('platform_ai_providers')
      .select('slug, kind, base_url, api_key_encrypted, extra_headers')
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw new Error('Provider not found')

    const kind = data.kind as AiProviderKind
    const baseUrl = (data.base_url as string | null)?.trim() || null
    const headers = (data.extra_headers as Record<string, string> | null) ?? {}
    const apiKey = data.api_key_encrypted
      ? decryptSecret(data.api_key_encrypted as string)
      : null

    const models =
      kind === 'anthropic'
        ? await testAnthropic(apiKey, baseUrl)
        : kind === 'gemini'
          ? await testGemini(apiKey, baseUrl)
          : await testOpenAiCompatible({ apiKey, baseUrl, headers })

    return { ok: true, models, latencyMs: Date.now() - startedAt }
  } catch (err) {
    return { ok: false, error: friendlyError(err), latencyMs: Date.now() - startedAt }
  }
}
