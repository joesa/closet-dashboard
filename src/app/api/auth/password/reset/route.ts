import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  consumeAuthEmailToken,
  findValidAuthEmailToken,
} from '@/lib/auth/emailTokens'
import { clearInitialLoginPassword } from '@/lib/auth/clearInitialLoginPassword'
import { findContractorByUserId } from '@/lib/auth/authUserLookup'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Step 3: set new password from password_reset token (no old password required).
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const confirm =
    typeof body.confirmPassword === 'string' ? body.confirmPassword : password

  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: 'Password must be at least 6 characters.' },
      { status: 400 }
    )
  }
  if (password !== confirm) {
    return NextResponse.json(
      { error: 'Passwords do not match.' },
      { status: 400 }
    )
  }

  const row = await findValidAuthEmailToken(token, 'password_reset')
  if (!row || !row.user_id) {
    return NextResponse.json(
      { error: 'This reset link is invalid or expired.' },
      { status: 400 }
    )
  }

  const supabase = getSupabaseAdmin()
  const { data: existing } = await supabase.auth.admin.getUserById(row.user_id)
  const prevMeta =
    (existing?.user?.user_metadata as Record<string, unknown> | undefined) || {}

  const { error: updateErr } = await supabase.auth.admin.updateUserById(
    row.user_id,
    {
      password,
      user_metadata: {
        ...prevMeta,
        force_password_reset: false,
      },
    }
  )
  if (updateErr) {
    return NextResponse.json(
      { error: updateErr.message || 'Failed to update password' },
      { status: 400 }
    )
  }

  await consumeAuthEmailToken(row.id)

  const contractor = await findContractorByUserId(row.user_id)
  await clearInitialLoginPassword({
    userId: row.user_id,
    contractorId: contractor?.id || row.contractor_id,
  })

  return NextResponse.json({
    ok: true,
    message: 'Password updated. You can sign in with your new password.',
  })
}
