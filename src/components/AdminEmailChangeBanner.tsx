'use client'

import { useCallback, useEffect, useState } from 'react'

type PendingEmailChange = {
  id: string
  old_email: string
  new_email: string | null
  status: string
  created_at: string
  old_confirmed_at: string | null
}

export default function AdminEmailChangeBanner({
  tenantId,
}: {
  tenantId: string
}) {
  const [pending, setPending] = useState<PendingEmailChange | null>(null)
  const [newEmail, setNewEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const refresh = useCallback(async () => {
    setError('')
    try {
      const res = await fetch(
        `/api/admin/sites/${tenantId}/email-change?t=${Date.now()}`,
        { cache: 'no-store' }
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed to load')
      const p = (json.pending || null) as PendingEmailChange | null
      setPending(p)
      setNewEmail(p?.new_email || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    }
  }, [tenantId])

  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0)
    return () => window.clearTimeout(timeout)
  }, [refresh])

  if (!pending && !error && !info) return null

  const act = async (action: 'approve' | 'reject') => {
    setBusy(true)
    setError('')
    setInfo('')
    try {
      const res = await fetch(`/api/admin/sites/${tenantId}/email-change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          newEmail: action === 'approve' ? newEmail : undefined,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Action failed')
      setInfo(
        action === 'approve'
          ? json.message ||
              'Approved. Client must confirm via previous email on first login.'
          : 'Email change request rejected.'
      )
      setPending(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  if (!pending && !info && !error) return null

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-amber-300">
            Email change request
          </p>
          {pending ? (
            <p className="text-sm text-amber-50/90 mt-1">
              Client wants to change login from{' '}
              <code className="font-mono text-amber-100">{pending.old_email}</code>{' '}
              to a new address. Approve to switch Auth + contact email; they must
              then confirm via the previous inbox on first login.
            </p>
          ) : info ? (
            <p className="text-sm text-emerald-200 mt-1">{info}</p>
          ) : null}
        </div>
        {pending ? (
          <button
            type="button"
            onClick={() => void refresh()}
            className="text-xs text-amber-200/80 hover:text-white underline"
          >
            Refresh
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-red-300">{error}</p>
      ) : null}

      {pending ? (
        <>
          <div>
            <label className="text-[11px] uppercase tracking-widest text-amber-200/70 block mb-1">
              New email (editable before approve)
            </label>
            <input
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full rounded-lg bg-black/40 border border-amber-500/30 px-3 py-2 text-sm text-white font-mono"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !newEmail.trim()}
              onClick={() => void act('approve')}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-sm text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-40"
            >
              {busy ? 'Working…' : 'Approve email change'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void act('reject')}
              className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-200 hover:bg-red-500/20 disabled:opacity-40"
            >
              Reject
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}
