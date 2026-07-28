'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function PendingAckPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-slate-400">
          Loading…
        </div>
      }
    >
      <PendingAckInner />
    </Suspense>
  )
}

function PendingAckInner() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || 'your new email'

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-amber-500/30 bg-amber-500/5 p-8 text-center space-y-4">
        <Link href="/" className="text-sm font-bold tracking-tight text-white">
          Ditch<span className="text-slate-400">TheForm</span>
        </Link>
        <h1 className="text-xl font-bold text-white">Check your previous email</h1>
        <p className="text-sm text-amber-100/90">
          Sign-in with <strong>{email}</strong> requires a quick confirmation
          sent to your previous inbox. Open that email and click the confirm
          link, then sign in again.
        </p>
        <Link
          href="/login"
          className="inline-block w-full rounded-lg bg-white px-6 py-3 text-sm font-medium text-black"
        >
          Back to Login
        </Link>
      </div>
    </div>
  )
}
