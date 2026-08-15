import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { encryptSecret, secretBoxConfigured, secretHint } from '@/lib/crypto/secretBox'
import { invalidateAiConfigCache, type AiProviderKind } from '@/lib/ai/modelRouting'
import { AI_PURPOSES, isAiPurpose, type AiPurpose } from '@/lib/ai/purposes'

/**
 * Admin-side CRUD for model routing.
 *
 * Reads here never return a decrypted key — the admin screen shows only
 * whether one is stored and its masked tail. Writes go through the
 * service-role client and drop the in-process resolution cache so the change
 * is visible immediately in the process that made it (others pick it up within
 * one TTL via the config version).
 *
 * Server-only — never import in client components.
 */

export const AI_PROVIDER_KINDS: readonly AiProviderKind[] = [
  'anthropic',
  'openai',
  'gemini',
  'openai_compatible',
] as const

export type AdminProvider = {
  id: string
  slug: string
  label: string
  kind: AiProviderKind
  baseUrl: string | null
  hasKey: boolean
  keyHint: string | null
  extraHeaders: Record<string, string>
  enabled: boolean
  lastCheckedAt: string | null
  lastCheckOk: boolean | null
  lastCheckError: string | null
}

export type AdminAssignment = {
  purpose: AiPurpose
  label: string
  category: 'text' | 'image'
  description: string
  /** What runs when nothing is assigned. */
  fallback: string
  chain: { providerSlug: string; model: string }[]
  enabled: boolean
  updatedAt: string | null
}

export class AiConfigError extends Error {}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/

export async function listProviders(): Promise<AdminProvider[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('platform_ai_providers')
    .select(
      'id, slug, label, kind, base_url, api_key_encrypted, api_key_hint, extra_headers, enabled, last_checked_at, last_check_ok, last_check_error'
    )
    .order('label')
  if (error) throw new AiConfigError(error.message)

  return (data ?? []).map((row) => ({
    id: row.id as string,
    slug: row.slug as string,
    label: row.label as string,
    kind: row.kind as AiProviderKind,
    baseUrl: (row.base_url as string | null) ?? null,
    // Deliberately a boolean, not the ciphertext: nothing that could be
    // decrypted elsewhere should reach a browser.
    hasKey: !!row.api_key_encrypted,
    keyHint: (row.api_key_hint as string | null) ?? null,
    extraHeaders: (row.extra_headers as Record<string, string> | null) ?? {},
    enabled: row.enabled as boolean,
    lastCheckedAt: (row.last_checked_at as string | null) ?? null,
    lastCheckOk: (row.last_check_ok as boolean | null) ?? null,
    lastCheckError: (row.last_check_error as string | null) ?? null,
  }))
}

