'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function EmailChangeConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-slate-400">
          Loading…
        </div>
      }
    >
      <EmailChangeConfirmInner />
    </Suspense>
  )
}

function EmailChangeConfirmInner() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  const [newEmail, setNewEmail] = useState('')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!token) {
      setError('Missing confirmation token.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/email-change/submit-new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newEmail, confirmEmail }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Could not submit request')
        setLoading(false)
        return
      }
      setDone(true)
    } catch {
      setError('Could not submit request')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <Link href="/" className="text-sm font-bold tracking-tight text-white">
            Ditch<span className="text-slate-400">TheForm</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">Choose new email</h1>
          <p className="text-sm text-slate-400">
            Enter the new login email. An admin must approve before it becomes
            active.
          </p>
        </div>

        {done ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 text-center space-y-4">
            <p className="text-sm text-emerald-300">
              Request submitted for admin review. Keep using your current email
              until it is approved.
            </p>
            <Link
              href="/login"
              className="inline-block w-full rounded-lg bg-white px-6 py-3 text-sm font-medium text-black"
            >
              Return to Login
            </Link>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 space-y-5"
          >
            {error ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            ) : null}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                New email
              </label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none focus:border-white/30"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Confirm new email
              </label>
              <input
                type="email"
                required
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none focus:border-white/30"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !token}
              className="w-full rounded-lg bg-white px-6 py-3 text-sm font-medium text-black disabled:opacity-50"
            >
              {loading ? 'Submitting…' : 'Submit for admin approval'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
