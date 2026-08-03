import { readFileSync } from 'fs'
import { join } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildTenantPreviewUrlFromDomains } from '@/lib/admin-preview'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { revalidateTenantSiteCache } from '@/lib/tenants/revalidateTenantSite'
import { assertInitialAdminPreviewReady } from './initialAdminPreview'

vi.mock('@/lib/admin-preview', () => ({
  buildTenantPreviewUrlFromDomains: vi.fn(() =>
    'https://tenant.example/?admin_bypass=secret'
  ),
}))
vi.mock('@/lib/supabase-admin', () => ({ getSupabaseAdmin: vi.fn() }))
vi.mock('@/lib/tenants/revalidateTenantSite', () => ({
  revalidateTenantSiteCache: vi.fn(async () => true),
}))

function fakeSupabase(renderMode: 'engine' | 'custom' = 'engine') {
  return {
    from: (table: string) => {
      const result =
        table === 'site_configs'
          ? { data: { render_mode: renderMode }, error: null }
          : {
              data: [{ hostname: 'tenant.example', source: 'platform_subdomain' }],
              error: null,
            }
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => result,
        then: (resolve: (value: typeof result) => unknown) =>
          Promise.resolve(result).then(resolve),
      }
      return query
    },
  } as unknown as ReturnType<typeof getSupabaseAdmin>
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getSupabaseAdmin).mockReturnValue(fakeSupabase())
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(`<html>${'intake site '.repeat(60)}</html>`, { status: 200 }))
  )
})

describe('assertInitialAdminPreviewReady', () => {
  it('revalidates and proves the engine site is reachable through admin bypass', async () => {
    await expect(assertInitialAdminPreviewReady('tenant-1')).resolves.toBeUndefined()

    expect(revalidateTenantSiteCache).toHaveBeenCalledWith('tenant-1')
    expect(buildTenantPreviewUrlFromDomains).toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledWith(
      'https://tenant.example/?admin_bypass=secret',
      expect.objectContaining({ redirect: 'follow' })
    )
  })

  it('rejects a holding page even when HTTP succeeds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(`<html>Site Under Construction ${'waiting '.repeat(80)}</html>`, {
          status: 200,
        })
      )
    )

    await expect(assertInitialAdminPreviewReady('tenant-1')).rejects.toThrow(
      'did not return the rendered intake site'
    )
  })

  it('rejects before fetching when the initial engine render was already replaced', async () => {
    vi.mocked(getSupabaseAdmin).mockReturnValue(fakeSupabase('custom'))

    await expect(assertInitialAdminPreviewReady('tenant-1')).rejects.toThrow(
      'no longer in engine render mode'
    )
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('automatic redesign worker ordering', () => {
  it('checks initial admin preview readiness before processing the redesign', () => {
    const src = readFileSync(
      join(process.cwd(), 'worker/src/tasks/fullRedesign.ts'),
      'utf8'
    )
    expect(src.indexOf('await assertInitialAdminPreviewReady(tenantId)')).toBeGreaterThan(0)
    expect(src.indexOf('await processCustomBuildJob(tenantId)')).toBeGreaterThan(
      src.indexOf('await assertInitialAdminPreviewReady(tenantId)')
    )
  })
})