function validateProviderInput(input: {
  slug: string
  label: string
  kind: string
  baseUrl?: string | null
}): void {
  if (!SLUG_RE.test(input.slug)) {
    throw new AiConfigError(
      'Slug must be 3-40 lowercase letters, digits or hyphens, starting and ending alphanumeric'
    )
  }
  if (!input.label.trim()) throw new AiConfigError('Label is required')
  if (!AI_PROVIDER_KINDS.includes(input.kind as AiProviderKind)) {
    throw new AiConfigError(`Unknown provider kind "${input.kind}"`)
  }

  const baseUrl = input.baseUrl?.trim()
  if (baseUrl) {
    let parsed: URL
    try {
      parsed = new URL(baseUrl)
    } catch {
      throw new AiConfigError('Base URL must be a valid absolute URL')
    }
    if (!/^https?:$/.test(parsed.protocol)) {
      throw new AiConfigError('Base URL must be http or https')
    }
    // The generation code runs on Vercel and on the worker VM. A loopback or
    // private address resolves to those hosts, not to the admin's machine, so
    // it would fail confusingly at generation time instead of here.
    if (/^(localhost|127\.|0\.0\.0\.0|\[?::1\]?|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(parsed.hostname)) {
      throw new AiConfigError(
        `"${parsed.hostname}" is only reachable from the machine it runs on. Vercel and the worker VM both need a publicly reachable URL — expose the runtime with a tunnel (Tailscale, Cloudflare Tunnel, ngrok) and use that hostname.`
      )
    }
  }
}

export async function upsertProvider(input: {
  id?: string
  slug: string
  label: string
  kind: string
  baseUrl?: string | null
  /** Plaintext; encrypted here. Undefined leaves an existing key untouched. */
  apiKey?: string | null
  extraHeaders?: Record<string, string>
  enabled?: boolean
}): Promise<AdminProvider> {
  validateProviderInput(input)

  const patch: Record<string, unknown> = {
    slug: input.slug,
    label: input.label.trim(),
    kind: input.kind,
    base_url: input.baseUrl?.trim() || null,
    extra_headers: input.extraHeaders ?? {},
    enabled: input.enabled ?? true,
    updated_at: new Date().toISOString(),
  }

  if (input.apiKey !== undefined) {
    if (input.apiKey === null || input.apiKey === '') {
      patch.api_key_encrypted = null
      patch.api_key_hint = null
    } else {
      if (!secretBoxConfigured()) {
        throw new AiConfigError(
          'AI_CONFIG_KEY is not set in this environment, so credentials cannot be stored. Generate one with `openssl rand -base64 32` and set it on Vercel and the worker VM.'
        )
      }
      patch.api_key_encrypted = encryptSecret(input.apiKey)
      patch.api_key_hint = secretHint(input.apiKey)
    }
  }

  const admin = getSupabaseAdmin()
  const query = input.id
    ? admin.from('platform_ai_providers').update(patch).eq('id', input.id)
    : admin.from('platform_ai_providers').insert(patch)

  const { error } = await query
  if (error) {
    if (/duplicate key/i.test(error.message)) {
      throw new AiConfigError(`A provider with slug "${input.slug}" already exists`)
    }
    throw new AiConfigError(error.message)
  }

  invalidateAiConfigCache()
  const all = await listProviders()
  const saved = all.find((p) => p.slug === input.slug)
  if (!saved) throw new AiConfigError('Provider saved but could not be read back')
  return saved
}

export async function deleteProvider(id: string): Promise<void> {
  const admin = getSupabaseAdmin()
  const { data: row } = await admin
    .from('platform_ai_providers')
    .select('slug')
    .eq('id', id)
    .maybeSingle()

  // Refuse to strand an assignment pointing at this provider. Resolution would
  // survive it (the entry is skipped) but the admin would be left with a
  // purpose silently running somewhere else.
  if (row?.slug) {
    const { data: assignments } = await admin
      .from('platform_ai_purpose_assignments')
      .select('purpose, chain')
    const referencing = (assignments ?? []).filter((a) =>
      Array.isArray(a.chain)
        ? (a.chain as { provider_slug?: string }[]).some((e) => e?.provider_slug === row.slug)
        : false
    )
    if (referencing.length > 0) {
      throw new AiConfigError(
        `Still used by: ${referencing.map((a) => a.purpose).join(', ')}. Reassign those purposes first.`
      )
    }
  }

  const { error } = await admin.from('platform_ai_providers').delete().eq('id', id)
  if (error) throw new AiConfigError(error.message)
  invalidateAiConfigCache()
}

export async function listAssignments(): Promise<AdminAssignment[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('platform_ai_purpose_assignments')
    .select('purpose, chain, enabled, updated_at')
  if (error) throw new AiConfigError(error.message)

  const rows = new Map<string, { chain: unknown; enabled: boolean; updated_at: string }>()
  for (const row of data ?? []) {
    rows.set(row.purpose as string, {
      chain: row.chain,
      enabled: row.enabled as boolean,
      updated_at: row.updated_at as string,
    })
  }

  return (Object.keys(AI_PURPOSES) as AiPurpose[]).map((purpose) => {
    const def = AI_PURPOSES[purpose]
    const row = rows.get(purpose)
    const chain = Array.isArray(row?.chain)
      ? (row!.chain as { provider_slug?: string; model?: string }[])
          .filter((e) => e?.provider_slug && e?.model)
          .map((e) => ({ providerSlug: e.provider_slug!, model: e.model! }))
      : []
    return {
      purpose,
      label: def.label,
      category: def.category,
      description: def.description,
      fallback: def.fallback,
      chain,
      enabled: row?.enabled ?? true,
      updatedAt: row?.updated_at ?? null,
    }
  })
}

export async function setAssignment(input: {
  purpose: string
  chain: { providerSlug: string; model: string }[]
  enabled?: boolean
  updatedBy?: string | null
}): Promise<void> {
  if (!isAiPurpose(input.purpose)) {
    throw new AiConfigError(`Unknown purpose "${input.purpose}"`)
  }

  const providers = await listProviders()
  const bySlug = new Map(providers.map((p) => [p.slug, p]))
  for (const entry of input.chain) {
    const provider = bySlug.get(entry.providerSlug)
    if (!provider) {
      throw new AiConfigError(`Unknown provider "${entry.providerSlug}"`)
    }
    if (!entry.model.trim()) {
      throw new AiConfigError(`Pick a model for "${entry.providerSlug}"`)
    }
    // Caught here rather than at generation time, where it would surface as a
    // failed build hours later.
    if (AI_PURPOSES[input.purpose].category === 'image' && provider.kind === 'anthropic') {
      throw new AiConfigError(
        `${provider.label} (Anthropic) cannot generate images — pick an OpenAI-compatible or Gemini provider for "${AI_PURPOSES[input.purpose].label}".`
      )
    }
  }

  const { error } = await getSupabaseAdmin()
    .from('platform_ai_purpose_assignments')
    .upsert(
      {
        purpose: input.purpose,
        chain: input.chain.map((e) => ({ provider_slug: e.providerSlug, model: e.model.trim() })),
        enabled: input.enabled ?? true,
        updated_by: input.updatedBy ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'purpose' }
    )
  if (error) throw new AiConfigError(error.message)
  invalidateAiConfigCache()
}

/** Clear an assignment so the purpose returns to its built-in chain. */
export async function clearAssignment(purpose: string): Promise<void> {
  if (!isAiPurpose(purpose)) throw new AiConfigError(`Unknown purpose "${purpose}"`)
  const { error } = await getSupabaseAdmin()
    .from('platform_ai_purpose_assignments')
    .delete()
    .eq('purpose', purpose)
  if (error) throw new AiConfigError(error.message)
  invalidateAiConfigCache()
}

export async function recordProviderCheck(
  id: string,
  result: { ok: boolean; error?: string | null }
): Promise<void> {
  await getSupabaseAdmin()
    .from('platform_ai_providers')
    .update({
      last_checked_at: new Date().toISOString(),
      last_check_ok: result.ok,
      last_check_error: result.error?.slice(0, 500) ?? null,
    })
    .eq('id', id)
  invalidateAiConfigCache()
}
