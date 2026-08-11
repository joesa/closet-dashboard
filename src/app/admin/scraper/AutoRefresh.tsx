'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type AutoRefreshProps = {
  intervalMs?: number
}

export default function AutoRefresh({ intervalMs = 15000 }: AutoRefreshProps) {
  const router = useRouter()
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date>(new Date())
  const [enabled, setEnabled] = useState(true)

  const formattedLastUpdated = useMemo(
    () =>
      lastUpdatedAt.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    [lastUpdatedAt]
  )

  useEffect(() => {
    const timer = setInterval(() => {
      if (!enabled) return

      const active = document.activeElement
      const activeTag = active?.tagName?.toLowerCase() || ''
      const editingField = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select'
      if (editingField) return

      setLastUpdatedAt(new Date())
      router.refresh()
    }, intervalMs)

    return () => clearInterval(timer)
  }, [enabled, intervalMs, router])

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
      <label className="inline-flex items-center gap-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <span>
          Live feedback {enabled ? 'enabled' : 'paused'}: auto-refresh every {Math.round(intervalMs / 1000)}s.
        </span>
      </label>
      <span aria-hidden="true">|</span>
      <span suppressHydrationWarning>Last updated: {formattedLastUpdated}</span>
    </div>
  )
}
