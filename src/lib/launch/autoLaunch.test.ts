import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { enqueueFullRedesign } from '@/lib/jobs/enqueueFullRedesign'
import { canEnqueueBackgroundJobs } from '@/lib/jobs/enqueueJob'
import { getCustomBuildJob, setCustomBuildJob } from '@/lib/ai/customBuildJob'
import { publishCustomSiteDraft } from '@/lib/ai/generateCustomSite'
import { syncTenantLaunchAccess } from '@/lib/intake/syncTenantLaunchAccess'
import { sendIntakeLaunchPaymentEmail } from '@/lib/intake/sendIntakeLaunchEmail'
import { revalidateTenantSiteCache } from '@/lib/tenants/revalidateTenantSite'

import {
  autoApproveTenantSite,
  failAutoLaunch,
  finishAutoLaunch,
  startAutoLaunchRedesign,
} from './autoLaunch'

vi.mock('@/lib/supabase-admin', () => ({ getSupabaseAdmin: vi.fn() }))
vi.mock('@/lib/jobs/enqueueFullRedesign', () => ({ enqueueFullRedesign: vi.fn() }))
vi.mock('@/lib/jobs/enqueueJob', () => ({ canEnqueueBackgroundJobs: vi.fn(() => true) }))
vi.mock('@/lib/ai/customBuildJob', () => ({
  getCustomBuildJob: vi.fn(async () => null),
  setCustomBuildJob: vi.fn(async () => undefined),
  isCustomBuildJobActive: (job: { status?: string } | null) =>
    job?.status === 'queued' || job?.status === 'processing',
}))
vi.mock('@/lib/ai/generateCustomSite', () => ({
  publishCustomSiteDraft: vi.fn(async () => ({
    warnings: [],
    errors: [],
    liveNow: true,
    siteStatus: 'pending_approval',
    publicVisible: false,
  })),
}))
vi.mock('@/lib/intake/syncTenantLaunchAccess', () => ({
  syncTenantLaunchAccess: vi.fn(async () => ({
    siteStatus: 'active',
    launchPayUrl: null,
  })),
}))
vi.mock('@/lib/intake/sendIntakeLaunchEmail', () => ({
  sendIntakeLaunchPaymentEmail: vi.fn(async () => undefined),
}))
vi.mock('@/lib/tenants/revalidateTenantSite', () => ({
  revalidateTenantSiteCache: vi.fn(async () => true),
}))
vi.mock('@/lib/admin', () => ({ logSystemAction: vi.fn(async () => undefined) }))

const TENANT = 'tenant-1'

type Row = Record<string, unknown>

/** Minimal stand-in for the Supabase query builder used by autoLaunch. */
function fakeSupabase(tables: Record<string, Row[]>) {
  const from = (table: string) => {
    const filters: Array<[string, unknown]> = []
    let pendingUpdate: Row | null = null

    const rows = () => tables[table] ?? []
    const match = () =>
      rows().find((r) => filters.every(([col, val]) => r[col] === val)) ?? null

    const q = {
      select: () => q,
      update: (patch: Row) => {
        pendingUpdate = patch
        return q
      },
      eq: (col: string, val: unknown) => {
        filters.push([col, val])
        return q
      },
      maybeSingle: async () => ({ data: match(), error: null }),
      single: async () => ({ data: match(), error: null }),
      // update(...).eq(...) is awaited directly, so the builder is thenable.
      then: (resolve: (v: { error: null }) => unknown) => {
        if (pendingUpdate) {
          const target = match()
          if (target) Object.assign(target, pendingUpdate)
          pendingUpdate = null
        }
        return Promise.resolve({ error: null }).then(resolve)
      },
    }
    return q
  }
  return { from } as unknown as ReturnType<typeof getSupabaseAdmin>
}

