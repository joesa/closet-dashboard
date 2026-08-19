import { describe, expect, it } from 'vitest'
import { assertTenantIsSafeToReplace } from '@/lib/provision/provisionTenant'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Provisioning may not delete a tenant that has live customer data.
 *
 * provisionTenant tears down an existing tenant before rebuilding, and it runs
 * on every retry — three at the queue level, three more under Graphile. A job
 * that fails after writing tenant rows comes back and deletes what the previous
 * attempt built. Wasteful for a fresh build; unrecoverable for a tenant whose
 * captured leads are the entire product.
 */

type Fixture = {
  leads?: number
  orders?: number
  bookings?: number
  subscription?: string | null
}

/** Minimal stand-in for the two shapes the guard uses. */
function client(fixture: Fixture): SupabaseClient {
  const counts: Record<string, number> = {
    leads: fixture.leads ?? 0,
    orders: fixture.orders ?? 0,
    bookings: fixture.bookings ?? 0,
  }
  return {
    from(table: string) {
      return {
        select(_columns: string, options?: { head?: boolean }) {
          if (options?.head) {
            return { eq: async () => ({ count: counts[table] ?? 0 }) }
          }
          return {
            eq: () => ({
              maybeSingle: async () => ({
                data: { subscription_status: fixture.subscription ?? null },
              }),
            }),
          }
        },
      }
    },
  } as unknown as SupabaseClient
}

const run = (fixture: Fixture) =>
  assertTenantIsSafeToReplace(client(fixture), 'tenant-1', 'owner@example.com')

describe('assertTenantIsSafeToReplace', () => {
  it('allows replacing a tenant with nothing to lose', async () => {
    await expect(run({})).resolves.toBeUndefined()
    await expect(run({ subscription: 'trialing' })).resolves.toBeUndefined()
    await expect(run({ subscription: 'canceled' })).resolves.toBeUndefined()
  })

  it('refuses when the tenant has captured leads', async () => {
    await expect(run({ leads: 3 })).rejects.toThrow(/3 captured lead/)
  })

  it('refuses for orders, bookings, and a paying subscription', async () => {
    await expect(run({ orders: 2 })).rejects.toThrow(/2 order/)
    await expect(run({ bookings: 1 })).rejects.toThrow(/1 booking/)
    await expect(run({ subscription: 'active' })).rejects.toThrow(/active subscription/)
    // past_due is still a paying customer mid-recovery, not a free tenant.
    await expect(run({ subscription: 'past_due' })).rejects.toThrow(/past_due subscription/)
  })

  it('names every reason at once, so one fix does not reveal another', async () => {
    await expect(run({ leads: 4, orders: 1, subscription: 'active' })).rejects.toThrow(
      /4 captured lead\(s\), 1 order\(s\), an active subscription/
    )
  })

  it('runs before the teardown it is protecting', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const source = readFileSync(join(__dirname, 'provisionTenant.ts'), 'utf8')
    const guardAt = source.indexOf('await assertTenantIsSafeToReplace(')
    const teardownAt = source.indexOf('await teardownTenantData(')
    expect(guardAt).toBeGreaterThan(0)
    expect(guardAt, 'a guard after the teardown guards nothing').toBeLessThan(teardownAt)
  })
})
