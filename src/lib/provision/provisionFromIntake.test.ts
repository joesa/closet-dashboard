import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { provisionTenant } from '@/lib/provision/provisionTenant'
import { autoApproveTenantSite, startAutoLaunchRedesign } from '@/lib/launch/autoLaunch'
import { waitForInitialSiteDeployed } from '@/lib/launch/waitForInitialSite'
import { provisionFromIntakeJob, type ProvisionJobRow } from './provisionFromIntake'

/**
 * What a submitted intake must do with no admin anywhere in the loop:
 *
 *   deploy the template site → wait until it serves → approve it (live)
 *   → only then queue the first Full redesign.
 *
 * The order is the point. Queueing the redesign before the deploy is serving
 * burns its whole retry budget on "not reachable yet"; approving after the
 * redesign instead of before leaves a paying customer invisible for the length
 * of a multi-minute build.
 */

const calls: string[] = []

vi.mock('@/lib/supabase-admin', () => ({ getSupabaseAdmin: vi.fn() }))
vi.mock('@/lib/provision/provisionTenant', () => ({
  provisionTenant: vi.fn(async () => {
    calls.push('deploy')
    return { success: true, mode: 'full', tenantId: 'tenant-1' }
  }),
}))
vi.mock('@/lib/launch/waitForInitialSite', () => ({
  waitForInitialSiteDeployed: vi.fn(async () => {
    calls.push('wait')
    return { ready: true, attempts: 1, waitedMs: 0 }
  }),
}))
vi.mock('@/lib/launch/autoLaunch', () => ({
  autoApproveTenantSite: vi.fn(async () => {
    calls.push('approve')
    return true
  }),
  startAutoLaunchRedesign: vi.fn(async () => {
    calls.push('redesign')
    return true
  }),
}))
vi.mock('@/lib/provision/buildTemplateSiteConfig', () => ({
  buildTemplateProvisionPayload: vi.fn(async () => ({
    businessName: 'Gewod Pressure',
    theme: 'fresh-clean',
    services: ['House Washing'],
  })),
}))
vi.mock('@/lib/provision/dedupe', () => ({
  assertNoDuplicateProvision: vi.fn(async () => undefined),
}))
vi.mock('@/lib/provision/resolveSubdomain', () => ({
  resolveSubdomain: vi.fn(async () => 'gewod-pressure'),
}))
vi.mock('@/lib/ai/buildWidgetConfig', () => ({ buildWidgetConfig: vi.fn(async () => null) }))
vi.mock('@/lib/marketBounds', () => ({ loadMarketBounds: vi.fn(async () => []) }))
vi.mock('@/lib/intake/buildAiProvisionPayload', () => ({
  buildAiProvisionPayload: vi.fn(async () => ({ businessName: 'Gewod Pressure' })),
  validateAiPremiumReady: vi.fn(() => null),
}))
vi.mock('@/lib/provision/applyProWidgetConfig', () => ({
  applyProWidgetConfig: vi.fn(async () => undefined),
}))

const INTAKE = {
  id: 'intake-1',
  business_name: 'Gewod Pressure',
  contact_email: 'owner@gewod.test',
  notification_email: null,
  contact_phone: null,
  services: ['House Washing', 'Roof Soft Wash'],
  service_area: 'Nashville',
  address_locality: 'Clarksville',
  address_region: 'TN',
  widget_config_hints: null,
}

function fakeSupabase(intake: Record<string, unknown> = INTAKE) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => ({ data: intake, error: null }),
    single: async () => ({ data: intake, error: null }),
    update: () => builder,
    then: (resolve: (v: { error: null }) => unknown) =>
      Promise.resolve({ error: null }).then(resolve),
  }
  return { from: () => builder } as unknown as ReturnType<typeof getSupabaseAdmin>
}

const JOB: ProvisionJobRow = {
  id: 'job-1',
  intake_id: 'intake-1',
  status: 'processing',
  mode: 'full',
  attempts: 1,
}

