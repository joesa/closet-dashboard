import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { logSystemAction } from '@/lib/admin'
import { teardownTenantData } from '@/lib/provision/teardownTenantData'
import { SPEC_BUILD_SELECT, type SpecBuildRow } from '@/lib/spec/types'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Delete spec sites whose time is up.
 *
 * This is the half of the bargain we owe. We build a site carrying a real
 * business's name, phone and address without asking, and the message says that
 * if they are not interested it comes down. A purge that quietly stops running
 * turns that into a lie and leaves a company's name on infrastructure they
 * never agreed to, indefinitely.
 *
 * Ordering matters: tear the tenant down first, then release the identifiers,
 * then mark the build purged. A crash mid-way leaves the row un-purged and the
 * next run retries, which is the safe direction — the alternative is a row
 * marked clean with a live site still behind it.
 */

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

async function run(req: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 })
  }
  if ((req.headers.get('authorization') || '') !== `Bearer ${secret}`) return unauthorized()

  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('spec_builds')
    .select(SPEC_BUILD_SELECT)
    .in('status', ['rejected', 'declined', 'expired'])
    .not('purge_after', 'is', null)
    .lt('purge_after', new Date().toISOString())
    .limit(25)

  const builds = (data ?? []) as SpecBuildRow[]
  const tally = { considered: builds.length, purged: 0, failed: 0 }

  for (const build of builds) {
    try {
      if (build.tenant_id) {
        await teardownTenantData(
          supabase,
          build.tenant_id,
          build.placeholder_owner_email ?? undefined
        )
      }

      // The intake is archived rather than deleted: it is the record of what we
      // built and claimed, and assertDraftIntake already treats archived as
      // closed everywhere a token could still be presented.
      if (build.intake_id) {
        await supabase
          .from('prospect_intakes')
          .update({ status: 'archived', updated_at: new Date().toISOString() })
          .eq('id', build.intake_id)
      }

      await supabase
        .from('spec_builds')
        .update({
          status: 'purged',
          // Release both so the tokens stop resolving and the placeholder
          // address is free again; the unique indexes on them would otherwise
          // block a future build for the same business.
          offer_token: null,
          placeholder_owner_email: null,
          tenant_id: null,
          status_reason: 'Site deleted — the offer lapsed.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', build.id)

      await logSystemAction({
        action: 'spec_build.purged',
        targetType: 'spec_build',
        targetId: build.id,
        metadata: { businessName: build.business_name, previousStatus: build.status },
      })
      tally.purged += 1
    } catch (err) {
      // Left un-purged on purpose so the next run retries.
      console.error('[spec-purge] failed', build.id, err)
      tally.failed += 1
    }
  }

  return NextResponse.json({ ok: true, ...tally })
}

export async function GET(req: Request) {
  return run(req)
}
export async function POST(req: Request) {
  return run(req)
}
