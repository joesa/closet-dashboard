'use client'

import { useState } from 'react'

/**
 * Accept or decline. Declining is given equal weight on purpose: this is an
 * unsolicited approach, so "no" must be as easy as "yes" — and a clear decline
 * lets us take the site down straight away instead of texting them again.
 */
export default function OfferActions({
  token,
  businessName,
}: {
  token: string
  businessName: string
}) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'accepted' | 'declined'>('idle')
  const [error, setError] = useState('')

  const submit = async (action: 'accept' | 'decline') => {
    setState('sending')
    setError('')
    try {
      const res = await fetch(`/api/offer/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, email }),
      })
      const text = await res.text()
      let json: { error?: string } = {}
      try {
        json = JSON.parse(text)
      } catch {
        throw new Error('Something went wrong on our end. Please reply to the text instead.')
      }
      if (!res.ok) throw new Error(json.error || 'Something went wrong. Please try again.')
      setState(action === 'accept' ? 'accepted' : 'declined')
    } catch (err) {
      setState('idle')
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  if (state === 'accepted') {
    return (
      <div className="mt-8 rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
        Thanks — we&apos;ll follow up shortly about the details, revisions, and a domain name.
      </div>
    )
  }

  if (state === 'declined') {
    return (
      <div className="mt-8 rounded-lg border border-gray-200 bg-gray-50 px-5 py-4 text-sm text-gray-700">
        Understood — we&apos;ll take the site down and won&apos;t contact you again about it.
      </div>
    )
  }

  return (
    <div className="mt-8">
      <label className="block text-sm font-medium text-gray-700">
        Your email, if you want the handoff
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@yourbusiness.com"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </label>
      <p className="mt-1 text-xs text-gray-500">
        Only so we can send {businessName} the access details. We won&apos;t add you to any list.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={state === 'sending' || !email.trim()}
          onClick={() => void submit('accept')}
          className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {state === 'sending' ? 'Sending…' : 'Yes — send the details'}
        </button>
        <button
          type="button"
          disabled={state === 'sending'}
          onClick={() => void submit('decline')}
          className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Not interested
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
