import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import type { Pool, PoolClient } from 'pg'

/**
 * Tenant isolation, asserted against the real policies.
 *
 * The lead inbox at /dashboard/leads reads through the session-scoped anon
 * client so that RLS applies, but "the policy exists" and "the policy holds"
 * are different claims and only the first one was ever checked. The plan named
 * this suite a prerequisite for shipping that screen; the screen shipped first,
 * so this is the missing half.
 *
 * The policies are exercised the way PostgREST exercises them — `set local
 * role authenticated` plus a jwt claims setting — rather than through a
 * Supabase client, so no auth user has to exist and the whole fixture rolls
 * back. Reading these tables as `postgres` would bypass RLS entirely and prove
 * nothing, which is the trap this file is shaped to avoid.
 *
 * Requires DATABASE_URL. CI has no database, so there it skips loudly rather
 * than passing silently — see the guard test at the bottom.
 */

/**
 * Vitest does not load .env.local, and adding a global setup file that did
 * would hand every other test suite live API keys. Read it here only.
 */
function loadLocalEnv(): void {
  const envPath = resolve(__dirname, '..', '..', '..', '.env.local')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
loadLocalEnv()

const hasDatabase = Boolean(process.env.DATABASE_URL)

const CONTRACTOR_A = '11111111-1111-4111-8111-111111111111'
const CONTRACTOR_B = '22222222-2222-4222-8222-222222222222'
const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const USER_ORPHAN = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

let pool: Pool | null = null

async function getPool(): Promise<Pool> {
  if (!pool) {
    const { createGraphilePool } = await import('@/lib/jobs/databaseUrl')
    pool = createGraphilePool()
  }
  return pool
}

afterAll(async () => {
  await pool?.end().catch(() => undefined)
})

/** Seed two tenants, run `fn` as `authenticated`, then roll everything back. */
async function asUser<T>(userId: string | null, fn: (db: PoolClient) => Promise<T>): Promise<T> {
  const db = await (await getPool()).connect()
  try {
    await db.query('begin')

    // Seeded as the owner role, which bypasses RLS — the fixture must exist
    // before the policies are allowed to hide any of it.
    // contractor_settings.user_id is a real FK to auth.users, so the identities
    // have to exist even though the policies only ever compare uuids.
    await db.query(
      `insert into auth.users (id) values ($1), ($2), ($3)`,
      [USER_A, USER_B, USER_ORPHAN]
    )
    await db.query(
      `insert into public.contractor_settings (id, user_id, company_name)
       values ($1, $2, 'Tenant A'), ($3, $4, 'Tenant B')`,
      [CONTRACTOR_A, USER_A, CONTRACTOR_B, USER_B]
    )
    await db.query(
      `insert into public.leads (contractor_id, first_name, email)
       values ($1, 'Lead for A', 'a@example.test'), ($2, 'Lead for B', 'b@example.test')`,
      [CONTRACTOR_A, CONTRACTOR_B]
    )
    await db.query(
      `insert into public.orders (contractor_id) values ($1), ($2)`,
      [CONTRACTOR_A, CONTRACTOR_B]
    )
    await db.query(
      `insert into public.bookings
         (contractor_id, service_name, customer_name, customer_email, booking_date, booking_time)
       values ($1, 'Consult', 'Cust A', 'a@example.test', current_date, '09:00'),
              ($2, 'Consult', 'Cust B', 'b@example.test', current_date, '09:00')`,
      [CONTRACTOR_A, CONTRACTOR_B]
    )

    if (userId === null) {
      await db.query(`set local role anon`)
    } else {
      await db.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: userId, role: 'authenticated' }),
      ])
      await db.query(`set local role authenticated`)
    }

    return await fn(db)
  } finally {
    await db.query('rollback').catch(() => undefined)
    db.release()
  }
}

const suite = hasDatabase ? describe : describe.skip

