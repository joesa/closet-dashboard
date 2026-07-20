'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import WidgetThemePicker from '@/components/WidgetThemePicker'
import {
  PRICING_TIERS,
  ROOM_TYPES,
  type DomainConfig,
  type PricingModel,
  type PricingTier,
  type RoomPricing,
  type RoomType,
} from '@/lib/rooms'

type EngagementModel = 'quote' | 'order' | 'booking' | 'ticket'

type CustomRoom = {
  id: string
  name: string
  price_basic: number
  price_standard: number
  price_premium: number
}

type CustomFinish = {
  id: string
  label: string
  description: string | null
  swatch_hex: string
  tier: PricingTier
  sort_order: number
}

type Addon = {
  id: string
  room_type: string | null
  room_types?: string[] | null
  name: string
  price: number
}

type Step1Category = {
  kind: 'default' | 'custom'
  id: string
  name: string
  prices: { basic: number; standard: number; premium: number }
}

type Catalog = {
  menuItems: Array<{
    id: string
    name: string
    description?: string
    price: number
    category?: string
  }>
  services: Array<{
    id: string
    name: string
    duration_minutes: number
    price_cents: number
  }>
  availability: Array<{
    id: string
    day_of_week: number
    start_time: string
    end_time: string
  }>
  events: Array<{
    id: string
    name: string
    event_date: string
    event_time: string
    venue?: string
    capacity: number
    price_cents: number
  }>
}

type ThemeOption = {
  id: string
  name: string
  mode: 'light' | 'dark'
  description: string
  brand: string
  surfaceBase: string
  surfaceElevated: string
  textPrimary: string
}

type Payload = {
  widgetId: string
  settingsUpdatedAt?: string | null
  healedWidgetId?: boolean
  engagementModel: EngagementModel
  widgetThemeId?: string
  widgetThemes?: ThemeOption[]
  settings: {
    companyName: string
    primaryColorHex: string
    roomPricing: RoomPricing
    domainConfig: DomainConfig
    tierNames: { basic: string; standard: string; premium: string }
    disabledDefaultRooms: string[]
    disabledDefaultFinishes: string[]
    widgetThemeId?: string
  } | null
  calculator: {
    step1Categories: Step1Category[]
    customRooms: CustomRoom[]
    customFinishes: CustomFinish[]
    addons: Addon[]
    systemRoomTypes: string[]
  }
  catalog: Catalog
}

const MODEL_OPTIONS: { id: EngagementModel; label: string; hint: string }[] = [
  { id: 'quote', label: 'Quote calculator', hint: 'Estimate → lead capture' },
  { id: 'order', label: 'Online ordering', hint: 'Menu → cart → submit' },
  { id: 'booking', label: 'Booking', hint: 'Services → pick a slot' },
  { id: 'ticket', label: 'Ticketing', hint: 'Events → buy tickets' },
]

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const DEFAULT_FINISH_META: Record<PricingTier, { label: string; swatch: string }> = {
  basic: { label: 'White Melamine', swatch: '#F4F1EC' },
  standard: { label: 'Textured Wood', swatch: '#A0744A' },
  premium: { label: 'Custom Paint', swatch: '#3A4750' },
}

const PRICING_MODELS: { id: PricingModel; label: string }[] = [
  { id: 'per_unit', label: 'Per unit (e.g. $/ft)' },
  { id: 'flat_tiered', label: 'Flat tiered (package price)' },
  { id: 'base_plus_distance', label: 'Base + distance' },
]

/**
 * Per-tenant engagement tools. For quote mode, loads the exact live calculator
 * state (Step 1 categories = defaults − disabled + contractor_rooms).
 */
