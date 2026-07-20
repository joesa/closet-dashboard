'use client'

import { listWidgetThemes } from '@/lib/widgetThemes'

type ThemeCard = ReturnType<typeof listWidgetThemes>[number]

/**
 * Shared calculator theme grid for admin + contractor dashboard.
 */
export default function WidgetThemePicker({
  value,
  onChange,
  disabled,
  compact,
}: {
  value: string
  onChange: (theme: ThemeCard) => void
  disabled?: boolean
  /** Tighter grid for the contractor dashboard */
  compact?: boolean
}) {
  const themes = listWidgetThemes()
  const light = themes.filter((t) => t.mode === 'light')
  const dark = themes.filter((t) => t.mode === 'dark')

  const renderGroup = (label: string, items: ThemeCard[]) => (
    <div className="space-y-2">
      <h4
        className={
          compact
            ? 'text-[10px] font-medium uppercase tracking-widest text-zinc-500'
            : 'text-xs font-bold text-neutral-500 uppercase tracking-widest'
        }
      >
        {label} ({items.length})
      </h4>
      <div
        className={
          compact
            ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2'
            : 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2'
        }
      >
        {items.map((theme) => {
          const selected = value === theme.id
          return (
            <button
              key={theme.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(theme)}
              className={`text-left rounded-xl border overflow-hidden transition-colors disabled:opacity-50 ${
                selected
                  ? compact
                    ? 'border-indigo-400 ring-1 ring-indigo-400/40'
                    : 'border-blue-500 ring-1 ring-blue-500/40'
                  : compact
                    ? 'border-white/[0.08] hover:border-white/20'
                    : 'border-neutral-700 hover:border-neutral-500'
              }`}
            >
              <div
                className="h-11 px-2 flex items-end pb-1.5 gap-1"
                style={{ background: theme.surfaceBase }}
              >
                <span
                  className="h-5 flex-1 rounded"
                  style={{ background: theme.surfaceElevated }}
                />
                <span
                  className="h-5 w-5 rounded"
                  style={{ background: theme.brand }}
                />
              </div>
              <div
                className={
                  compact
                    ? 'px-2 py-1.5 bg-black/40'
                    : 'px-2.5 py-2 bg-black/50'
                }
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-medium text-white truncate">
                    {theme.name}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2">
                  {theme.description}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      {renderGroup('Light', light)}
      {renderGroup('Dark', dark)}
    </div>
  )
}
