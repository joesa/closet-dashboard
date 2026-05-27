'use client'

import { useMemo, useState } from 'react'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

type AutoRefreshProps = {
  intervalMs?: number
}

export default function AutoRefresh({ intervalMs = 15000 }: AutoRefreshProps) {
  const router = useRouter()
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date>(new Date())

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
      setLastUpdatedAt(new Date())
      router.refresh()
    }, intervalMs)

    return () => clearInterval(timer)
  }, [intervalMs, router])

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
      <span>Live feedback enabled: auto-refresh every {Math.round(intervalMs / 1000)}s.</span>
      <span aria-hidden="true">|</span>
      <span>Last updated: {formattedLastUpdated}</span>
    </div>
  )
}
