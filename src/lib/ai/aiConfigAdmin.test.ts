import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: () => ({ from: mocks.from }),
}))

import { AiConfigError, setAssignment, upsertProvider } from './aiConfigAdmin'
import { AI_PURPOSES, AI_PURPOSE_IDS, aiPurposesByCategory } from './purposes'

const KEY = Buffer.alloc(32, 4).toString('base64')

function stubWrites(providers: Record<string, unknown>[] = []) {
  mocks.from.mockImplementation((table: string) => {
    if (table === 'platform_ai_providers') {
      return {
        select: () => ({ order: async () => ({ data: providers, error: null }) }),
        insert: async () => ({ error: null }),
        update: () => ({ eq: async () => ({ error: null }) }),
      }
    }
    return { upsert: async () => ({ error: null }) }
  })
}

describe('upsertProvider validation', () => {
  beforeEach(() => {
    process.env.AI_CONFIG_KEY = KEY
    mocks.from.mockReset()
    stubWrites()
  })

  it('rejects a loopback base URL with an explanation of why', async () => {
    await expect(
      upsertProvider({
        slug: 'local-ollama',
        label: 'Laptop',
        kind: 'openai_compatible',
        baseUrl: 'http://localhost:11434/v1',
      })
    ).rejects.toThrow(/only reachable from the machine it runs on/)
  })

  it('rejects private network addresses for the same reason', async () => {
    for (const host of ['http://192.168.1.50:11434/v1', 'http://10.0.0.4/v1', 'http://127.0.0.1/v1']) {
      await expect(
        upsertProvider({ slug: 'lan', label: 'LAN', kind: 'openai_compatible', baseUrl: host })
      ).rejects.toThrow(AiConfigError)
    }
  })

  it('accepts a tunnelled public hostname', async () => {
    stubWrites([
      {
        id: '1',
        slug: 'workshop',
        label: 'Workshop',
        kind: 'openai_compatible',
        base_url: 'https://gpu.example.ts.net/v1',
        api_key_encrypted: null,
        api_key_hint: null,
        extra_headers: {},
        enabled: true,
        last_checked_at: null,
        last_check_ok: null,
        last_check_error: null,
      },
    ])
    const saved = await upsertProvider({
      slug: 'workshop',
      label: 'Workshop',
      kind: 'openai_compatible',
      baseUrl: 'https://gpu.example.ts.net/v1',
    })
    expect(saved.slug).toBe('workshop')
    expect(saved.hasKey).toBe(false)
  })

  it('rejects malformed slugs and unknown kinds', async () => {
    await expect(
      upsertProvider({ slug: 'Bad Slug', label: 'x', kind: 'openai' })
    ).rejects.toThrow(/Slug must be/)
    await expect(
      upsertProvider({ slug: 'fine-slug', label: 'x', kind: 'cohere' })
    ).rejects.toThrow(/Unknown provider kind/)
  })

  it('refuses to store a key when AI_CONFIG_KEY is missing', async () => {
    delete process.env.AI_CONFIG_KEY
    await expect(
      upsertProvider({ slug: 'openai-prod', label: 'OpenAI', kind: 'openai', apiKey: 'sk-x' })
    ).rejects.toThrow(/AI_CONFIG_KEY is not set/)
  })
})

describe('setAssignment validation', () => {
  beforeEach(() => {
    process.env.AI_CONFIG_KEY = KEY
    mocks.from.mockReset()
    stubWrites([
      {
        id: '1',
        slug: 'anthropic-prod',
        label: 'Anthropic',
        kind: 'anthropic',
        base_url: null,
        api_key_encrypted: null,
        api_key_hint: null,
        extra_headers: {},
        enabled: true,
        last_checked_at: null,
        last_check_ok: null,
        last_check_error: null,
      },
    ])
  })

  it('rejects an unknown purpose', async () => {
    await expect(
      setAssignment({ purpose: 'made_up', chain: [{ providerSlug: 'anthropic-prod', model: 'm' }] })
    ).rejects.toThrow(/Unknown purpose/)
  })

  it('rejects a provider that is not registered', async () => {
    await expect(
      setAssignment({ purpose: 'sitemap', chain: [{ providerSlug: 'ghost', model: 'm' }] })
    ).rejects.toThrow(/Unknown provider/)
  })

  it('rejects Anthropic for an image purpose at save time, not at build time', async () => {
    await expect(
      setAssignment({
        purpose: 'image_logo',
        chain: [{ providerSlug: 'anthropic-prod', model: 'claude-opus-5' }],
      })
    ).rejects.toThrow(/does not generate images|cannot generate images/)
  })

  it('accepts Anthropic for a text purpose', async () => {
    await expect(
      setAssignment({
        purpose: 'full_redesign_page',
        chain: [{ providerSlug: 'anthropic-prod', model: 'claude-opus-5' }],
      })
    ).resolves.toBeUndefined()
  })
})

describe('purpose registry', () => {
  it('covers both categories and has no duplicate ids', () => {
    const grouped = aiPurposesByCategory()
    expect(grouped.text.length).toBeGreaterThan(15)
    expect(grouped.image.length).toBeGreaterThan(3)
    expect(new Set(AI_PURPOSE_IDS).size).toBe(AI_PURPOSE_IDS.length)
  })

  it('gives every purpose a fallback that matches its category', () => {
    for (const id of AI_PURPOSE_IDS) {
      const def = AI_PURPOSES[id]
      expect(def.label.length).toBeGreaterThan(0)
      expect(def.description.length).toBeGreaterThan(0)
      if (def.category === 'image') {
        expect(def.fallback).toBe('image')
      } else {
        // A text purpose falling back to the image chain would be unroutable.
        expect(['full_redesign', 'surgical', 'default']).toContain(def.fallback)
      }
    }
  })

  it('names every image purpose with the image_ prefix the ImagePurpose type keys off', () => {
    for (const id of aiPurposesByCategory().image) {
      expect(id.startsWith('image_')).toBe(true)
    }
  })
})
