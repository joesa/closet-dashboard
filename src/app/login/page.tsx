'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabaseBrowser } from '@/lib/supabase-browser'

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <span className="text-sm font-bold tracking-tight text-white animate-pulse">
          Closet<span className="text-slate-400">Quote</span>
        </span>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [resetSent, setResetSent] = useState(false)

  // Pre-fill from URL query (used by the landing-page "try our demo" link to
  // drop the demo creds straight into the form). The demo password is public
  // on the marketing site, so prefilling via query string is intentional.
  useEffect(() => {
    const qEmail = searchParams.get('email')
    const qPassword = searchParams.get('password')
    if (qEmail) setEmail(qEmail)
    if (qPassword) setPassword(qPassword)
  }, [searchParams])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setResetSent(false)
    setLoading(true)

    const { error: authError } = await supabaseBrowser.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      const newAttempts = failedAttempts + 1
      if (newAttempts >= 5) {
        await supabaseBrowser.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/update-password`,
        })
        setResetSent(true)
        setFailedAttempts(0)
        setError(null)
      } else {
        setFailedAttempts(newAttempts)
        setError(authError.message)
      }
      setLoading(false)
      return
    }

    // Use a full reload so the server proxy sees the fresh auth cookies.
    // router.push alone may serve a cached RSC payload from before login.
    const next = searchParams.get('next') || '/dashboard'
    window.location.href = next
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
            Welcome back
          </h1>
          <p className="text-sm text-slate-400">
            Enter your credentials to continue.
          </p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleLogin}
          className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.02] p-8 backdrop-blur-sm"
        >
          {/* Reset notice */}
          {resetSent && (
            <div className="mb-6 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
              Too many failed attempts. A password reset link has been sent to your email.
            </div>
          )}
          {/* Error */}
          {error && (
            <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Email */}
          <div className="mb-5">
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
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none transition-colors focus:border-white/30 focus:bg-white/[0.08]"
            />
          </div>

          {/* Password */}
          <div className="mb-8">
            <div className="mb-2 flex items-center justify-between">
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-slate-500 transition hover:text-white"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none transition-colors focus:border-white/30 focus:bg-white/[0.08]"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-white px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner /> Signing in…
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Footer link */}
        <p className="mt-6 text-center text-sm text-slate-500">
          Don&apos;t have an account?{' '}
          <Link
            href="/signup"
            className="font-medium text-slate-400 transition hover:text-white"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin text-black"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}
