'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function PasswordVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-slate-400">
          Verifying…
        </div>
      }
    >
      <PasswordVerifyInner />
    </Suspense>
  )
}

function PasswordVerifyInner() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Missing verification token.')
      return
    }
    void (async () => {
      try {
        const res = await fetch('/api/auth/password/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          setStatus('error')
          setMessage(json.error || 'Verification failed.')
          return
        }
        setStatus('ok')
        setMessage(
          json.message ||
            'Identity verified. Check your email for a link to set your new password.'
        )
      } catch {
        setStatus('error')
        setMessage('Verification failed. Try requesting a new reset.')
      }
    })()
  }, [token])

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.02] p-8 text-center space-y-4">
        <Link href="/" className="text-sm font-bold tracking-tight text-white">
          Closet<span className="text-slate-400">Quote</span>
        </Link>
        <h1 className="text-xl font-bold text-white">Verify identity</h1>
        {status === 'loading' ? (
          <p className="text-sm text-slate-400">Confirming your request…</p>
        ) : (
          <p
            className={`text-sm ${status === 'ok' ? 'text-emerald-300' : 'text-red-400'}`}
          >
            {message}
          </p>
        )}
        <Link
          href="/login"
          className="inline-block w-full rounded-lg bg-white px-6 py-3 text-sm font-medium text-black"
        >
          Return to Login
        </Link>
      </div>
    </div>
  )
}