function seed(overrides: {
  siteConfig?: Row
  tenant?: Row
  intake?: Row | null
} = {}) {
  const tables: Record<string, Row[]> = {
    site_configs: [
      {
        tenant_id: TENANT,
        auto_launch_redesign_at: null,
        auto_launch_approved_at: null,
        auto_launch_completed_at: null,
        edit_in_place: false,
        ...overrides.siteConfig,
      },
    ],
    tenants: [
      {
        id: TENANT,
        site_status: 'pending_approval',
        validation_status: 'passed',
        ...overrides.tenant,
      },
    ],
    prospect_intakes:
      overrides.intake === null
        ? []
        : [
            {
              id: 'intake-1',
              token: 'tok-1',
              provisioned_contractor_id: TENANT,
              intake_tier: 'standard',
              business_name: 'Acme Closets',
              contact_email: 'owner@acme.test',
              notification_email: null,
              status: 'built',
              tier_total_cents: 200000,
              deposit_required_cents: 0,
              deposit_paid_cents: 0,
              deposit_status: 'not_required',
              build_paid_at: null,
              balance_paid_at: null,
              preview_approved_at: null,
              site_live_at: null,
              maintenance_plan: null,
              maintenance_started_at: null,
              ...overrides.intake,
            },
          ],
  }
  vi.mocked(getSupabaseAdmin).mockReturnValue(fakeSupabase(tables))
  return tables
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(canEnqueueBackgroundJobs).mockReturnValue(true)
  vi.mocked(getCustomBuildJob).mockResolvedValue(null)
  vi.mocked(syncTenantLaunchAccess).mockResolvedValue({
    siteStatus: 'active',
    launchPayUrl: null,
  })
  vi.mocked(publishCustomSiteDraft).mockResolvedValue({
    warnings: [],
    errors: [],
    liveNow: true,
    siteStatus: 'pending_approval',
    publicVisible: false,
  })
})

afterEach(() => {
  delete process.env.AUTO_LAUNCH_REDESIGN
  delete process.env.AUTO_LAUNCH_REVEAL_ON_REDESIGN_FAILURE
})

describe('startAutoLaunchRedesign', () => {
  it('queues the first full redesign and stamps the tenant', async () => {
    const tables = seed()

    await expect(startAutoLaunchRedesign(TENANT)).resolves.toBe(true)

    expect(enqueueFullRedesign).toHaveBeenCalledTimes(1)
    const job = vi.mocked(setCustomBuildJob).mock.calls[0][1]
    expect(job).toMatchObject({
      status: 'queued',
      intent: 'full',
      prompt: '',
      auto_launch: true,
      ever_full: true,
    })
    expect(tables.site_configs[0].auto_launch_redesign_at).toBeTruthy()
  })

  it('clears any prior draft so checkpoint resume stays inside this run', async () => {
    const tables = seed({ siteConfig: { custom_config_draft: { pages: {} } } })

    await startAutoLaunchRedesign(TENANT)

    expect(tables.site_configs[0].custom_config_draft).toBeNull()
  })

  it('is a no-op once the first redesign has already been enqueued', async () => {
    seed({ siteConfig: { auto_launch_redesign_at: '2026-08-01T00:00:00Z' } })

    await expect(startAutoLaunchRedesign(TENANT)).resolves.toBe(false)
    expect(enqueueFullRedesign).not.toHaveBeenCalled()
  })

  it('skips widget-only tenants, which have no marketing site', async () => {
    seed({ tenant: { site_status: 'widget_only' } })

    await expect(startAutoLaunchRedesign(TENANT)).resolves.toBe(false)
    expect(enqueueFullRedesign).not.toHaveBeenCalled()
  })

  it('respects the AUTO_LAUNCH_REDESIGN kill switch', async () => {
    process.env.AUTO_LAUNCH_REDESIGN = 'false'
    seed()

    await expect(startAutoLaunchRedesign(TENANT)).resolves.toBe(false)
    expect(enqueueFullRedesign).not.toHaveBeenCalled()
  })

  it('returns false when no worker queue is configured', async () => {
    vi.mocked(canEnqueueBackgroundJobs).mockReturnValue(false)
    seed()

    await expect(startAutoLaunchRedesign(TENANT)).resolves.toBe(false)
    expect(enqueueFullRedesign).not.toHaveBeenCalled()
  })

  it('does not stack on an already-active custom build', async () => {
    seed()
    vi.mocked(getCustomBuildJob).mockResolvedValue({
      status: 'processing',
      intent: 'full',
      prompt: '',
      started_at: '2026-08-01T00:00:00Z',
    })

    await expect(startAutoLaunchRedesign(TENANT)).resolves.toBe(false)
    expect(enqueueFullRedesign).not.toHaveBeenCalled()
  })

  it('rolls the job to failed and does not stamp when the enqueue throws', async () => {
    const tables = seed()
    vi.mocked(enqueueFullRedesign).mockRejectedValueOnce(new Error('no DATABASE_URL'))

    await expect(startAutoLaunchRedesign(TENANT)).resolves.toBe(false)

    const lastJob = vi.mocked(setCustomBuildJob).mock.calls.at(-1)?.[1]
    expect(lastJob).toMatchObject({ status: 'failed', error: 'no DATABASE_URL' })
    expect(tables.site_configs[0].auto_launch_redesign_at).toBeNull()
  })
})

