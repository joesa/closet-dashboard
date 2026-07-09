'use client'

import { useEffect } from 'react'
import { clearStaleBrowserAuth, getBrowserUser, supabaseBrowser } from '@/lib/supabase-browser'

/**
 * Clears revoked/missing Supabase refresh tokens so AuthApiError does not
 * spam the console on every navigation. Mount once in the root layout.
 */
export default function AuthSessionRecovery() {
  useEffect(() => {
    let cancelled = false

    void (async () => {
      if (cancelled) return
      await getBrowserUser()
    })()

    const {
      data: { subscription },
    } = supabaseBrowser.auth.onAuthStateChange((event) => {
      // After a failed refresh Supabase emits SIGNED_OUT; ensure cookies are gone.
      if (event === 'SIGNED_OUT') {
        void clearStaleBrowserAuth()
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  return null
}
