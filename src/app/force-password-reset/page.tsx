'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabaseBrowser, getBrowserUser } from '@/lib/supabase-browser'
import { generateStrongPassword } from '@/lib/generateStrongPassword'

export default function ForcePasswordResetPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    getBrowserUser().then((user) => {
      if (!user) {
        router.replace('/login')
      } else if (!user.user_metadata?.force_password_reset) {
        // If they don't need a reset, send them to dashboard
        router.replace('/dashboard')
      }
      setCheckingSession(false)
    })
  }, [router])

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

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)

    // Update the password and remove the force flag
    const { error: updateError } = await supabaseBrowser.auth.updateUser({
      password: password,
      data: { force_password_reset: false }
    })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    await fetch('/api/auth/password/cleared-initial', { method: 'POST' }).catch(
      () => null
    )

    // Success! Redirect to dashboard.
    router.replace('/dashboard')
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
         <p className="text-slate-500">Verifying session…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="relative w-full max-w-md">
        <div className="mb-10 flex flex-col items-center gap-3 text-center">
          <Link href="/" className="mb-2 text-sm font-bold tracking-tight text-white transition hover:opacity-80">
            Ditch<span className="text-slate-400">TheForm</span>
          </Link>
          <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mb-2">
            <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Action Required
          </h1>
          <p className="text-sm text-amber-400/80 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
            You must change your temporary password before you can access the Dashboard.
          </p>
        </div>

        <form onSubmit={handleUpdate} className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.02] p-8 backdrop-blur-sm">
          {error && (
            <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                New Permanent Password
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
                className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-4 py-3 pr-24 text-sm text-white placeholder:text-slate-600 outline-none focus:border-white/30 focus:bg-white/[0.08] font-mono"
                placeholder="••••••••"
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
              Tip: generate one, copy it somewhere safe, then continue.
            </p>
          </div>

          <div className="mb-8">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Confirm Password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-white/30 focus:bg-white/[0.08] font-mono"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-amber-500 hover:bg-amber-400 px-6 py-3 text-sm font-bold text-amber-950 transition-colors disabled:opacity-50 shadow-lg shadow-amber-500/20"
          >
            {loading ? 'Updating…' : 'Set Password & Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
