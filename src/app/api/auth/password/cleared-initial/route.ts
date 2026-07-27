import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { clearInitialLoginPassword } from '@/lib/auth/clearInitialLoginPassword'
import { findContractorByUserId } from '@/lib/auth/authUserLookup'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Authenticated: clear initial_login_password after client sets their password
 * (force-password-reset / legacy update-password).
 */
export async function POST() {
  const supabase = await getSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const contractor = await findContractorByUserId(user.id)
  await clearInitialLoginPassword({
    userId: user.id,
    contractorId: contractor?.id,
  })

  return NextResponse.json({ ok: true })
}
