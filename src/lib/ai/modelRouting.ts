import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { decryptSecret, secretBoxConfigured } from '@/lib/crypto/secretBox'
import { isAiPurpose, type AiPurpose } from '@/lib/ai/purposes'

/**
 * Admin-configured model routing.
 *
 * Resolves a purpose to an ordered chain of concrete endpoints. Returns null
 * whenever nothing usable is configured, and the caller then runs the chain it
 * always ran — that null is what guarantees an empty configuration behaves
 * exactly like the code did before this existed.
 *
 * Nothing here throws into a generation path. A missing KEK, an undecryptable
 * key, a malformed chain or an unreachable database all degrade to "no
 * configuration" with a warning, because a bad admin edit must not be able to
 * stop the site builder.
 *
 * Server-only — never import in client components.
 */

/** Wire protocol of an endpoint, not the vendor brand. */
export type AiProviderKind = 'anthropic' | 'openai' | 'gemini' | 'openai_compatible'

export type AiProviderRow = {
  id: string
  slug: string
  label: string
  kind: AiProviderKind
  base_url: string | null
  api_key_encrypted: string | null
  api_key_hint: string | null
  extra_headers: Record<string, string> | null
  enabled: boolean
}

export type AiAssignmentRow = {
  purpose: string
  chain: unknown
  enabled: boolean
}

/** One usable endpoint: everything a provider call needs, already decrypted. */
export type ResolvedEndpoint = {
  providerSlug: string
  label: string
  kind: AiProviderKind
  model: string
  baseUrl: string | null
  apiKey: string | null
  headers: Record<string, string>
  maxOutputTokens?: number
}

type AiConfigSnapshot = {
  providers: Map<string, AiProviderRow>
  assignments: Map<string, AiAssignmentRow>
  version: number
  fetchedAt: number
}

/**
 * How long a snapshot is served before revalidating. A full redesign makes
 * dozens of calls, and the worker process lives for weeks, so per-call reads
 * would be a DB round trip per model call.
 */
export const AI_CONFIG_TTL_MS = 60_000

let cache: AiConfigSnapshot | null = null
let inFlight: Promise<AiConfigSnapshot | null> | null = null

/** Drop the cached snapshot. Called by admin writes in the same process. */
export function invalidateAiConfigCache(): void {
  cache = null
  inFlight = null
}

/** Test seam: install a snapshot without touching the database. */
export function __setAiConfigCacheForTests(snapshot: AiConfigSnapshot | null): void {
  cache = snapshot
  inFlight = null
}

/** PostgREST errors are plain objects, so String(err) would log "[object Object]". */
function describeError(detail: unknown): string {
  if (detail instanceof Error) return detail.message
  if (detail && typeof detail === 'object' && 'message' in detail) {
    return String((detail as { message: unknown }).message)
  }
  return String(detail)
}

function warn(message: string, detail?: unknown): void {
  const suffix = detail === undefined ? '' : `: ${describeError(detail)}`
  console.warn(`[modelRouting] ${message}${suffix}`)
}

/**
 * Current config version. One tiny row, so revalidating is cheap enough to do
 * on every TTL expiry — the expensive full fetch only happens when an admin
 * actually changed something.
 */
async function readConfigVersion(): Promise<number | null> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('platform_ai_config_version')
      .select('version')
      .maybeSingle()
    if (error) throw error
    return typeof data?.version === 'number' ? data.version : null
  } catch (err) {
    warn('could not read platform_ai_config_version', err)
    return null
  }
}

async function fetchSnapshot(version: number): Promise<AiConfigSnapshot | null> {
  try {
    const admin = getSupabaseAdmin()
    const [providersRes, assignmentsRes] = await Promise.all([
      admin
        .from('platform_ai_providers')
        .select(
          'id, slug, label, kind, base_url, api_key_encrypted, api_key_hint, extra_headers, enabled'
        )
        .eq('enabled', true),
      admin
        .from('platform_ai_purpose_assignments')
        .select('purpose, chain, enabled')
        .eq('enabled', true),
    ])
    if (providersRes.error) throw providersRes.error
    if (assignmentsRes.error) throw assignmentsRes.error

    const providers = new Map<string, AiProviderRow>()
    for (const row of (providersRes.data ?? []) as AiProviderRow[]) {
      providers.set(row.slug, row)
    }
    const assignments = new Map<string, AiAssignmentRow>()
    for (const row of (assignmentsRes.data ?? []) as AiAssignmentRow[]) {
      assignments.set(row.purpose, row)
    }

    return { providers, assignments, version, fetchedAt: Date.now() }
  } catch (err) {
    warn('could not load AI configuration — falling back to built-in chains', err)
    return null
  }
}

