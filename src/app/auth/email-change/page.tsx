'use client'

import { useState } from 'react'
import Link from 'next/link'
import { DEMO_LOGIN } from '@/lib/demo'

export default function EmailChangeStartPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (email.trim().toLowerCase() === DEMO_LOGIN.email.toLowerCase()) {
      setError('The demo account email cannot be changed.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/email-change/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Request failed')
        setLoading(false)
        return
      }
      setSuccess(true)
    } catch {
      setError('Request failed')
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
          <h1 className="text-2xl font-bold text-white">Change login email</h1>
          <p className="text-sm text-slate-400">
            Enter your current login email. We&apos;ll send a confirmation link
            there before you choose a new address.
          </p>
        </div>

        {success ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 text-center space-y-4">
            <p className="text-sm text-emerald-300">
              If an account exists for that email, check your inbox for a
              confirmation link.
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
                Current email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none focus:border-white/30"
                placeholder="you@company.com"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-white px-6 py-3 text-sm font-medium text-black disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send confirmation email'}
            </button>
            <p className="text-center text-sm text-slate-500">
              <Link href="/login" className="text-slate-300 hover:text-white">
                Back to login
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
