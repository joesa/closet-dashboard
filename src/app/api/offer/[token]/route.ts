import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { logSystemAction } from '@/lib/admin'
import { checkRateLimit, hashRateKey } from '@/lib/rateLimit'
import { purgeGraceHours } from '@/lib/spec/specOffer'
import { adoptSpecBuild } from '@/lib/spec/adoptSpecBuild'
import { SPEC_BUILD_SELECT, type SpecBuildRow } from '@/lib/spec/types'

export const runtime = 'nodejs'

/**
 * The business owner's answer.
 *
 * Public and unauthenticated — the offer token is the only credential, which is
 * right for someone we cold-texted: making them create an account to say "no
 * thanks" would be absurd. Rate-limited per token so a leaked link cannot be
 * used to hammer the endpoint.
 *
 * Accepting does not charge anything or provision anything. It records interest
 * and stops the clock; a human takes it from there. Declining schedules the
 * purge immediately rather than waiting for the deadline — they have said no,
 * so there is no reason to keep their name on our infrastructure.
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const limit = await checkRateLimit(hashRateKey('spec_offer_reply', token), 20, 60 * 60 * 1000)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many attempts. Try again shortly.' }, { status: 429 })
  }

  const body = (await req.json().catch(() => ({}))) as { action?: string; email?: string }
  const action = body.action === 'accept' ? 'accept' : body.action === 'decline' ? 'decline' : null
  if (!action) {
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  }

  const email = (body.email || '').trim()
  if (action === 'accept' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter an email so we can reach you.' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('spec_builds')
    .select(SPEC_BUILD_SELECT)
    .eq('offer_token', token)
    .maybeSingle()

  const build = data as SpecBuildRow | null
  if (!build) {
    return NextResponse.json({ error: 'This offer link is no longer valid.' }, { status: 404 })
  }

  const open = ['approved', 'offer_sent', 'offer_reminded'].includes(build.status)
  if (!open) {
    return NextResponse.json(
      { error: 'This offer has already closed. Reply to the text and we can rebuild it.' },
      { status: 410 }
    )
  }
  if (build.offer_deadline_at && new Date(build.offer_deadline_at).getTime() < Date.now()) {
    return NextResponse.json(
      { error: 'This offer expired. Reply to the text and we can rebuild it.' },
      { status: 410 }
    )
  }

  const now = new Date().toISOString()
  const patch =
    action === 'accept'
      ? {
          status: 'accepted',
          responded_at: now,
          // Their real address, recorded only now that they have asked for
          // contact. Everything before this point used a platform placeholder.
          lead_input: { ...(build.lead_input ?? {}), acceptedEmail: email },
          status_reason: null,
        }
      : {
          status: 'declined',
          responded_at: now,
          purge_after: new Date(Date.now() + purgeGraceHours() * 3600_000).toISOString(),
          status_reason: 'The owner said no thanks.',
        }

  const { error } = await supabase
    .from('spec_builds')
    .update({ ...patch, updated_at: now })
    .eq('id', build.id)
    .in('status', ['approved', 'offer_sent', 'offer_reminded'])

  if (error) {
    return NextResponse.json({ error: 'Could not record that. Please try again.' }, { status: 500 })
  }

  // Hand the site over. Deliberately after the status is committed: if adoption
  // fails we still have a durable record that they said yes, and an admin can
  // finish it by hand. Losing the "yes" because an email bounced would be far
  // worse than an adoption that needs retrying.
  if (action === 'accept') {
    const adopted = await adoptSpecBuild({ ...build, status: 'accepted' }, email).catch((err) => {
      console.error('[offer] adoption threw', build.id, err)
      return { ok: false as const, reason: 'adoption_threw' }
    })
    if (!adopted.ok) {
      await supabase
        .from('spec_builds')
        .update({
          status_reason: `Accepted, but handover needs a human: ${adopted.reason}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', build.id)
    }
  }

  await logSystemAction({
    action: action === 'accept' ? 'spec_build.accepted' : 'spec_build.declined',
    targetType: 'spec_build',
    targetId: build.id,
    metadata: { businessName: build.business_name },
  })

  return NextResponse.json({ ok: true })
}
