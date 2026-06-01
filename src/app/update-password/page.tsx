'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabaseBrowser, getBrowserUser } from '@/lib/supabase-browser'
import { DEMO_LOGIN } from '@/lib/demo'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isDemoUser, setIsDemoUser] = useState(false)

  // We only want to allow updates if the user has an active session
  // (which Supabase automatically sets from the hash in the URL when they click the reset link)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    getBrowserUser().then((user) => {
      if (!user) {
        setError('Your password reset link is invalid or has expired.')
      } else if (
        user.email?.toLowerCase() === DEMO_LOGIN.email.toLowerCase()
      ) {
        // Demo account is shared. Block password changes from the UI so
        // a curious prospect can't lock out the next visitor. The nightly
        // cron + a Postgres trigger on auth.users enforce the same rule
        // server-side; this just keeps the UX clean.
        setIsDemoUser(true)
        setError(
          'This is the shared demo account. Its password is fixed and managed by the ClosetQuote team.'
        )
      }
      setCheckingSession(false)
    })
  }, [])

  const handleGeneratePassword = () => {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-='
    let newPassword = ''
    for (let i = 0; i < 16; i++) {
      newPassword += charset.charAt(Math.floor(Math.random() * charset.length))
    }
    setPassword(newPassword)
    setConfirmPassword(newPassword)
    setShowPassword(true)
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (isDemoUser) {
      setError(
        'This is the shared demo account. Its password is fixed and managed by the ClosetQuote team.'
      )
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)

    const { error: updateError } = await supabaseBrowser.auth.updateUser({
      password: password,
    })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    // Success! Redirect to dashboard.
    router.replace('/dashboard')
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
         <p className="text-slate-500">Verifying secure link…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="relative w-full max-w-md">
        {/* Logo & Header */}
        <div className="mb-10 flex flex-col items-center gap-3">
          <Link href="/" className="mb-2 text-sm font-bold tracking-tight text-white transition hover:opacity-80">
            Closet<span className="text-slate-400">Quote</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Set New Password
          </h1>
          <p className="text-sm text-slate-400">
            Please enter your new password below.
          </p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleUpdate}
          className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.02] p-8 backdrop-blur-sm"
        >
          {error && (
            <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
              {error}
              {error.includes('expired') && (
                <div className="mt-2">
                  <Link href="/forgot-password" className="font-medium underline hover:text-red-300">
                    Request a new link
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* New Password */}
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between">
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
              >
                New Password
              </label>
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="text-xs font-medium text-slate-500 transition hover:text-white"
              >
                Generate strong password
              </button>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-4 py-3 pr-16 text-sm text-white placeholder:text-slate-600 outline-none transition-colors focus:border-white/30 focus:bg-white/[0.08]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500 hover:text-white transition"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="mb-8">
            <label
              htmlFor="confirmPassword"
              className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400"
            >
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none transition-colors focus:border-white/30 focus:bg-white/[0.08]"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !!error?.includes('expired') || isDemoUser}
            className="w-full rounded-lg bg-white px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:opacity-50"
          >
            {loading ? 'Updating…' : isDemoUser ? 'Disabled for demo account' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