suite('RLS tenant isolation', () => {
  it('enables RLS on every tenant-scoped table (a policy on an unprotected table is inert)', async () => {
    const db = await getPool()
    const { rows } = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity from pg_class
        where relnamespace = 'public'::regnamespace
          and relname in ('leads', 'orders', 'bookings')`
    )
    expect(rows).toHaveLength(3)
    for (const row of rows) expect(`${row.relname}:${row.relrowsecurity}`).toBe(`${row.relname}:true`)
  })

  it('lets an owner read their own leads', async () => {
    const names = await asUser(USER_A, async (db) => {
      const { rows } = await db.query<{ first_name: string }>('select first_name from public.leads')
      return rows.map((r) => r.first_name)
    })
    // If this ever returns [], every isolation assertion below becomes vacuous.
    expect(names).toEqual(['Lead for A'])
  })

  it("hides another tenant's leads, including from a direct lookup by id", async () => {
    const result = await asUser(USER_A, async (db) => {
      const all = await db.query('select contractor_id from public.leads')
      const targeted = await db.query('select id from public.leads where contractor_id = $1', [
        CONTRACTOR_B,
      ])
      return { all: all.rows.map((r) => r.contractor_id), targeted: targeted.rowCount }
    })
    expect(result.all).toEqual([CONTRACTOR_A])
    expect(result.targeted).toBe(0)
  })

  it('scopes orders and bookings to the owner too', async () => {
    const counts = await asUser(USER_B, async (db) => ({
      orders: (await db.query('select 1 from public.orders')).rowCount,
      bookings: (await db.query('select 1 from public.bookings')).rowCount,
      foreignOrders: (
        await db.query('select 1 from public.orders where contractor_id = $1', [CONTRACTOR_A])
      ).rowCount,
    }))
    expect(counts).toEqual({ orders: 1, bookings: 1, foreignOrders: 0 })
  })

  it('shows nothing to an authenticated user who owns no contractor', async () => {
    const counts = await asUser(USER_ORPHAN, async (db) => ({
      leads: (await db.query('select 1 from public.leads')).rowCount,
      orders: (await db.query('select 1 from public.orders')).rowCount,
      bookings: (await db.query('select 1 from public.bookings')).rowCount,
    }))
    expect(counts).toEqual({ leads: 0, orders: 0, bookings: 0 })
  })

  it('leaks no leads to anon (the role every unauthenticated widget request uses)', async () => {
    // anon does not get an empty result set here — it gets "permission denied
    // for table contractor_settings", because the owner policy's EXISTS
    // subquery reads columns outside anon's column-level grant. That is a fine
    // outcome (it fails closed) but it is not the obvious one, so the
    // assertion records what actually happens rather than what reads nicely.
    const outcome = await asUser(null, async (db) => {
      try {
        const { rows } = await db.query('select id from public.leads')
        return { kind: 'rows' as const, count: rows.length }
      } catch (err) {
        return { kind: 'denied' as const, message: (err as Error).message }
      }
    })

    if (outcome.kind === 'rows') {
      expect(outcome.count).toBe(0)
    } else {
      expect(outcome.message).toMatch(/permission denied/i)
    }
  })

  it('does not let an owner delete or alter their leads (read-only by policy)', async () => {
    const outcome = await asUser(USER_A, async (db) => {
      // No INSERT/UPDATE/DELETE policy exists for `authenticated`, so these
      // affect zero rows rather than raising. Either would be acceptable; what
      // must not happen is a row actually changing.
      const updated = await db.query(`update public.leads set first_name = 'tampered'`)
      const deleted = await db.query('delete from public.leads')
      return { updated: updated.rowCount, deleted: deleted.rowCount }
    })
    expect(outcome).toEqual({ updated: 0, deleted: 0 })
  })
})

describe('RLS suite wiring', () => {
  it('reports plainly when it is skipped, so a green CI run is not read as coverage', () => {
    if (!hasDatabase) {
      console.warn(
        '[rlsTenantIsolation] SKIPPED — no DATABASE_URL. These policies are unverified in this run.'
      )
    }
    expect(typeof hasDatabase).toBe('boolean')
  })
})
