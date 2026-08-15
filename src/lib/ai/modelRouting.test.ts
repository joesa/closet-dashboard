import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { encryptSecret } from '@/lib/crypto/secretBox'

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}))

vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: () => ({ from: mocks.from }),
}))

import {
  invalidateAiConfigCache,
  resolvePurposeChain,
  type AiProviderRow,
} from './modelRouting'

const KEY = Buffer.alloc(32, 7).toString('base64')

/**
 * Minimal PostgREST stub. `ai_config_version` is read on every revalidation,
 * the other two only when the version moved.
 */
function stubTables(opts: {
  version?: number | null
  providers?: Partial<AiProviderRow>[]
  assignments?: { purpose: string; chain: unknown; enabled?: boolean }[]
  failOn?: string
}) {
  const providers = (opts.providers ?? []).map((p) => ({
    id: p.id ?? 'id',
    slug: p.slug ?? 'slug',
    label: p.label ?? 'Label',
    kind: p.kind ?? 'openai_compatible',
    base_url: p.base_url ?? null,
    api_key_encrypted: p.api_key_encrypted ?? null,
    api_key_hint: p.api_key_hint ?? null,
    extra_headers: p.extra_headers ?? {},
    enabled: p.enabled ?? true,
  }))
  const assignments = (opts.assignments ?? []).map((a) => ({
    purpose: a.purpose,
    chain: a.chain,
    enabled: a.enabled ?? true,
  }))

  mocks.from.mockImplementation((table: string) => {
    if (opts.failOn === table) {
      const err = { message: `boom on ${table}` }
      return {
        select: () => ({
          maybeSingle: async () => ({ data: null, error: err }),
          eq: async () => ({ data: null, error: err }),
        }),
      }
    }
    if (table === 'platform_ai_config_version') {
      return {
        select: () => ({
          maybeSingle: async () => ({
            data: opts.version === null ? null : { version: opts.version ?? 1 },
            error: null,
          }),
        }),
      }
    }
    if (table === 'platform_ai_providers') {
      return { select: () => ({ eq: async () => ({ data: providers, error: null }) }) }
    }
    if (table === 'platform_ai_purpose_assignments') {
      return { select: () => ({ eq: async () => ({ data: assignments, error: null }) }) }
    }
    throw new Error(`unexpected table ${table}`)
  })
}

describe('resolvePurposeChain', () => {
  const prevKey = process.env.AI_CONFIG_KEY

  beforeEach(() => {
    process.env.AI_CONFIG_KEY = KEY
    invalidateAiConfigCache()
    mocks.from.mockReset()
  })

  afterEach(() => {
    if (prevKey === undefined) delete process.env.AI_CONFIG_KEY
    else process.env.AI_CONFIG_KEY = prevKey
    invalidateAiConfigCache()
  })

  it('returns null with nothing configured, so callers keep their built-in chain', async () => {
    stubTables({})
    expect(await resolvePurposeChain('full_redesign_page')).toBeNull()
  })

  it('returns null for an unregistered purpose without touching the database', async () => {
    stubTables({})
    expect(await resolvePurposeChain('not_a_real_purpose')).toBeNull()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('resolves a configured chain in order', async () => {
    stubTables({
      providers: [
        { slug: 'ollama', kind: 'openai_compatible', base_url: 'https://gpu.example/v1' },
        { slug: 'anthropic-prod', kind: 'anthropic', api_key_encrypted: encryptSecret('sk-test') },
      ],
      assignments: [
        {
          purpose: 'full_redesign_page',
          chain: [
            { provider_slug: 'ollama', model: 'llama3.1:70b' },
            { provider_slug: 'anthropic-prod', model: 'claude-opus-5' },
          ],
        },
      ],
    })

    const chain = await resolvePurposeChain('full_redesign_page')
    expect(chain).toHaveLength(2)
    expect(chain![0]).toMatchObject({
      providerSlug: 'ollama',
      kind: 'openai_compatible',
      model: 'llama3.1:70b',
      baseUrl: 'https://gpu.example/v1',
      apiKey: null,
    })
    expect(chain![1]).toMatchObject({ kind: 'anthropic', model: 'claude-opus-5', apiKey: 'sk-test' })
  })

  it('ignores a disabled assignment', async () => {
    stubTables({
      providers: [{ slug: 'ollama' }],
      assignments: [
        { purpose: 'surgical_edit', chain: [{ provider_slug: 'ollama', model: 'm' }], enabled: false },
      ],
    })
    // The stub filters nothing, so an enabled:false row still arrives here —
    // resolution must reject it rather than trusting the query.
    expect(await resolvePurposeChain('surgical_edit')).toBeNull()
  })

  it('skips entries whose provider is missing, keeping the rest', async () => {
    stubTables({
      providers: [{ slug: 'present', kind: 'openai' }],
      assignments: [
        {
          purpose: 'admin_chat',
          chain: [
            { provider_slug: 'deleted', model: 'gone' },
            { provider_slug: 'present', model: 'gpt-5.6-sol' },
          ],
        },
      ],
    })
    const chain = await resolvePurposeChain('admin_chat')
    expect(chain).toHaveLength(1)
    expect(chain![0].providerSlug).toBe('present')
  })

  it('skips a provider whose key cannot be decrypted', async () => {
    const encrypted = encryptSecret('sk-test')
    process.env.AI_CONFIG_KEY = Buffer.alloc(32, 9).toString('base64')
    stubTables({
      providers: [{ slug: 'rotated', kind: 'openai', api_key_encrypted: encrypted }],
      assignments: [{ purpose: 'admin_chat', chain: [{ provider_slug: 'rotated', model: 'm' }] }],
    })
    expect(await resolvePurposeChain('admin_chat')).toBeNull()
  })

  it('ignores malformed chain entries', async () => {
    stubTables({
      providers: [{ slug: 'ok', kind: 'openai' }],
      assignments: [
        {
          purpose: 'sitemap',
          chain: [null, 'nope', { provider_slug: 'ok' }, { model: 'orphan' }, { provider_slug: 'ok', model: 'good' }],
        },
      ],
    })
    const chain = await resolvePurposeChain('sitemap')
    expect(chain).toHaveLength(1)
    expect(chain![0].model).toBe('good')
  })

  it('falls back to the built-in chain when the config tables are unreachable', async () => {
    stubTables({ failOn: 'platform_ai_config_version' })
    expect(await resolvePurposeChain('full_redesign_page')).toBeNull()
  })

  it('caches: a second call within the TTL does not refetch providers', async () => {
    stubTables({
      providers: [{ slug: 'ok', kind: 'openai' }],
      assignments: [{ purpose: 'sitemap', chain: [{ provider_slug: 'ok', model: 'm' }] }],
    })
    await resolvePurposeChain('sitemap')
    const callsAfterFirst = mocks.from.mock.calls.length
    await resolvePurposeChain('sitemap')
    expect(mocks.from.mock.calls.length).toBe(callsAfterFirst)
  })
})