export default function AdminEngagementTools({ tenantId }: { tenantId: string }) {
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [showHiddenDefaults, setShowHiddenDefaults] = useState(false)

  const [model, setModel] = useState<EngagementModel>('quote')
  const [companyName, setCompanyName] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#6C47FF')
  const [roomPricing, setRoomPricing] = useState<RoomPricing | null>(null)
  const [domainConfig, setDomainConfig] = useState<DomainConfig | null>(null)
  const [tierNames, setTierNames] = useState({
    basic: 'Basic',
    standard: 'Standard',
    premium: 'Premium',
  })
  const [disabledRooms, setDisabledRooms] = useState<string[]>([])
  const [disabledFinishes, setDisabledFinishes] = useState<string[]>([])
  const [widgetThemeId, setWidgetThemeId] = useState('alabaster')
  const [widgetThemes, setWidgetThemes] = useState<ThemeOption[]>([])

  const [newRoom, setNewRoom] = useState({
    name: '',
    price_basic: 0,
    price_standard: 0,
    price_premium: 0,
  })
  const [newFinish, setNewFinish] = useState({
    label: '',
    swatch_hex: '#A78B6A',
    tier: 'standard' as PricingTier,
  })
  const [newAddon, setNewAddon] = useState({ name: '', price: 0 })

  const [newMenu, setNewMenu] = useState({
    name: '',
    description: '',
    price: 0,
    category: 'Menu',
  })
  const [newService, setNewService] = useState({
    name: '',
    duration_minutes: 60,
    price_cents: 0,
  })
  const [newAvail, setNewAvail] = useState({
    day_of_week: 1,
    start_time: '09:00',
    end_time: '17:00',
  })
  const [newEvent, setNewEvent] = useState({
    name: '',
    venue: '',
    event_date: '',
    event_time: '19:00',
    capacity: 100,
    price_cents: 0,
  })

  const refresh = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) setError('')
    try {
      // Always hit the live contractor_settings row (no browser/CDN cache).
      const res = await fetch(
        `/api/admin/sites/${tenantId}/engagement?t=${Date.now()}`,
        { cache: 'no-store' }
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Failed to load engagement tools')
      const payload = json as Payload
      setData(payload)
      setModel(payload.engagementModel)
      setWidgetThemes(Array.isArray(payload.widgetThemes) ? payload.widgetThemes : [])
      setWidgetThemeId(
        payload.settings?.widgetThemeId || payload.widgetThemeId || 'alabaster'
      )
      if (payload.settings) {
        setCompanyName(payload.settings.companyName)
        setPrimaryColor(payload.settings.primaryColorHex)
        setRoomPricing(payload.settings.roomPricing)
        setDomainConfig(payload.settings.domainConfig)
        setTierNames(payload.settings.tierNames)
        setDisabledRooms(payload.settings.disabledDefaultRooms || [])
        setDisabledFinishes(payload.settings.disabledDefaultFinishes || [])
      } else {
        setRoomPricing(null)
        setDomainConfig(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Re-load when admin returns to the tab so client dashboard edits show up.
  useEffect(() => {
    const onFocus = () => {
      void refresh({ quiet: true })
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') onFocus()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refresh])

  const categoryLabel = domainConfig?.categoryLabel || 'Room'
  const unitLabel = domainConfig?.unitLabel || 'unit'
  const customRooms = data?.calculator.customRooms || []
  const step1 = data?.calculator.step1Categories || []

  const hiddenDefaults = useMemo(
    () => ROOM_TYPES.filter((r) => disabledRooms.includes(r)),
    [disabledRooms]
  )

  const saveSettings = async (extra?: {
    disabledDefaultRooms?: string[]
    disabledDefaultFinishes?: string[]
  }) => {
    setSaving(true)
    setError('')
    setInfo('')
    try {
      const body: Record<string, unknown> = { engagementModel: model }
      const settings: Record<string, unknown> = {
        companyName,
        primaryColorHex: primaryColor,
      }
      if (model === 'quote' && roomPricing && domainConfig) {
        settings.roomPricing = roomPricing
        settings.domainConfig = domainConfig
        settings.tierNames = tierNames
        settings.disabledDefaultRooms = extra?.disabledDefaultRooms ?? disabledRooms
        settings.disabledDefaultFinishes =
          extra?.disabledDefaultFinishes ?? disabledFinishes
        settings.widgetThemeId = widgetThemeId
      }
      body.settings = settings
      const res = await fetch(`/api/admin/sites/${tenantId}/engagement`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Save failed')
      if (json.liveNow === false) {
        setInfo(
          'Saved, but site cache bust failed — visitors may see the previous engagement widget for up to ~60s.'
        )
      } else {
        setInfo('Saved. Live site and widget pick this up on next load.')
      }
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const patchJson = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/sites/${tenantId}/engagement`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error || 'Update failed')
  }

  const addItem = async (kind: string, itemData: Record<string, unknown>) => {
    setError('')
    setInfo('')
    const res = await fetch(`/api/admin/sites/${tenantId}/engagement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, data: itemData }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json.error || 'Add failed')
      return false
    }
    setInfo('Added.')
    await refresh()
    return true
  }

  const deleteItem = async (kind: string, id: string) => {
    setError('')
    const res = await fetch(`/api/admin/sites/${tenantId}/engagement`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, id }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json.error || 'Delete failed')
      return
    }
    await refresh()
  }

  const setDefaultRoomEnabled = async (room: RoomType, enabled: boolean) => {
    const next = enabled
      ? disabledRooms.filter((r) => r !== room)
      : [...disabledRooms, room]
    setDisabledRooms(next)
    try {
      await patchJson({
        settings: { disabledDefaultRooms: next },
      })
      setInfo(enabled ? `Enabled “${room}” in calculator.` : `Hid “${room}” from calculator.`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
      await refresh()
    }
  }

  const setDefaultFinishEnabled = async (tier: PricingTier, enabled: boolean) => {
    const next = enabled
      ? disabledFinishes.filter((t) => t !== tier)
      : [...disabledFinishes, tier]
    setDisabledFinishes(next)
    try {
      await patchJson({
        settings: { disabledDefaultFinishes: next },
      })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
      await refresh()
    }
  }

  const setRoomPrice = (room: RoomType, tier: PricingTier, value: number) => {
    setRoomPricing((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        [room]: { ...prev[room], [tier]: value },
      }
    })
  }

  const updateCustomRoomPrice = async (
    roomId: string,
    tier: PricingTier,
    value: number
  ) => {
    const col =
      tier === 'basic'
        ? 'price_basic'
        : tier === 'standard'
          ? 'price_standard'
          : 'price_premium'
    try {
      await patchJson({ roomUpdate: { id: roomId, [col]: value } })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Price update failed')
    }
  }

  if (loading) {
    return (
      <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-2">Engagement tools</h2>
        <p className="text-sm text-neutral-500">Loading live calculator state…</p>
      </section>
    )
  }

  if (!data) {
    return (
      <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-2">Engagement tools</h2>
        <p className="text-sm text-red-400">{error || 'Unavailable'}</p>
      </section>
    )
  }

  return (
    <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Engagement tools</h2>
          <p className="text-sm text-neutral-400 mt-1">
            Live-linked to the same{' '}
            <code className="text-xs text-blue-300 font-mono">{data.widgetId}</code>{' '}
            row the client dashboard and public widget use. Client edits appear
            here on load / refresh.
          </p>
          {data.settingsUpdatedAt ? (
            <p className="text-xs text-neutral-500 mt-1">
              Settings last updated{' '}
              {new Date(data.settingsUpdatedAt).toLocaleString()}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="shrink-0 px-3 py-1.5 rounded-lg border border-neutral-700 text-sm text-neutral-300 hover:border-neutral-500 hover:text-white"
        >
          Refresh from live
        </button>
      </div>

      {error ? (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </div>
      ) : null}
      {info ? (
        <div className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
          {info}
        </div>
      ) : null}

      <div>
        <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest block mb-2">
          Engagement model
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {MODEL_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setModel(opt.id)}
              className={`text-left rounded-lg border px-4 py-3 transition-colors ${
                model === opt.id
                  ? 'border-blue-500 bg-blue-500/10 text-white'
                  : 'border-neutral-700 bg-black/30 text-neutral-300 hover:border-neutral-500'
              }`}
            >
              <div className="font-medium text-sm">{opt.label}</div>
              <div className="text-xs text-neutral-500 mt-0.5">{opt.hint}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-neutral-500 uppercase tracking-widest block mb-1">
            Company name
          </label>
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full rounded-lg bg-black/40 border border-neutral-700 px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="text-xs text-neutral-500 uppercase tracking-widest block mb-1">
            Accent (from theme pack)
          </label>
          <div className="flex gap-2 items-center">
            <span
              className="h-10 w-12 rounded border border-neutral-700"
              style={{ background: primaryColor }}
              title={primaryColor}
            />
            <code className="flex-1 rounded-lg bg-black/40 border border-neutral-700 px-3 py-2 text-sm text-neutral-300 font-mono">
              {primaryColor}
            </code>
          </div>
        </div>
      </div>

      {/* ── Quote calculator (live state) ─────────────────────────── */}
      {model === 'quote' && roomPricing && domainConfig ? (
        <div className="space-y-6 border-t border-neutral-800 pt-4">
          {/* Theme picker */}
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Calculator theme</h3>
              <p className="text-xs text-neutral-500 mt-1">
                {widgetThemes.length || 50} matched packs (surfaces, text, borders,
                accent). Pick one so the calculator blends with the site — e.g.
                Charcoal Stage / Velvet Cinema on dark AV sites.
              </p>
            </div>
            <WidgetThemePicker
              value={widgetThemeId}
              onChange={(theme) => {
                setWidgetThemeId(theme.id)
                setPrimaryColor(theme.brand)
                void (async () => {
                  try {
                    await patchJson({
                      settings: { widgetThemeId: theme.id },
                    })
                    setInfo(
                      `Theme “${theme.name}” applied — live on next widget load.`
                    )
                    await refresh({ quiet: true })
                  } catch (err) {
                    setError(
                      err instanceof Error ? err.message : 'Theme save failed'
                    )
                  }
                })()
              }}
            />
          </div>

          {/* Live Step 1 mirror */}
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Live Step 1 — Select Your {categoryLabel}
                </h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Exactly what visitors see in the calculator ({step1.length} option
                  {step1.length === 1 ? '' : 's'}).
                </p>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-blue-300/80 font-medium">
                Live baseline
              </span>
            </div>
            {step1.length === 0 ? (
              <p className="text-sm text-amber-300">
                No categories visible — add a custom {categoryLabel.toLowerCase()} below
                or re-enable a system default.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {step1.map((c) => (
                  <span
                    key={`${c.kind}-${c.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-600 bg-black/40 px-3 py-2 text-sm text-white"
                  >
                    {c.name}
                    {c.kind === 'custom' ? (
                      <span className="text-[9px] uppercase tracking-wider text-neutral-500">
                        custom
                      </span>
                    ) : null}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Labels + pricing model */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white">Calculator labels & model</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-neutral-500 block mb-1">Category label</label>
                <input
                  value={domainConfig.categoryLabel}
                  onChange={(e) =>
                    setDomainConfig({ ...domainConfig, categoryLabel: e.target.value })
                  }
                  className="w-full rounded-lg bg-black/40 border border-neutral-700 px-3 py-2 text-sm text-white"
                  placeholder="Room / Service"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500 block mb-1">Unit label</label>
                <input
                  value={domainConfig.unitLabel}
                  onChange={(e) =>
                    setDomainConfig({ ...domainConfig, unitLabel: e.target.value })
                  }
                  className="w-full rounded-lg bg-black/40 border border-neutral-700 px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500 block mb-1">Tier label</label>
                <input
                  value={domainConfig.tierLabel}
                  onChange={(e) =>
                    setDomainConfig({ ...domainConfig, tierLabel: e.target.value })
                  }
                  className="w-full rounded-lg bg-black/40 border border-neutral-700 px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500 block mb-1">Pricing model</label>
                <select
                  value={domainConfig.pricingModel}
                  onChange={(e) =>
                    setDomainConfig({
                      ...domainConfig,
                      pricingModel: e.target.value as PricingModel,
                    })
                  }
                  className="w-full rounded-lg bg-black/40 border border-neutral-700 px-3 py-2 text-sm text-white"
                >
                  {PRICING_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {PRICING_TIERS.map((tier) => (
                <div key={tier}>
                  <label className="text-xs text-neutral-500 block mb-1 capitalize">
                    {tier} tier name
                  </label>
                  <input
                    value={tierNames[tier]}
                    onChange={(e) =>
                      setTierNames({ ...tierNames, [tier]: e.target.value })
                    }
                    className="w-full rounded-lg bg-black/40 border border-neutral-700 px-3 py-2 text-sm text-white"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Categories & pricing — only what is live + tools to expand */}
          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {categoryLabel} pricing
                </h3>
                <p className="text-xs text-neutral-500 mt-1">
                  Prices per {unitLabel.toLowerCase()} (or flat package, depending on model).
                  Custom rows save immediately; default-room prices save with the button below.
                </p>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-neutral-500">
                {step1.filter((c) => c.kind === 'default').length} system ·{' '}
                {customRooms.length} custom
              </span>
            </div>

            <div className="overflow-hidden rounded-xl border border-neutral-800">
              <div className="grid grid-cols-[1.5fr_repeat(3,4.5rem)_2.5rem] gap-px bg-neutral-800 text-[10px] font-medium uppercase tracking-widest text-neutral-500">
                <div className="bg-neutral-900 px-3 py-2">{categoryLabel}</div>
                {PRICING_TIERS.map((t) => (
                  <div key={t} className="bg-neutral-900 px-2 py-2 text-center">
                    {tierNames[t] || t}
                  </div>
                ))}
                <div className="bg-neutral-900 px-1 py-2 text-center">On</div>
              </div>

              {/* Active system defaults */}
              {ROOM_TYPES.filter((r) => !disabledRooms.includes(r)).map((room) => (
                <div
                  key={room}
                  className="grid grid-cols-[1.5fr_repeat(3,4.5rem)_2.5rem] gap-px border-t border-neutral-800 bg-neutral-950"
                >
                  <div className="px-3 py-2 text-sm text-neutral-200 flex items-center">
                    {room}
                  </div>
                  {PRICING_TIERS.map((tier) => (
                    <div key={tier} className="px-1.5 py-1.5">
                      <input
                        type="number"
                        value={roomPricing[room][tier]}
                        onChange={(e) =>
                          setRoomPrice(room, tier, Number(e.target.value) || 0)
                        }
                        className="w-full rounded bg-black/50 border border-neutral-700 px-1.5 py-1 text-xs text-white font-mono"
                      />
                    </div>
                  ))}
                  <div className="flex items-center justify-center">
                    <button
                      type="button"
                      title="Hide from calculator"
                      onClick={() => void setDefaultRoomEnabled(room, false)}
                      className="h-4 w-7 rounded-full bg-emerald-500 relative"
                    >
                      <span className="absolute right-0.5 top-0.5 h-3 w-3 rounded-full bg-white" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Custom rooms (Kidefa-style) */}
              {customRooms.map((room) => (
                <div
                  key={room.id}
                  className="grid grid-cols-[1.5fr_repeat(3,4.5rem)_2.5rem] gap-px border-t border-neutral-800 bg-neutral-950"
                >
                  <div className="px-3 py-2 text-sm text-white flex items-center gap-2 min-w-0">
                    <span className="truncate">{room.name}</span>
                    <span className="shrink-0 text-[9px] uppercase tracking-wider text-neutral-500">
                      custom
                    </span>
                  </div>
                  {PRICING_TIERS.map((tier) => {
                    const col =
                      tier === 'basic'
                        ? 'price_basic'
                        : tier === 'standard'
                          ? 'price_standard'
                          : 'price_premium'
                    return (
                      <div key={tier} className="px-1.5 py-1.5">
                        <input
                          type="number"
                          defaultValue={room[col]}
                          onBlur={(e) =>
                            void updateCustomRoomPrice(
                              room.id,
                              tier,
                              Number(e.target.value) || 0
                            )
                          }
                          className="w-full rounded bg-black/50 border border-neutral-700 px-1.5 py-1 text-xs text-white font-mono"
                        />
                      </div>
                    )
                  })}
                  <div className="flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => void deleteItem('room', room.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                      title="Delete"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}

              {step1.length === 0 && customRooms.length === 0 ? (
                <p className="px-3 py-4 text-sm text-neutral-500 italic">
                  No categories in the live calculator yet.
                </p>
              ) : null}
            </div>

            {/* Add custom category */}
            <div className="rounded-xl border border-dashed border-neutral-700 bg-black/20 p-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
                Add {categoryLabel.toLowerCase()}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-[1.5fr_repeat(3,1fr)_auto] gap-2 items-end">
                <div>
                  <label className="text-[10px] text-neutral-500 block mb-1">Name</label>
                  <input
                    value={newRoom.name}
                    onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                    placeholder="e.g. Custom Home Theater"
                    className="w-full rounded-lg bg-black/40 border border-neutral-700 px-3 py-2 text-sm text-white"
                  />
                </div>
                {PRICING_TIERS.map((tier) => {
                  const col =
                    tier === 'basic'
                      ? 'price_basic'
                      : tier === 'standard'
                        ? 'price_standard'
                        : 'price_premium'
                  return (
                    <div key={tier}>
                      <label className="text-[10px] text-neutral-500 block mb-1">
                        {tierNames[tier]}
                      </label>
                      <input
                        type="number"
                        value={newRoom[col]}
                        onChange={(e) =>
                          setNewRoom({
                            ...newRoom,
                            [col]: Number(e.target.value) || 0,
                          })
                        }
                        className="w-full rounded-lg bg-black/40 border border-neutral-700 px-3 py-2 text-sm text-white font-mono"
                      />
                    </div>
                  )
                })}
                <button
                  type="button"
                  disabled={!newRoom.name.trim()}
                  onClick={() => {
                    void addItem('room', newRoom).then((ok) => {
                      if (ok) {
                        setNewRoom({
                          name: '',
                          price_basic: 0,
                          price_standard: 0,
                          price_premium: 0,
                        })
                      }
                    })
                  }}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm text-white disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Re-enable hidden system defaults */}
            <div>
              <button
                type="button"
                onClick={() => setShowHiddenDefaults((v) => !v)}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                {showHiddenDefaults ? 'Hide' : 'Show'} hidden system categories (
                {hiddenDefaults.length})
              </button>
              {showHiddenDefaults && hiddenDefaults.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {hiddenDefaults.map((room) => (
                    <button
                      key={room}
                      type="button"
                      onClick={() => void setDefaultRoomEnabled(room, true)}
                      className="rounded-lg border border-neutral-700 bg-black/30 px-3 py-1.5 text-xs text-neutral-300 hover:border-emerald-500/50 hover:text-white"
                    >
                      + {room}
                    </button>
                  ))}
                </div>
              ) : null}
              {showHiddenDefaults && hiddenDefaults.length === 0 ? (
                <p className="mt-2 text-xs text-neutral-500">All system categories are enabled.</p>
              ) : null}
            </div>
          </div>

          {/* Finishes */}
          <div className="space-y-3 border-t border-neutral-800 pt-4">
            <h3 className="text-sm font-semibold text-white">
              {domainConfig.tierLabel || 'Finish'} options
            </h3>
            <div className="space-y-2">
              {PRICING_TIERS.map((tier) => {
                const on = !disabledFinishes.includes(tier)
                const meta = DEFAULT_FINISH_META[tier]
                return (
                  <div
                    key={tier}
                    className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-black/30 px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="h-6 w-6 rounded border border-neutral-600"
                        style={{ background: meta.swatch }}
                      />
                      <div>
                        <div className="text-sm text-white">
                          {tierNames[tier]}{' '}
                          <span className="text-neutral-500 text-xs">({meta.label})</span>
                        </div>
                        <div className="text-[10px] text-neutral-500 uppercase tracking-wider">
                          system · {tier}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void setDefaultFinishEnabled(tier, !on)}
                      className={`h-4 w-7 rounded-full relative ${on ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                    >
                      <span
                        className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${on ? 'right-0.5' : 'left-0.5'}`}
                      />
                    </button>
                  </div>
                )
              })}
              {(data.calculator.customFinishes || []).map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-black/30 px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="h-6 w-6 rounded border border-neutral-600"
                      style={{ background: f.swatch_hex }}
                    />
                    <div>
                      <div className="text-sm text-white">{f.label}</div>
                      <div className="text-[10px] text-neutral-500 uppercase tracking-wider">
                        custom · {f.tier}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void deleteItem('finish', f.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
              <input
                placeholder="Custom finish name"
                value={newFinish.label}
                onChange={(e) => setNewFinish({ ...newFinish, label: e.target.value })}
                className="rounded-lg bg-black/40 border border-neutral-700 px-3 py-2 text-sm text-white"
              />
              <input
                type="color"
                value={newFinish.swatch_hex}
                onChange={(e) =>
                  setNewFinish({ ...newFinish, swatch_hex: e.target.value })
                }
                className="h-10 w-12 rounded border border-neutral-700 bg-transparent"
              />
              <select
                value={newFinish.tier}
                onChange={(e) =>
                  setNewFinish({
                    ...newFinish,
                    tier: e.target.value as PricingTier,
                  })
                }
                className="rounded-lg bg-black/40 border border-neutral-700 px-3 py-2 text-sm text-white"
              >
                {PRICING_TIERS.map((t) => (
                  <option key={t} value={t}>
                    {tierNames[t]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!newFinish.label.trim()}
                onClick={() => {
                  void addItem('finish', newFinish).then((ok) => {
                    if (ok) {
                      setNewFinish({
                        label: '',
                        swatch_hex: '#A78B6A',
                        tier: 'standard',
                      })
                    }
                  })
                }}
                className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm text-white disabled:opacity-40"
              >
                Add finish
              </button>
            </div>
          </div>

          {/* Add-ons */}
          <div className="space-y-3 border-t border-neutral-800 pt-4">
            <h3 className="text-sm font-semibold text-white">Add-ons</h3>
            {(data.calculator.addons || []).length === 0 ? (
              <p className="text-sm text-neutral-500 italic">No add-ons yet.</p>
            ) : (
              data.calculator.addons.map((a) => (
                <div
                  key={a.id}
                  className="flex justify-between items-center gap-3 rounded-lg border border-neutral-800 bg-black/30 px-3 py-2"
                >
                  <div>
                    <div className="text-sm text-white font-medium">{a.name}</div>
                    <div className="text-xs text-neutral-500">
                      ${Number(a.price).toFixed(2)}
                      {a.room_type && a.room_type !== 'all'
                        ? ` · ${a.room_type}`
                        : ' · all categories'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void deleteItem('addon', a.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_8rem_auto] gap-2">
              <input
                placeholder="Add-on name"
                value={newAddon.name}
                onChange={(e) => setNewAddon({ ...newAddon, name: e.target.value })}
                className="rounded-lg bg-black/40 border border-neutral-700 px-3 py-2 text-sm text-white"
              />
              <input
                type="number"
                placeholder="Price $"
                value={newAddon.price}
                onChange={(e) =>
                  setNewAddon({ ...newAddon, price: Number(e.target.value) || 0 })
                }
                className="rounded-lg bg-black/40 border border-neutral-700 px-3 py-2 text-sm text-white font-mono"
              />
              <button
                type="button"
                disabled={!newAddon.name.trim()}
                onClick={() => {
                  void addItem('addon', {
                    name: newAddon.name,
                    price: newAddon.price,
                    room_type: 'all',
                  }).then((ok) => {
                    if (ok) setNewAddon({ name: '', price: 0 })
                  })
                }}
                className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm text-white disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Order / booking / ticket — unchanged patterns */}
      {model === 'order' ? (
        <div className="space-y-4 border-t border-neutral-800 pt-4">
          <h3 className="text-sm font-semibold text-white">Menu items</h3>
          <div className="space-y-2">
            {data.catalog.menuItems.length === 0 ? (
              <p className="text-sm text-neutral-500 italic">No menu items yet.</p>
            ) : (
              data.catalog.menuItems.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between items-center gap-3 rounded-lg border border-neutral-800 bg-black/30 px-3 py-2"
                >
                  <div>
                    <div className="text-sm text-white font-medium">{item.name}</div>
                    <div className="text-xs text-neutral-500">
                      {item.category} · ${(item.price / 100).toFixed(2)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void deleteItem('menu', item.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              placeholder="Name"
              value={newMenu.name}
              onChange={(e) => setNewMenu({ ...newMenu, name: e.target.value })}
              className="rounded-lg bg-black/40 border border-neutral-700 px-3 py-2 text-sm text-white"
            />
            <input
              type="number"
              placeholder="Price (cents)"
              value={newMenu.price}
              onChange={(e) => setNewMenu({ ...newMenu, price: Number(e.target.value) })}
              className="rounded-lg bg-black/40 border border-neutral-700 px-3 py-2 text-sm text-white font-mono"
            />
            <button
              type="button"
              onClick={() => {
                void addItem('menu', newMenu).then((ok) => {
                  if (ok) {
                    setNewMenu({ name: '', description: '', price: 0, category: 'Menu' })
                  }
                })
              }}
              className="sm:col-span-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm text-white"
            >
              + Add menu item
            </button>
          </div>
        </div>
      ) : null}

      {model === 'booking' ? (
        <div className="space-y-6 border-t border-neutral-800 pt-4">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white">Bookable services</h3>
            {data.catalog.services.map((s) => (
              <div
                key={s.id}
                className="flex justify-between items-center gap-3 rounded-lg border border-neutral-800 bg-black/30 px-3 py-2"
              >
                <div>
                  <div className="text-sm text-white font-medium">{s.name}</div>
                  <div className="text-xs text-neutral-500">
                    {s.duration_minutes} min · ${(s.price_cents / 100).toFixed(2)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void deleteItem('service', s.id)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Delete
                </button>
              </div>
            ))}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                placeholder="Service name"
                value={newService.name}
                onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                className="rounded-lg bg-black/40 border border-neutral-700 px-3 py-2 text-sm text-white"
              />
              <input
                type="number"
                value={newService.duration_minutes}
                onChange={(e) =>
                  setNewService({
                    ...newService,
                    duration_minutes: Number(e.target.value),
                  })
                }
                className="rounded-lg bg-black/40 border border-neutral-700 px-3 py-2 text-sm text-white font-mono"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  value={newService.price_cents}
                  onChange={(e) =>
                    setNewService({
                      ...newService,
                      price_cents: Number(e.target.value),
                    })
                  }
                  className="flex-1 rounded-lg bg-black/40 border border-neutral-700 px-3 py-2 text-sm text-white font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    void addItem('service', newService).then((ok) => {
                      if (ok) {
                        setNewService({ name: '', duration_minutes: 60, price_cents: 0 })
                      }
                    })
                  }}
                  className="px-3 py-2 rounded-lg bg-white/10 text-sm text-white"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white">Weekly availability</h3>
            {data.catalog.availability.map((a) => (
              <div
                key={a.id}
                className="flex justify-between items-center gap-3 rounded-lg border border-neutral-800 bg-black/30 px-3 py-2 text-sm"
              >
                <span className="text-neutral-300">
                  {DAYS[a.day_of_week] || a.day_of_week} {a.start_time}–{a.end_time}
                </span>
                <button
                  type="button"
                  onClick={() => void deleteItem('availability', a.id)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Delete
                </button>
              </div>
            ))}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <select
                value={newAvail.day_of_week}
                onChange={(e) =>
                  setNewAvail({ ...newAvail, day_of_week: Number(e.target.value) })
                }
                className="rounded-lg bg-black/40 border border-neutral-700 px-3 py-2 text-sm text-white"
              >
                {DAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
              <input
                type="time"
                value={newAvail.start_time}
                onChange={(e) => setNewAvail({ ...newAvail, start_time: e.target.value })}
                className="rounded-lg bg-black/40 border border-neutral-700 px-3 py-2 text-sm text-white"
              />
              <input
                type="time"
                value={newAvail.end_time}
                onChange={(e) => setNewAvail({ ...newAvail, end_time: e.target.value })}
                className="rounded-lg bg-black/40 border border-neutral-700 px-3 py-2 text-sm text-white"
              />
              <button
                type="button"
                onClick={() => void addItem('availability', newAvail)}
                className="px-3 py-2 rounded-lg bg-white/10 text-sm text-white"
              >
                Add hours
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {model === 'ticket' ? (
        <div className="space-y-4 border-t border-neutral-800 pt-4">
          <h3 className="text-sm font-semibold text-white">Events</h3>
          {data.catalog.events.map((e) => (
            <div
              key={e.id}
              className="flex justify-between items-center gap-3 rounded-lg border border-neutral-800 bg-black/30 px-3 py-2"
            >
              <div>
                <div className="text-sm text-white font-medium">{e.name}</div>
                <div className="text-xs text-neutral-500">
                  {e.event_date} {e.event_time}
                  {e.venue ? ` · ${e.venue}` : ''} · ${(e.price_cents / 100).toFixed(2)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void deleteItem('event', e.id)}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Delete
              </button>
            </div>
          ))}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              placeholder="Event name"
              value={newEvent.name}
              onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
              className="rounded-lg bg-black/40 border border-neutral-700 px-3 py-2 text-sm text-white"
            />
            <input
              placeholder="Venue"
              value={newEvent.venue}
              onChange={(e) => setNewEvent({ ...newEvent, venue: e.target.value })}
              className="rounded-lg bg-black/40 border border-neutral-700 px-3 py-2 text-sm text-white"
            />
            <input
              type="date"
              value={newEvent.event_date}
              onChange={(e) => setNewEvent({ ...newEvent, event_date: e.target.value })}
              className="rounded-lg bg-black/40 border border-neutral-700 px-3 py-2 text-sm text-white"
            />
            <input
              type="time"
              value={newEvent.event_time}
              onChange={(e) => setNewEvent({ ...newEvent, event_time: e.target.value })}
              className="rounded-lg bg-black/40 border border-neutral-700 px-3 py-2 text-sm text-white"
            />
            <button
              type="button"
              onClick={() => {
                void addItem('event', newEvent).then((ok) => {
                  if (ok) {
                    setNewEvent({
                      name: '',
                      venue: '',
                      event_date: '',
                      event_time: '19:00',
                      capacity: 100,
                      price_cents: 0,
                    })
                  }
                })
              }}
              className="sm:col-span-2 px-3 py-2 rounded-lg bg-white/10 text-sm text-white"
            >
              + Create event
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex justify-end border-t border-neutral-800 pt-4">
        <button
          type="button"
          onClick={() => void saveSettings()}
          disabled={saving}
          className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save engagement settings'}
        </button>
      </div>
    </section>
  )
}
