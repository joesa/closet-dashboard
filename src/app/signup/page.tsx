'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabaseBrowser } from '@/lib/supabase-browser'

export default function SignUpPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <span className="text-sm font-bold tracking-tight text-white animate-pulse">
          Closet<span className="text-slate-400">Quote</span>
        </span>
      </div>
    }>
      <SignUpForm />
    </Suspense>
  )
}

function SignUpForm() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Capture affiliate referral from ?ref= query parameter
  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref) {
      localStorage.setItem('closetquote_ref', ref)
    }
  }, [searchParams])

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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)

    const { error: authError } = await supabaseBrowser.auth.signUp({
      email,
      password,
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    // Full reload so the server proxy sees the freshly-set auth cookies.
    window.location.href = '/dashboard'
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
            Create your account
          </h1>
          <p className="text-sm text-slate-400">
            Set up your contractor dashboard in seconds.
          </p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSignUp}
          className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.02] p-8 backdrop-blur-sm"
        >
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
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between">
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
              >
                Password
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
            disabled={loading}
            className="w-full rounded-lg bg-white px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner /> Creating account…
              </span>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        {/* Footer link */}
        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-medium text-slate-400 transition hover:text-white"
          >
            Sign in
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