describe('autoApproveTenantSite', () => {
  it('refuses while site validation has not passed', async () => {
    seed({ tenant: { validation_status: 'failed' } })

    await expect(autoApproveTenantSite(TENANT)).resolves.toBe(false)
    expect(syncTenantLaunchAccess).not.toHaveBeenCalled()
  })

  it('refuses while edit-in-place is on', async () => {
    seed({ siteConfig: { edit_in_place: true } })

    await expect(autoApproveTenantSite(TENANT)).resolves.toBe(false)
    expect(syncTenantLaunchAccess).not.toHaveBeenCalled()
  })

  it('stamps preview approval and emails the pay link for an unpaid intake', async () => {
    const tables = seed()

    await expect(autoApproveTenantSite(TENANT)).resolves.toBe(true)

    expect(tables.prospect_intakes[0].preview_approved_at).toBeTruthy()
    expect(sendIntakeLaunchPaymentEmail).toHaveBeenCalledTimes(1)
    const email = vi.mocked(sendIntakeLaunchPaymentEmail).mock.calls[0][0]
    expect(email.to).toBe('owner@acme.test')
    expect(email.intakeUrl).toContain('/intake/tok-1?pay=standard_build')
    expect(syncTenantLaunchAccess).toHaveBeenCalledWith({
      tenantId: TENANT,
      intakeId: 'intake-1',
    })
  })

  it('does not re-send the pay link when preview was already approved', async () => {
    seed({ intake: { preview_approved_at: '2026-08-01T00:00:00Z' } })

    await expect(autoApproveTenantSite(TENANT)).resolves.toBe(true)

    expect(sendIntakeLaunchPaymentEmail).not.toHaveBeenCalled()
    expect(syncTenantLaunchAccess).toHaveBeenCalled()
  })

  it('sends no pay link for an already-paid intake', async () => {
    seed({ intake: { build_paid_at: '2026-08-01T00:00:00Z' } })

    await expect(autoApproveTenantSite(TENANT)).resolves.toBe(true)

    expect(sendIntakeLaunchPaymentEmail).not.toHaveBeenCalled()
  })

  it('busts the tenant site cache and stamps the approval', async () => {
    const tables = seed()

    await autoApproveTenantSite(TENANT)

    expect(revalidateTenantSiteCache).toHaveBeenCalledWith(TENANT)
    expect(tables.site_configs[0].auto_launch_approved_at).toBeTruthy()
    // Completion belongs to the post-redesign publish, which has not run yet.
    // Stamping it here is what used to make finishAutoLaunch skip publishing.
    expect(tables.site_configs[0].auto_launch_completed_at).toBeNull()
  })

  it('is a no-op once it has already approved', async () => {
    seed({ siteConfig: { auto_launch_approved_at: '2026-08-01T00:00:00Z' } })

    await expect(autoApproveTenantSite(TENANT)).resolves.toBe(false)
    expect(syncTenantLaunchAccess).not.toHaveBeenCalled()
  })

  it('is a no-op for a tenant that completed under the old ordering', async () => {
    // Pre-migration rows only have completed_at; re-approving would re-send a
    // launch-payment email to a customer who has been live for weeks.
    seed({ siteConfig: { auto_launch_completed_at: '2026-08-01T00:00:00Z' } })

    await expect(autoApproveTenantSite(TENANT)).resolves.toBe(false)
    expect(syncTenantLaunchAccess).not.toHaveBeenCalled()
    expect(sendIntakeLaunchPaymentEmail).not.toHaveBeenCalled()
  })

  it('still approves when the tenant has no intake row', async () => {
    seed({ intake: null })

    await expect(autoApproveTenantSite(TENANT)).resolves.toBe(true)
    expect(syncTenantLaunchAccess).toHaveBeenCalledWith({
      tenantId: TENANT,
      intakeId: null,
    })
  })
})

