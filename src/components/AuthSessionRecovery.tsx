'use client'

import { useEffect } from 'react'
import { getBrowserSession, getBrowserUser } from '@/lib/supabase-browser'

/**
 * Clears revoked/missing Supabase refresh tokens so AuthApiError does not
 * spam the console on every navigation. Mount once in the root layout.
 *
 * Important: do not call getUser() when there is no local session, and do not
 * re-enter signOut on every SIGNED_OUT event — that deadlocks the auth lock
 * and freezes the tab (Chrome "Page Unresponsive").
 */
export default function AuthSessionRecovery() {
  useEffect(() => {
    let cancelled = false

    void (async () => {
      if (cancelled) return
      const session = await getBrowserSession()
      if (cancelled || !session) return
      // Session cookie present — validate once; getBrowserUser times out +
      // clears local cookies if the refresh token is dead.
      await getBrowserUser()
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return null
}
