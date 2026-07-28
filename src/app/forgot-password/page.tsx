'use client'

import { useState } from 'react'
import Link from 'next/link'
import { DEMO_LOGIN } from '@/lib/demo'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (email.trim().toLowerCase() === DEMO_LOGIN.email.toLowerCase()) {
      setError(
        'The demo account password is fixed and published on the landing page. It cannot be reset from here.'
      )
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Could not start password reset.')
        setLoading(false)
        return
      }
      setSuccess(true)
    } catch {
      setError('Could not start password reset.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="relative w-full max-w-md">
        <div className="mb-10 flex flex-col items-center gap-3">
          <Link href="/" className="mb-2 text-sm font-bold tracking-tight text-white transition hover:opacity-80">
            Ditch<span className="text-slate-400">TheForm</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Reset Password
          </h1>
          <p className="text-sm text-slate-400 text-center">
            Enter your email. We&apos;ll send a verification message, then a second
            email with a link to choose a new password.
          </p>
        </div>

        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.02] p-8 backdrop-blur-sm">
          {success ? (
            <div className="text-center space-y-6">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-sm text-slate-300">
                If an account exists for that email, check your inbox for a
                verification message (step 1 of 2). You can close this window.
              </p>
              <Link
                href="/login"
                className="inline-block w-full rounded-lg bg-white px-6 py-3 text-sm font-medium text-black text-center transition-colors hover:bg-gray-200"
              >
                Return to Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-5">
              {error && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-white/30 focus:bg-white/[0.08]"
                  placeholder="you@company.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-white px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:opacity-50"
              >
                {loading ? 'Sending…' : 'Send verification email'}
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
    </div>
  )
}
