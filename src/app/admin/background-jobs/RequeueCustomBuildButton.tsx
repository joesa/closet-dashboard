'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RequeueCustomBuildButton({
  tenantId,
}: {
  tenantId: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          setErr('')
          try {
            const res = await fetch(`/api/admin/sites/${tenantId}/custom-build`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'requeue' }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(json.error || `Failed (${res.status})`)
            router.refresh()
          } catch (e) {
            setErr(e instanceof Error ? e.message : 'Re-queue failed')
          } finally {
            setBusy(false)
          }
        }}
        className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
      >
        {busy ? '…' : 'Re-queue'}
      </button>
      {err ? <span className="text-xs text-red-600">{err}</span> : null}
    </div>
  )
}
