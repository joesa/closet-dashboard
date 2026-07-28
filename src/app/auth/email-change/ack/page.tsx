'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function EmailChangeAckPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-slate-400">
          Confirming…
        </div>
      }
    >
      <EmailChangeAckInner />
    </Suspense>
  )
}

function EmailChangeAckInner() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Missing confirmation token.')
      return
    }
    void (async () => {
      try {
        const res = await fetch('/api/auth/email-change/ack', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          setStatus('error')
          setMessage(json.error || 'Confirmation failed.')
          return
        }
        setStatus('ok')
        setMessage(
          json.message ||
            'Email change confirmed. You can sign in with your new email.'
        )
      } catch {
        setStatus('error')
        setMessage('Confirmation failed.')
      }
    })()
  }, [token])

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.02] p-8 text-center space-y-4">
        <Link href="/" className="text-sm font-bold tracking-tight text-white">
          Ditch<span className="text-slate-400">TheForm</span>
        </Link>
        <h1 className="text-xl font-bold text-white">Confirm new email</h1>
        {status === 'loading' ? (
          <p className="text-sm text-slate-400">Activating…</p>
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
          Go to Login
        </Link>
      </div>
    </div>
  )
}
