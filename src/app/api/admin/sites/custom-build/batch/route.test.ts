import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentAdmin: vi.fn(),
  logAdminAction: vi.fn(),
  getSupabaseAdmin: vi.fn(),
  getJob: vi.fn(),
  isJobActive: vi.fn(),
  setJob: vi.fn(),
  enqueue: vi.fn(),
  canEnqueue: vi.fn(),
}))

vi.mock('@/lib/admin', () => ({
  getCurrentAdmin: mocks.getCurrentAdmin,
  logAdminAction: mocks.logAdminAction,
}))
vi.mock('@/lib/supabase-admin', () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }))
vi.mock('@/lib/ai/customBuildJob', () => ({
  getAndReconcileCustomBuildJob: mocks.getJob,
  isCustomBuildJobActive: mocks.isJobActive,
  setCustomBuildJob: mocks.setJob,
}))
vi.mock('@/lib/jobs/enqueueFullRedesign', () => ({ enqueueFullRedesign: mocks.enqueue }))
vi.mock('@/lib/jobs/enqueueJob', () => ({ canEnqueueBackgroundJobs: mocks.canEnqueue }))

import { POST } from './route'

const IDS = Array.from(
  { length: 21 },
  (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`
)

function request(tenantIds: string[]) {
  return new Request('http://localhost/api/admin/sites/custom-build/batch', {
    method: 'POST',
    body: JSON.stringify({ tenantIds }),
  })
}

describe('POST batch Full Redesign', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentAdmin.mockResolvedValue({ id: 'admin-1' })
    mocks.canEnqueue.mockReturnValue(true)
    mocks.getJob.mockResolvedValue(null)
    mocks.isJobActive.mockReturnValue(false)
    mocks.setJob.mockResolvedValue(undefined)
    mocks.enqueue.mockResolvedValue(undefined)
    mocks.logAdminAction.mockResolvedValue(undefined)
  })

  it('rejects unauthenticated requests before checking worker configuration', async () => {
    mocks.getCurrentAdmin.mockResolvedValue(null)
    const response = await POST(request([IDS[0]]))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.canEnqueue).not.toHaveBeenCalled()
  })

  it('rejects batches over the configured limit before querying tenants', async () => {
    const response = await POST(request(IDS))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Select no more than 20 sites' })
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled()
  })

  it('isolates queue failures and skips missing, widget-only, and active sites', async () => {
    const [queuedId, failedId, widgetId, activeId, missingId] = IDS
    const tenants = [
      { id: queuedId, business_name: 'Queued Co', site_status: 'active' },
      { id: failedId, business_name: 'Failed Co', site_status: 'active' },
      { id: widgetId, business_name: 'Widget Co', site_status: 'widget_only' },
      { id: activeId, business_name: 'Active Co', site_status: 'active' },
    ]
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const from = vi.fn((table: string) => {
      if (table === 'tenants') {
        return { select: () => ({ in: vi.fn().mockResolvedValue({ data: tenants, error: null }) }) }
      }
      return { update: () => ({ eq: updateEq }) }
    })
    mocks.getSupabaseAdmin.mockReturnValue({ from })
    mocks.getJob.mockImplementation(async (tenantId: string) =>
      tenantId === activeId ? { status: 'running' } : null
    )
    mocks.isJobActive.mockImplementation((job) => job?.status === 'running')
    mocks.enqueue.mockImplementation(async (tenantId: string) => {
      if (tenantId === failedId) throw new Error('queue unavailable')
    })

    const response = await POST(request([queuedId, failedId, widgetId, activeId, missingId]))
    expect(response.status).toBe(200)
    expect((await response.json()).results).toEqual([
      expect.objectContaining({ tenantId: queuedId, status: 'queued' }),
      expect.objectContaining({ tenantId: failedId, status: 'failed', message: 'queue unavailable' }),
      expect.objectContaining({ tenantId: widgetId, status: 'skipped', message: 'Widget-only tenant' }),
      expect.objectContaining({ tenantId: activeId, status: 'skipped', message: 'A redesign is already active' }),
      expect.objectContaining({ tenantId: missingId, status: 'skipped', message: 'Site not found' }),
    ])
    expect(mocks.enqueue).toHaveBeenCalledTimes(2)
    expect(mocks.logAdminAction).toHaveBeenCalledTimes(1)
  })
})