describe('finishAutoLaunch', () => {
  it('publishes the draft and then reveals the site', async () => {
    seed()

    await finishAutoLaunch(TENANT)

    expect(publishCustomSiteDraft).toHaveBeenCalledWith(TENANT)
    expect(syncTenantLaunchAccess).toHaveBeenCalled()
  })

  it('publishes over the already-live template site', async () => {
    // The tenant went live before the redesign started, so approval is spent.
    // Guarding the publish on that stamp would strand a finished redesign as an
    // unpublished draft while the customer stays on the engine template.
    const tables = seed({
      siteConfig: { auto_launch_approved_at: '2026-08-04T00:00:00Z' },
    })

    await finishAutoLaunch(TENANT)

    expect(publishCustomSiteDraft).toHaveBeenCalledWith(TENANT)
    expect(tables.site_configs[0].auto_launch_completed_at).toBeTruthy()
  })

  it('busts the cache so the live site stops serving the template', async () => {
    seed({ siteConfig: { auto_launch_approved_at: '2026-08-04T00:00:00Z' } })

    await finishAutoLaunch(TENANT)

    expect(revalidateTenantSiteCache).toHaveBeenCalledWith(TENANT)
  })

  it('still reveals — without publishing — when the quality gate blocks', async () => {
    seed()
    vi.mocked(publishCustomSiteDraft).mockRejectedValueOnce(
      new Error('Cannot publish: design_duplicate_visual')
    )

    await expect(finishAutoLaunch(TENANT)).resolves.toBeUndefined()

    expect(syncTenantLaunchAccess).toHaveBeenCalled()
  })

  it('does nothing when the finish step already ran', async () => {
    seed({ siteConfig: { auto_launch_completed_at: '2026-08-01T00:00:00Z' } })

    await finishAutoLaunch(TENANT)

    expect(publishCustomSiteDraft).not.toHaveBeenCalled()
  })
})

describe('failAutoLaunch', () => {
  it('reveals on the engine template rather than stranding the customer', async () => {
    seed()

    await failAutoLaunch(TENANT)

    expect(publishCustomSiteDraft).not.toHaveBeenCalled()
    expect(syncTenantLaunchAccess).toHaveBeenCalled()
  })

  it('leaves the site gated when reveal-on-failure is disabled', async () => {
    process.env.AUTO_LAUNCH_REVEAL_ON_REDESIGN_FAILURE = 'false'
    seed()

    await failAutoLaunch(TENANT)

    expect(syncTenantLaunchAccess).not.toHaveBeenCalled()
  })
})