async function getSnapshot(): Promise<AiConfigSnapshot | null> {
  const now = Date.now()
  if (cache && now - cache.fetchedAt < AI_CONFIG_TTL_MS) return cache
  // Collapse the stampede: concurrent page passes share one refresh.
  if (inFlight) return inFlight

  inFlight = (async () => {
    const version = await readConfigVersion()
    if (version === null) {
      // Database unreachable. Keep serving the last good snapshot rather than
      // dropping every admin override because of one blip.
      if (cache) {
        cache = { ...cache, fetchedAt: Date.now() }
        return cache
      }
      return null
    }
    if (cache && cache.version === version) {
      cache = { ...cache, fetchedAt: Date.now() }
      return cache
    }
    const next = await fetchSnapshot(version)
    if (next) cache = next
    return next ?? cache
  })().finally(() => {
    inFlight = null
  })

  return inFlight
}

type ChainEntry = { provider_slug: string; model: string; max_output_tokens?: number }

/** Accepts only well-formed entries; a malformed one is skipped, not fatal. */
function parseChain(raw: unknown, purpose: string): ChainEntry[] {
  if (!Array.isArray(raw)) {
    warn(`assignment for "${purpose}" is not an array — ignoring`)
    return []
  }
  const out: ChainEntry[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const entry = item as Record<string, unknown>
    const slug = typeof entry.provider_slug === 'string' ? entry.provider_slug.trim() : ''
    const model = typeof entry.model === 'string' ? entry.model.trim() : ''
    if (!slug || !model) {
      warn(`assignment for "${purpose}" has an entry without provider_slug/model — skipping it`)
      continue
    }
    const maxTokens =
      typeof entry.max_output_tokens === 'number' && entry.max_output_tokens > 0
        ? entry.max_output_tokens
        : undefined
    out.push({ provider_slug: slug, model, max_output_tokens: maxTokens })
  }
  return out
}

/**
 * Decrypt a provider's key. Hosted vendors may legitimately have none stored
 * (the key still comes from env); local runtimes often need none at all.
 */
function resolveApiKey(row: AiProviderRow): { ok: true; key: string | null } | { ok: false } {
  if (!row.api_key_encrypted) return { ok: true, key: null }
  if (!secretBoxConfigured()) {
    warn(
      `provider "${row.slug}" has a stored key but AI_CONFIG_KEY is not set in this environment — skipping it`
    )
    return { ok: false }
  }
  try {
    return { ok: true, key: decryptSecret(row.api_key_encrypted) }
  } catch (err) {
    warn(`could not decrypt the key for provider "${row.slug}" — skipping it`, err)
    return { ok: false }
  }
}

/**
 * The endpoints configured for a purpose, in order.
 *
 * Returns null when the caller should use its built-in chain: no assignment,
 * assignment disabled, or every entry unusable (provider deleted, disabled, or
 * its key won't decrypt).
 */
export async function resolvePurposeChain(
  purpose: AiPurpose | string
): Promise<ResolvedEndpoint[] | null> {
  if (!isAiPurpose(purpose)) {
    // Not a registered purpose — nothing to configure against.
    return null
  }

  const snapshot = await getSnapshot()
  if (!snapshot) return null

  const assignment = snapshot.assignments.get(purpose)
  if (!assignment || !assignment.enabled) return null

  const entries = parseChain(assignment.chain, purpose)
  if (entries.length === 0) return null

  const resolved: ResolvedEndpoint[] = []
  for (const entry of entries) {
    const provider = snapshot.providers.get(entry.provider_slug)
    if (!provider) {
      warn(
        `purpose "${purpose}" references provider "${entry.provider_slug}", which is missing or disabled — skipping it`
      )
      continue
    }
    const key = resolveApiKey(provider)
    if (!key.ok) continue

    resolved.push({
      providerSlug: provider.slug,
      label: provider.label,
      kind: provider.kind,
      model: entry.model,
      baseUrl: provider.base_url?.trim() || null,
      apiKey: key.key,
      headers: provider.extra_headers ?? {},
      maxOutputTokens: entry.max_output_tokens,
    })
  }

  if (resolved.length === 0) {
    warn(`purpose "${purpose}" has no usable endpoints configured — using the built-in chain`)
    return null
  }
  return resolved
}

/** Whether any routing is configured at all. Used by the admin screen. */
export async function aiRoutingConfigured(): Promise<boolean> {
  const snapshot = await getSnapshot()
  return !!snapshot && snapshot.assignments.size > 0
}