beforeEach(() => {
  calls.length = 0
  vi.clearAllMocks()
  vi.mocked(getSupabaseAdmin).mockReturnValue(fakeSupabase())
  vi.mocked(waitForInitialSiteDeployed).mockImplementation(async () => {
    calls.push('wait')
    return { ready: true, attempts: 1, waitedMs: 0 }
  })
  vi.mocked(autoApproveTenantSite).mockImplementation(async () => {
    calls.push('approve')
    return true
  })
  vi.mocked(startAutoLaunchRedesign).mockImplementation(async () => {
    calls.push('redesign')
    return true
  })
  vi.mocked(provisionTenant).mockImplementation(async () => {
    calls.push('deploy')
    return { success: true, mode: 'full', tenantId: 'tenant-1' } as Awaited<
      ReturnType<typeof provisionTenant>
    >
  })
})

describe('a submitted intake deploys, approves, then redesigns', () => {
  it('runs the four steps in order with no admin action', async () => {
    await provisionFromIntakeJob(JOB, 'https://app.test')

    expect(calls).toEqual(['deploy', 'wait', 'approve', 'redesign'])
  })

  it('approves the deployed template site itself, not the redesign', async () => {
    await provisionFromIntakeJob(JOB, 'https://app.test')

    expect(autoApproveTenantSite).toHaveBeenCalledWith('tenant-1', {
      reason: 'template_deployed',
    })
    // Approval lands before the redesign is even queued.
    expect(calls.indexOf('approve')).toBeLessThan(calls.indexOf('redesign'))
  })

  it('deploys the site as gated, and lets approval resolve the public status', async () => {
    await provisionFromIntakeJob(JOB, 'https://app.test')

    const payload = vi.mocked(provisionTenant).mock.calls[0][0]
    expect(payload).toMatchObject({ mode: 'full', siteStatus: 'pending_approval' })
    // No admin in the loop: the approve step immediately follows the deploy.
    expect(autoApproveTenantSite).toHaveBeenCalledTimes(1)
  })

  it('goes live even when the first redesign cannot be queued', async () => {
    vi.mocked(startAutoLaunchRedesign).mockImplementation(async () => {
      calls.push('redesign')
      return false
    })

    await provisionFromIntakeJob(JOB, 'https://app.test')

    // No worker / kill switch off must not cost the customer their live site.
    expect(calls).toEqual(['deploy', 'wait', 'approve', 'redesign'])
    expect(autoApproveTenantSite).toHaveBeenCalledTimes(1)
  })

  it('still approves and queues when the readiness wait times out', async () => {
    vi.mocked(waitForInitialSiteDeployed).mockImplementation(async () => {
      calls.push('wait')
      return { ready: false, attempts: 40, waitedMs: 600_000, lastError: 'HTTP 404' }
    })

    await provisionFromIntakeJob(JOB, 'https://app.test')

    // The redesign worker re-checks the same gate, so a slow subdomain delays
    // the tenant rather than stranding it.
    expect(calls).toEqual(['deploy', 'wait', 'approve', 'redesign'])
  })

  it('never fails the provision job over an auto-launch error', async () => {
    vi.mocked(autoApproveTenantSite).mockRejectedValue(new Error('supabase down'))

    await expect(provisionFromIntakeJob(JOB, 'https://app.test')).resolves.toBeUndefined()
    expect(provisionTenant).toHaveBeenCalledTimes(1)
  })

  it('leaves widget-only intakes out of the launch sequence entirely', async () => {
    await provisionFromIntakeJob({ ...JOB, mode: 'widget' }, 'https://app.test')

    expect(calls).toEqual(['deploy'])
    expect(autoApproveTenantSite).not.toHaveBeenCalled()
    expect(startAutoLaunchRedesign).not.toHaveBeenCalled()
  })
})
