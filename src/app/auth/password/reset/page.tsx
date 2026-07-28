'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { generateStrongPassword } from '@/lib/generateStrongPassword'

export default function PasswordResetPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-slate-400">
          Loading…
        </div>
      }
    >
      <PasswordResetInner />
    </Suspense>
  )
}

function PasswordResetInner() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleGenerate = () => {
    const next = generateStrongPassword(16)
    setPassword(next)
    setConfirmPassword(next)
    setShowPassword(true)
    setError(null)
  }

  const handleCopy = async () => {
    if (!password) return
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!token) {
      setError('Missing reset token. Request a new password reset.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirmPassword }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Could not update password.')
        setLoading(false)
        return
      }
      setDone(true)
    } catch {
      setError('Could not update password.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <Link href="/" className="text-sm font-bold tracking-tight text-white">
            Closet<span className="text-slate-400">Quote</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">Set new password</h1>
          <p className="text-sm text-slate-400">
            Enter a new password. You do not need your old password.
          </p>
        </div>

        {done ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 text-center space-y-4">
            <p className="text-sm text-emerald-300">
              Password updated. You can sign in now.
            </p>
            <Link
              href="/login"
              className="inline-block w-full rounded-lg bg-white px-6 py-3 text-sm font-medium text-black"
            >
              Go to Login
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
              <div className="mb-2 flex items-center justify-between gap-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  New password
                </label>
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="text-xs font-medium text-slate-500 transition hover:text-white"
                >
                  Generate strong password
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-4 py-3 pr-24 text-sm text-white outline-none focus:border-white/30 font-mono"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  {password ? (
                    <button
                      type="button"
                      onClick={() => void handleCopy()}
                      className="text-xs font-medium text-slate-500 hover:text-white"
                    >
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="text-xs font-medium text-slate-500 hover:text-white"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">
                Tip: generate one, copy it somewhere safe, then save.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Confirm password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none focus:border-white/30 font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !token}
              className="w-full rounded-lg bg-white px-6 py-3 text-sm font-medium text-black disabled:opacity-50"
            >
              {loading ? 'Saving…' : 'Save password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
