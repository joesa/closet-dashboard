import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { normalizePhone } from '@/lib/twilio-sms'
import {
  SPEC_BUILD_CLOSED_STATUSES,
  SPEC_BUILD_IN_FLIGHT_STATUSES,
  SPEC_BUILD_SELECT,
  type SpecBuildLeadInput,
  type SpecBuildLeadSource,
  type SpecBuildRow,
  type SpecBuildStatus,
} from '@/lib/spec/types'

/** Postgres unique-violation. A duplicate here is an expected outcome, not an error. */
const PG_UNIQUE_VIOLATION = '23505'

export function specBuildsEnabled(): boolean {
  return process.env.SPEC_BUILD_ENABLED === 'true'
}

export function specBuildDailyMax(): number {
  const raw = parseInt(process.env.SPEC_BUILD_DAILY_MAX || '5', 10)
  return Number.isFinite(raw) && raw >= 0 ? raw : 5
}

export function specBuildMaxServices(): number {
  const raw = parseInt(process.env.SPEC_BUILD_MAX_SERVICES || '5', 10)
  return Number.isFinite(raw) && raw > 0 ? raw : 5
}

export type QueueSpecBuildResult =
  | { queued: true; id: string }
  | { queued: false; reason: 'duplicate' | 'invalid_phone' | 'missing_name'; detail?: string }

export type DeleteSpecBuildResult =
  | { deleted: true; intakeDeleted: boolean }
  | { deleted: false; reason: 'not_found' | 'in_flight' | 'tenant_exists' }

export function specBuildDeletionBlockReason(
  build: Pick<SpecBuildRow, 'status' | 'tenant_id'>
): 'in_flight' | 'tenant_exists' | null {
  if ((SPEC_BUILD_IN_FLIGHT_STATUSES as readonly string[]).includes(build.status)) {
    return 'in_flight'
  }
  if (build.tenant_id) return 'tenant_exists'
  return null
}

/**
 * Permanently remove a queue entry that has not produced a tenant.
 * Any attached intake is deleted only when it is a spec-created row.
 */
export async function deleteSpecBuild(id: string): Promise<DeleteSpecBuildResult> {
  const build = await getSpecBuild(id)
  if (!build) return { deleted: false, reason: 'not_found' }

  const blocked = specBuildDeletionBlockReason(build)
  if (blocked) return { deleted: false, reason: blocked }

  const supabase = getSupabaseAdmin()
  let intakeDeleted = false
  if (build.intake_id) {
    const { data, error } = await supabase
      .from('prospect_intakes')
      .delete()
      .eq('id', build.intake_id)
      .eq('source', 'spec')
      .select('id')
    if (error) throw error
    intakeDeleted = (data?.length ?? 0) > 0
  }

  const { data, error } = await supabase
    .from('spec_builds')
    .delete()
    .eq('id', id)
    .select('id')
  if (error) throw error
  if ((data?.length ?? 0) === 0) return { deleted: false, reason: 'not_found' }

  return { deleted: true, intakeDeleted }
}

/**
 * Put one lead in the queue.
 *
 * Deduplication is the database's job, not a pre-flight SELECT: `scraper_leads`
 * has no dedupe of its own, so a re-crawl of the same city produces the same
 * business again, and two concurrent callers would both pass a read-then-write
 * check. The partial unique index on `phone_e164` is the real guard and a
 * 23505 here means "already queued", which is a normal answer.
 */
export async function queueSpecBuild(input: {
  lead: SpecBuildLeadInput
  leadSource: SpecBuildLeadSource
  scraperLeadId?: string | null
  scraperRunId?: string | null
}): Promise<QueueSpecBuildResult> {
  const businessName = input.lead.businessName?.trim()
  if (!businessName) return { queued: false, reason: 'missing_name' }

  const phone = normalizePhone(input.lead.phone || '')
  if (!phone) {
    return { queued: false, reason: 'invalid_phone', detail: input.lead.phone }
  }

  const { data, error } = await getSupabaseAdmin()
    .from('spec_builds')
    .insert({
      status: 'queued',
      lead_source: input.leadSource,
      scraper_lead_id: input.scraperLeadId ?? null,
      scraper_run_id: input.scraperRunId ?? null,
      // Frozen on purpose — the scraper row it came from can be superseded.
      lead_input: { ...input.lead, businessName, phone },
      business_name: businessName,
      phone_e164: phone,
      city: input.lead.city?.trim() || null,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === PG_UNIQUE_VIOLATION) {
      return { queued: false, reason: 'duplicate', detail: phone }
    }
    throw error
  }

  return { queued: true, id: data.id as string }
}

/**
 * Claim a build for a transition. Compare-and-set: the update only lands if the
 * row is still in `from`, so two workers racing the same build cannot both
 * proceed. A false return means someone else got there first — not an error.
 */
export async function transitionSpecBuild(
  id: string,
  from: SpecBuildStatus | SpecBuildStatus[],
  to: SpecBuildStatus,
  patch: Partial<
    Pick<SpecBuildRow, 'last_error' | 'status_reason' | 'attempts' | 'intake_id' | 'tenant_id'>
  > = {}
): Promise<boolean> {
  const fromStatuses = Array.isArray(from) ? from : [from]
  const { data, error } = await getSupabaseAdmin()
    .from('spec_builds')
    .update({ status: to, ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .in('status', fromStatuses)
    .select('id')

  if (error) throw error
  return (data?.length ?? 0) > 0
}

export async function getSpecBuild(id: string): Promise<SpecBuildRow | null> {
  const { data } = await getSupabaseAdmin()
    .from('spec_builds')
    .select(SPEC_BUILD_SELECT)
    .eq('id', id)
    .maybeSingle()
  return (data as SpecBuildRow | null) ?? null
}

/**
 * How many builds started today, against SPEC_BUILD_DAILY_MAX.
 *
 * Counts by `created_at` rather than by a status transition because a build
 * that failed still spent money getting there — the cap has to cover attempts,
 * not successes.
 */
export async function countSpecBuildsStartedToday(): Promise<number> {
  const since = new Date()
  since.setUTCHours(0, 0, 0, 0)
  const { count } = await getSupabaseAdmin()
    .from('spec_builds')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since.toISOString())
  return count ?? 0
}

/** Builds currently mid-pipeline, against SPEC_BUILD_MAX_IN_FLIGHT. */
export async function countSpecBuildsInFlight(): Promise<number> {
  const { count } = await getSupabaseAdmin()
    .from('spec_builds')
    .select('id', { count: 'exact', head: true })
    .in('status', ['researching', 'drafting', 'imaging', 'provisioning', 'building'])
  return count ?? 0
}

/** Mirrors the partial unique index — a closed build frees its phone number. */
export function isClosedStatus(status: SpecBuildStatus): boolean {
  return (SPEC_BUILD_CLOSED_STATUSES as readonly string[]).includes(status)
}
