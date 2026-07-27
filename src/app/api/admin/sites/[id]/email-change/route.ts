import { NextResponse } from 'next/server'
import { getCurrentAdmin, logAdminAction } from '@/lib/admin'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { resolveTenantWidget } from '@/lib/resolveTenantWidget'
import { normalizeEmail } from '@/lib/auth/authUserLookup'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
}

/** Admin approve/reject pending email change for a tenant. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await getCurrentAdmin()
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: tenantId } = await params
  const resolved = await resolveTenantWidget(tenantId)
  if ('error' in resolved) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status, headers: NO_STORE }
    )
  }
  const { widgetId } = resolved
  const body = await req.json().catch(() => ({}))
  const action = body.action === 'reject' ? 'reject' : body.action === 'approve' ? 'approve' : null
  if (!action) {
    return NextResponse.json(
      { error: 'action must be approve or reject' },
      { status: 400 }
    )
  }

  const supabase = getSupabaseAdmin()
  const { data: pending } = await supabase
    .from('email_change_requests')
    .select('*')
    .eq('contractor_id', widgetId)
    .eq('status', 'pending_admin')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!pending) {
    return NextResponse.json(
      { error: 'No pending email change request' },
      { status: 404, headers: NO_STORE }
    )
  }

  if (action === 'reject') {
    await supabase
      .from('email_change_requests')
      .update({
        status: 'rejected',
        admin_reviewed_at: new Date().toISOString(),
        admin_actor_id: adminUser.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pending.id)

    await logAdminAction({
      actor: adminUser,
      action: 'site.email_change_reject',
      targetType: 'tenant',
      targetId: tenantId,
      metadata: { requestId: pending.id, oldEmail: pending.old_email },
    })

    return NextResponse.json({ ok: true, status: 'rejected' }, { headers: NO_STORE })
  }

  const newEmail = normalizeEmail(
    typeof body.newEmail === 'string' && body.newEmail.trim()
      ? body.newEmail
      : pending.new_email || ''
  )
  if (!newEmail || !newEmail.includes('@')) {
    return NextResponse.json(
      { error: 'New email required to approve' },
      { status: 400 }
    )
  }

  const userId = pending.user_id as string | null
  if (!userId) {
    return NextResponse.json(
      { error: 'Request has no linked auth user' },
      { status: 400 }
    )
  }

  const { data: existingAuth } = await supabase.auth.admin.getUserById(userId)
  const prevMeta =
    (existingAuth?.user?.user_metadata as Record<string, unknown> | undefined) ||
    {}

  const { error: authErr } = await supabase.auth.admin.updateUserById(userId, {
    email: newEmail,
    email_confirm: true,
    user_metadata: {
      ...prevMeta,
      email_change_previous: pending.old_email,
    },
  })
  if (authErr) {
    return NextResponse.json(
      { error: `Failed to update auth email: ${authErr.message}` },
      { status: 400, headers: NO_STORE }
    )
  }

  await supabase
    .from('contractor_settings')
    .update({
      contact_email: newEmail,
      email_change_requires_old_ack: true,
      email_change_previous_email: pending.old_email,
    })
    .eq('id', widgetId)

  await supabase
    .from('email_change_requests')
    .update({
      new_email: newEmail,
      status: 'approved',
      admin_reviewed_at: new Date().toISOString(),
      admin_actor_id: adminUser.id,
      activated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', pending.id)

  await logAdminAction({
    actor: adminUser,
    action: 'site.email_change_approve',
    targetType: 'tenant',
    targetId: tenantId,
    metadata: {
      requestId: pending.id,
      oldEmail: pending.old_email,
      newEmail,
    },
  })

  return NextResponse.json(
    {
      ok: true,
      status: 'approved',
      newEmail,
      message:
        'Email updated. Client must confirm via their previous inbox on first login with the new address.',
    },
    { headers: NO_STORE }
  )
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await getCurrentAdmin()
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: tenantId } = await params
  const resolved = await resolveTenantWidget(tenantId)
  if ('error' in resolved) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status, headers: NO_STORE }
    )
  }

  const supabase = getSupabaseAdmin()
  const { data: pending } = await supabase
    .from('email_change_requests')
    .select(
      'id, old_email, new_email, status, created_at, old_confirmed_at'
    )
    .eq('contractor_id', resolved.widgetId)
    .eq('status', 'pending_admin')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ pending: pending || null }, { headers: NO_STORE })
}
