import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentAdmin: vi.fn(),
  getTenantHostnameForUser: vi.fn(),
  getUser: vi.fn(),
}))

vi.mock('@/lib/admin', () => ({ getCurrentAdmin: mocks.getCurrentAdmin }))
vi.mock('@/lib/supabase-server', () => ({
  getSupabaseServer: vi.fn(async () => ({ auth: { getUser: mocks.getUser } })),
}))
vi.mock('@/lib/tenantHost', () => ({
  getTenantHostnameForUser: mocks.getTenantHostnameForUser,
  isDashboardHost: vi.fn(() => false),
}))
vi.mock('@/lib/urls', () => ({
  publicAppOrigin: vi.fn(() => 'https://www.ditchtheform.com'),
}))

import { GET } from './route'

describe('GET /api/auth/tenant-redirect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'admin-user' } },
      error: null,
    })
  })

  it('always sends an authenticated admin directly to the canonical admin workspace', async () => {
    mocks.getCurrentAdmin.mockResolvedValue({
      id: 'admin-user',
      email: 'admin@example.com',
    })

    const response = await GET(
      new Request('https://tenant.example.com/api/auth/tenant-redirect?next=/dashboard', {
        headers: { 'x-tenant-host': 'tenant.example.com' },
      })
    )

    await expect(response.json()).resolves.toEqual({
      url: 'https://www.ditchtheform.com/admin',
      role: 'admin',
    })
    expect(mocks.getTenantHostnameForUser).not.toHaveBeenCalled()
  })
})
