'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Script from 'next/script'
import { supabaseBrowser, getBrowserUser } from '@/lib/supabase-browser'
import { DEMO_CONTRACTOR_ID, DEMO_RESET_NOTICE } from '@/lib/demo'
import { WIDGET_CDN_URL } from '@/lib/urls'
import { resolveIndustrySlug } from '@/lib/catalog/serviceCatalog'
import { getEngineProfile } from '@/lib/catalog/engineProfiles'
import OrderEditor from './components/OrderEditor'
import PageManager from './components/PageManager'
import BookingEditor from './components/BookingEditor'
import TicketEditor from './components/TicketEditor'
import DomainManager from '@/components/DomainManager'
import WidgetThemePicker from '@/components/WidgetThemePicker'
import { DEFAULT_WIDGET_THEME_ID } from '@/lib/widgetThemes'
import {
  ROOM_TYPES,
  PRICING_TIERS,
  cloneDefaultRoomPricing,
  normalizeRoomPricing,
  type CustomFinish,
  type CustomRoom,
  type PricingTier,
  type RoomPricing,
  type RoomType,
} from '@/lib/rooms'
import {
  addonScopeKey,
  formatAddonScopeLabel,
  getAddonTargetRooms,
  roomScopeToDbFields,
} from '@/lib/addonRooms'

export type ContractorAddon = {
  id: string
  contractor_id: string
  room_type: string
  room_types?: string[] | null
  name: string
  price: number
}

export type ContractorSettings = {
  id: string
  user_id?: string
  industry?: string
  company_name: string
  primary_color_hex: string
  /** Matched calculator appearance pack (see widgetThemes). */
  widget_theme_id?: string | null
  contact_email: string
  // Personal cell phone number for the contractor. When a new lead submits
  // through the widget we text the lead details to this number via Twilio.
  contact_phone?: string | null
  room_pricing: RoomPricing
  price_drawer: number
  price_shoe_rack: number
  referred_by?: string | null
  disabled_default_rooms?: string[]
  disabled_default_finishes?: string[]
  tier_names?: { basic?: string; standard?: string; premium?: string }
  // Billing fields (read-only from the dashboard; the Stripe webhook writes
  // these via the service-role client). Surfaced here so the trial banner
  // can be rendered without a second round-trip.
  subscription_status?: 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' | 'unpaid'
  trial_ends_at?: string | null
  current_period_end?: string | null
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
  subscription_plan?: 'monthly' | 'yearly' | null
  domain_config?: {
    categoryLabel?: string
    unitLabel?: string
    unitAbbrev?: string
    tierLabel?: string
    pricingModel?: string
    unitMin?: number
    unitMax?: number
    baseFee?: number
  } | null
}

function createInitialForm(): ContractorSettings {
  return {
    id: crypto.randomUUID(),
    company_name: '',
    contact_email: '',
    contact_phone: '',
    primary_color_hex: '#6C47FF',
    room_pricing: cloneDefaultRoomPricing(),
    price_drawer: 0,
    price_shoe_rack: 0,
    disabled_default_rooms: [],
    disabled_default_finishes: [],
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const [form, setForm] = useState<ContractorSettings | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  // Tracks whether the embed snippet section has been revealed. Once a save
  // succeeds we show it and keep it visible — the "Saved successfully" toast
  // (which uses `saved`) auto-dismisses after 5s, but the contractor still
  // needs to be able to copy their embed code.
  const [embedRevealed, setEmbedRevealed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)

  const [addons, setAddons] = useState<ContractorAddon[]>([])
  const [newAddon, setNewAddon] = useState({
    apply_all_rooms: true,
    rooms: [] as string[],
    name: '',
    price: 0,
  })
  const [addingAddon, setAddingAddon] = useState(false)

  const [customRooms, setCustomRooms] = useState<CustomRoom[]>([])
  const [newRoom, setNewRoom] = useState({ name: '', price_basic: 0, price_standard: 0, price_premium: 0 })
  const [addingRoom, setAddingRoom] = useState(false)
  const [roomsOpen, setRoomsOpen] = useState(true)
  const [addonsOpen, setAddonsOpen] = useState(true)

  const [customFinishes, setCustomFinishes] = useState<CustomFinish[]>([])
  const [newFinish, setNewFinish] = useState<{ label: string; swatch_hex: string; tier: PricingTier }>({ label: '', swatch_hex: '#A78B6A', tier: 'standard' })
  const [addingFinish, setAddingFinish] = useState(false)
  const [finishesOpen, setFinishesOpen] = useState(true)

  // Auto-dismiss the "Saved successfully" toast after 5s.
  useEffect(() => {
    if (!saved) return
    const t = setTimeout(() => setSaved(false), 5000)
    return () => clearTimeout(t)
  }, [saved])

  // ── Auth gate: check session, fetch settings ──
  useEffect(() => {
    async function init() {
      const user = await getBrowserUser()

      if (!user) {
        router.replace('/login')
        return
      }

      if (user.user_metadata?.force_password_reset) {
        router.replace('/force-password-reset')
        return
      }

      const uid = user.id
      setUserId(uid)

      // Prefer the tenant's live widget_id (same row admin + public widget use).
      // Claim links user_id onto that row and returns its id.
      let canonicalWidgetId: string | null = null
      try {
        const claimRes = await fetch('/api/contractor/claim', { method: 'POST' })
        const claimJson = await claimRes.json().catch(() => ({}))
        if (
          claimRes.ok &&
          typeof claimJson.contractorId === 'string' &&
          claimJson.contractorId
        ) {
          canonicalWidgetId = claimJson.contractorId
        }
      } catch {
        /* non-fatal */
      }

      let settingsRow: Record<string, unknown> | null = null

      if (canonicalWidgetId) {
        const { data: byWidget } = await supabaseBrowser
          .from('contractor_settings')
          .select('*')
          .eq('id', canonicalWidgetId)
          .maybeSingle()
        settingsRow = byWidget
      }

      // Fallback: metadata tenant_id (legacy widget_id === tenant.id)
      if (!settingsRow && user.user_metadata?.tenant_id) {
        const tenantId = user.user_metadata.tenant_id as string
        const { data: byTenant } = await supabaseBrowser
          .from('contractor_settings')
          .select('*')
          .eq('id', tenantId)
          .maybeSingle()
        settingsRow = byTenant
      }

      // Last resort: any row owned by this user (solo signup / bootstrap).
      if (!settingsRow) {
        const { data: existing } = await supabaseBrowser
          .from('contractor_settings')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        settingsRow = existing
      }

      if (settingsRow) {
        setForm({
          ...(settingsRow as ContractorSettings),
          room_pricing: normalizeRoomPricing((settingsRow as { room_pricing?: unknown }).room_pricing),
        })
        setSaved(true)
        setEmbedRevealed(true)

        const contractorId = settingsRow.id

        const { data: addonsData } = await supabaseBrowser
          .from('contractor_addons')
          .select('*')
          .eq('contractor_id', contractorId)
          .order('created_at', { ascending: true })
        
        if (addonsData) {
          setAddons(addonsData as ContractorAddon[])
        }

        const { data: roomsData } = await supabaseBrowser
          .from('contractor_rooms')
          .select('*')
          .eq('contractor_id', contractorId)
          .order('created_at', { ascending: true })

        if (roomsData) {
          setCustomRooms(roomsData as CustomRoom[])
        }

        const { data: finishesData } = await supabaseBrowser
          .from('contractor_finishes')
          .select('*')
          .eq('contractor_id', contractorId)
          .order('sort_order', { ascending: true })

        if (finishesData) {
          setCustomFinishes(finishesData as CustomFinish[])
        }
      } else {
        // First time — create a fresh form with user_id attached
        // Check for an affiliate referral stored during signup
        const ref = localStorage.getItem('closetquote_ref')
        const initialForm: ContractorSettings = {
          ...createInitialForm(),
          user_id: uid,
          ...(ref ? { referred_by: ref } : {}),
        }
        setForm(initialForm)

        // Clear the ref so it isn't re-applied on future visits
        if (ref) localStorage.removeItem('closetquote_ref')
      }

      setAuthChecked(true)
    }

    init()
  }, [router])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value, type } = e.target
      setForm((prev) =>
        prev
          ? {
              ...prev,
              [name]: type === 'number' ? parseFloat(value) || 0 : value,
            }
          : prev
      )
      setSaved(false)
    },
    []
  )

  const handleRoomPriceChange = useCallback(
    (room: RoomType, tier: PricingTier, value: string) => {
      const parsed = parseFloat(value)
      setForm((prev) =>
        prev
          ? {
              ...prev,
              room_pricing: {
                ...prev.room_pricing,
                [room]: {
                  ...prev.room_pricing[room],
                  [tier]: Number.isFinite(parsed) ? parsed : 0,
                },
              },
            }
          : prev
      )
      setSaved(false)
    },
    []
  )

  const handleSave = async () => {
    if (!form || !userId) return
    setSaving(true)
    setError(null)
    setSaved(false)

    // Always stamp the authenticated user_id before saving. Strip billing
    // columns — they are owned by the Stripe webhook (service-role) and RLS
    // blocks user writes to them.
    const {
      subscription_status: _ss,
      trial_ends_at: _te,
      current_period_end: _cp,
      stripe_customer_id: _sc,
      stripe_subscription_id: _ssub,
      subscription_plan: _sp,
      ...editable
    } = form
    void _ss; void _te; void _cp; void _sc; void _ssub; void _sp
    const payload = { ...editable, user_id: userId }
    
    const { data, error: saveError } = await supabaseBrowser
      .from('contractor_settings')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single()

    if (!saveError && data) {
      setForm({
        ...(data as ContractorSettings),
        room_pricing: normalizeRoomPricing((data as { room_pricing?: unknown }).room_pricing),
      })
      setSaved(true)
      setEmbedRevealed(true)
      setPreviewKey((prev) => prev + 1)
    } else {
      setError(saveError?.message || 'Failed to save settings.')
    }

    setSaving(false)
  }

  const handleAddAddon = async () => {
    if (!form || !newAddon.name.trim()) return
    setAddingAddon(true)

    const { room_type, room_types } = roomScopeToDbFields(
      newAddon.rooms,
      newAddon.apply_all_rooms
    )
    const payload = {
      contractor_id: form.id,
      room_type,
      room_types,
      name: newAddon.name.trim(),
      price: newAddon.price,
    }

    const { data, error } = await supabaseBrowser
      .from('contractor_addons')
      .insert(payload)
      .select()
      .single()

    if (!error && data) {
      setAddons((prev) => [...prev, data as ContractorAddon])
      setNewAddon({ apply_all_rooms: true, rooms: [], name: '', price: 0 })
      setPreviewKey((prev) => prev + 1)
    }
    setAddingAddon(false)
  }

  const handleDeleteAddon = async (addonId: string) => {
    setAddons((prev) => prev.filter((a) => a.id !== addonId))
    await supabaseBrowser.from('contractor_addons').delete().eq('id', addonId)
    setPreviewKey((prev) => prev + 1)
  }

  const handleAddonNameChange = (addonId: string, value: string) => {
    setAddons((prev) =>
      prev.map((a) => (a.id === addonId ? { ...a, name: value } : a))
    )
  }

  const handleAddonNameBlur = async (addonId: string, value: string) => {
    const trimmed = value.trim()
    if (!trimmed) return
    setAddons((prev) =>
      prev.map((a) => (a.id === addonId ? { ...a, name: trimmed } : a))
    )
    const { error } = await supabaseBrowser
      .from('contractor_addons')
      .update({ name: trimmed })
      .eq('id', addonId)
    if (!error) setPreviewKey((prev) => prev + 1)
  }

  const handleAddonPriceChange = useCallback(async (addonId: string, value: string) => {
    const parsed = parseFloat(value)
    const price = Number.isFinite(parsed) ? parsed : 0
    setAddons((prev) =>
      prev.map((a) => (a.id === addonId ? { ...a, price } : a))
    )
    await supabaseBrowser
      .from('contractor_addons')
      .update({ price })
      .eq('id', addonId)
    setPreviewKey((prev) => prev + 1)
  }, [])

  const handleAddonScopeChange = async (
    addonIds: string[],
    applyAllRooms: boolean,
    selectedRooms: string[]
  ) => {
    const { room_type, room_types } = roomScopeToDbFields(
      selectedRooms,
      applyAllRooms
    )
    setAddons((prev) =>
      prev.map((a) =>
        addonIds.includes(a.id) ? { ...a, room_type, room_types } : a
      )
    )
    await supabaseBrowser
      .from('contractor_addons')
      .update({ room_type, room_types })
      .in('id', addonIds)
    setPreviewKey((prev) => prev + 1)
  }

  const handleAddCustomRoom = async () => {
    if (!form || !newRoom.name.trim()) return
    const trimmed = newRoom.name.trim()
    // Block dupes vs defaults and existing customs.
    if ((ROOM_TYPES as readonly string[]).includes(trimmed) ||
        customRooms.some((r) => r.name.toLowerCase() === trimmed.toLowerCase())) {
      setError(`A room named "${trimmed}" already exists.`)
      return
    }
    setAddingRoom(true)
    setError(null)
    const { data, error: insertErr } = await supabaseBrowser
      .from('contractor_rooms')
      .insert({
        contractor_id: form.id,
        name: trimmed,
        price_basic: newRoom.price_basic,
        price_standard: newRoom.price_standard,
        price_premium: newRoom.price_premium,
      })
      .select()
      .single()
    if (!insertErr && data) {
      setCustomRooms((prev) => [...prev, data as CustomRoom])
      setNewRoom({ name: '', price_basic: 0, price_standard: 0, price_premium: 0 })
      setPreviewKey((prev) => prev + 1)
    } else {
      setError(insertErr?.message || 'Failed to add custom room.')
    }
    setAddingRoom(false)
  }

  const handleCustomRoomPriceChange = useCallback(
    async (roomId: string, tier: PricingTier, value: string) => {
      const parsed = parseFloat(value)
      const price = Number.isFinite(parsed) ? parsed : 0
      const col = tier === 'basic' ? 'price_basic' : tier === 'standard' ? 'price_standard' : 'price_premium'
      setCustomRooms((prev) =>
        prev.map((r) => (r.id === roomId ? { ...r, [col]: price } : r))
      )
      // Debounced persistence would be nicer; for simplicity write on blur via a no-op here.
      // We rely on the save button — push the change immediately to keep widget preview in sync.
      await supabaseBrowser
        .from('contractor_rooms')
        .update({ [col]: price })
        .eq('id', roomId)
      setPreviewKey((prev) => prev + 1)
    },
    []
  )

  const handleDeleteCustomRoom = async (roomId: string) => {
    setCustomRooms((prev) => prev.filter((r) => r.id !== roomId))
    await supabaseBrowser.from('contractor_rooms').delete().eq('id', roomId)
    setPreviewKey((prev) => prev + 1)
  }

  // ── Custom finishes ──────────────────────────────────────────────
  const handleAddCustomFinish = async () => {
    if (!form || !newFinish.label.trim()) return
    const label = newFinish.label.trim()
    if (customFinishes.some((f) => f.label.toLowerCase() === label.toLowerCase())) {
      setError(`A finish named "${label}" already exists.`)
      return
    }
    setAddingFinish(true)
    setError(null)
    const { data, error: insertErr } = await supabaseBrowser
      .from('contractor_finishes')
      .insert({
        contractor_id: form.id,
        label,
        swatch_hex: newFinish.swatch_hex,
        tier: newFinish.tier,
        sort_order: customFinishes.length,
      })
      .select()
      .single()
    if (!insertErr && data) {
      setCustomFinishes((prev) => [...prev, data as CustomFinish])
      setNewFinish({ label: '', swatch_hex: '#A78B6A', tier: 'standard' })
      setPreviewKey((prev) => prev + 1)
    } else {
      setError(insertErr?.message || 'Failed to add finish.')
    }
    setAddingFinish(false)
  }

  const handleDeleteCustomFinish = async (finishId: string) => {
    setCustomFinishes((prev) => prev.filter((f) => f.id !== finishId))
    await supabaseBrowser.from('contractor_finishes').delete().eq('id', finishId)
    setPreviewKey((prev) => prev + 1)
  }

  // ── Toggle visibility of system defaults ─────────────────────────
  // These persist as text[] columns on contractor_settings; we update the
  // single row directly so the widget sees the change without a full save.
  const persistDisabledList = async (
    column: 'disabled_default_rooms' | 'disabled_default_finishes',
    next: string[]
  ) => {
    if (!form) return
    setForm((prev) => (prev ? { ...prev, [column]: next } : prev))
    await supabaseBrowser
      .from('contractor_settings')
      .update({ [column]: next })
      .eq('id', form.id)
    setPreviewKey((prev) => prev + 1)
  }

  const toggleDefaultRoom = (room: RoomType, enabled: boolean) => {
    if (!form) return
    const current = form.disabled_default_rooms ?? []
    const next = enabled ? current.filter((r) => r !== room) : [...current, room]
    persistDisabledList('disabled_default_rooms', next)
  }

  const toggleDefaultFinish = (tier: PricingTier, enabled: boolean) => {
    if (!form) return
    const current = form.disabled_default_finishes ?? []
    const next = enabled ? current.filter((t) => t !== tier) : [...current, tier]
    persistDisabledList('disabled_default_finishes', next)
  }

  const handleSignOut = async () => {
    await supabaseBrowser.auth.signOut()
    router.replace('/login')
  }

  const embedCode =
    form && authChecked
      ? `<closet-quote-widget data-contractor-id="${form.id}" data-api-url="${window.location.origin}"></closet-quote-widget>\n<script src="${WIDGET_CDN_URL}"></script>`
      : ''

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(embedCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* fallback */
      const textarea = document.createElement('textarea')
      textarea.value = embedCode
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const addonGroups = useMemo(() => {
    const map = new Map<
      string,
      { key: string; label: string; targets: string[]; addons: ContractorAddon[] }
    >()
    for (const addon of addons) {
      const key = addonScopeKey(addon)
      const targets = getAddonTargetRooms(addon)
      const existing = map.get(key)
      if (existing) {
        existing.addons.push(addon)
      } else {
        map.set(key, {
          key,
          label: formatAddonScopeLabel(targets),
          targets,
          addons: [addon],
        })
      }
    }
    return [...map.values()].sort((a, b) => {
      if (a.key === 'all') return -1
      if (b.key === 'all') return 1
      return a.label.localeCompare(b.label)
    })
  }, [addons])

  // ── Loading state while checking auth ──
  if (!authChecked || !form) {
    return (
      <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <span className="text-xl font-bold tracking-tighter text-white animate-pulse">
            Closet<span className="text-slate-400">Quote</span>
          </span>
          <p className="text-sm text-slate-500">Loading your dashboard…</p>
        </div>
      </div>
    )
  }

  const disabledRoomList = form.disabled_default_rooms ?? []
  const categoryLabel = form.domain_config?.categoryLabel || 'Room'
  const categoryLabelPlural = categoryLabel === 'Room' ? 'Rooms' : categoryLabel === 'Service' ? 'Services' : `${categoryLabel}s`
  const visibleDefaultRooms = ROOM_TYPES.filter((room) => !disabledRoomList.includes(room))
  const disabledFinishesList = form.disabled_default_finishes ?? []
  const allDefaultFinishesHidden = PRICING_TIERS.every((tier) =>
    disabledFinishesList.includes(tier)
  )
  const tierLabel = (tier: PricingTier) => {
    const names = form.tier_names
    const custom = names?.[tier]?.trim()
    if (custom) return custom
    return tier.charAt(0).toUpperCase() + tier.slice(1)
  }
  const widgetRoomOptions = [
    ...visibleDefaultRooms,
    ...customRooms.map((room) => room.name),
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans">
      {/* ─── Top nav ─── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0a0a0a]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="transition hover:opacity-80">
            <span className="text-xl font-bold tracking-tighter text-white">
              Closet<span className="text-slate-400">Quote</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <SubscriptionBadge
              status={form.subscription_status}
              trialEndsAt={form.trial_ends_at}
              plan={form.subscription_plan}
              isDemo={form.id === DEMO_CONTRACTOR_ID}
            />
            <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-zinc-400">
              Admin Dashboard
            </span>
            <button
              onClick={handleSignOut}
              className="rounded-lg border border-white/[0.06] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-white/[0.08] hover:text-white"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <Script src={WIDGET_CDN_URL} />

        {form.id === DEMO_CONTRACTOR_ID && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-xs text-amber-100/90">
            <span className="mt-0.5 inline-flex h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" />
            <div className="leading-relaxed">
              <p className="font-semibold text-amber-100">
                {DEMO_RESET_NOTICE.short}
              </p>
              <p className="mt-1 text-amber-100/70">
                {DEMO_RESET_NOTICE.long} Use this account to preview the
                dashboard or record demos — but treat every change as
                temporary.
              </p>
            </div>
          </div>
        )}

        <TrialBanner
          status={form.subscription_status}
          trialEndsAt={form.trial_ends_at}
          isDemo={form.id === DEMO_CONTRACTOR_ID}
        />

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start">
          {/* ─── Left Column: Settings form & Embed code ─── */}
          <div className="space-y-10">
            {/* ─── Settings form ─── */}
            <section className="rounded-2xl border border-white/[0.06] bg-[#12151C] p-8">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Contractor Settings
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Configure your pricing and branding.
              </p>
            </div>
            <span className="font-mono text-[11px] text-zinc-600 hidden sm:block">
              ID: {form.id.slice(0, 8)}…
            </span>
          </div>

          {/* Company info */}
          <div className="mb-8 grid gap-6 sm:grid-cols-3">
            <div>
              <label
                htmlFor="company_name"
                className="mb-2 block text-xs font-medium uppercase tracking-widest text-zinc-500"
              >
                Company Name
              </label>
              <input
                id="company_name"
                name="company_name"
                type="text"
                placeholder="Acme Closets"
                value={form.company_name}
                onChange={handleChange}
                className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-white/30 focus:bg-white/[0.08]"
              />
            </div>
            <div>
              <label
                htmlFor="contact_email"
                className="mb-2 block text-xs font-medium uppercase tracking-widest text-zinc-500"
              >
                Contact Email
              </label>
              <input
                id="contact_email"
                name="contact_email"
                type="email"
                placeholder="hello@acmeclosets.com"
                value={form.contact_email || ''}
                onChange={handleChange}
                className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-white/30 focus:bg-white/[0.08]"
              />
            </div>
            <div>
              <label
                htmlFor="contact_phone"
                className="mb-2 block text-xs font-medium uppercase tracking-widest text-zinc-500"
              >
                Lead Alert Phone Number
              </label>
              <input
                id="contact_phone"
                name="contact_phone"
                type="tel"
                placeholder="+1 555 123 4567"
                value={form.contact_phone || ''}
                onChange={handleChange}
                className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-white/30 focus:bg-white/[0.08]"
              />
              <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                We&apos;ll text a fully-qualified lead alert (customer name, phone,
                room type, finish, quoted range) to this number the instant a
                homeowner submits the widget. Include the country code (e.g.
                +1 for US numbers).
              </p>
            </div>
            <div>
              <label
                htmlFor="primary_color_hex"
                className="mb-2 block text-xs font-medium uppercase tracking-widest text-zinc-500"
              >
                Accent (from theme)
              </label>
              <div className="flex items-center gap-3">
                <span
                  className="h-11 w-14 rounded-lg border border-white/[0.06]"
                  style={{ background: form.primary_color_hex }}
                  title={form.primary_color_hex}
                />
                <code className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 font-mono text-sm text-zinc-300">
                  {form.primary_color_hex}
                </code>
              </div>
            </div>
          </div>

          {/* Calculator theme packs — surfaces + text + accent matched */}
          <div className="mb-8">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium uppercase tracking-widest text-zinc-500">
                  Calculator theme
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Pick a matched look so your quote calculator blends with your site.
                  Applies live on save.
                </p>
              </div>
            </div>
            <WidgetThemePicker
              compact
              value={form.widget_theme_id || DEFAULT_WIDGET_THEME_ID}
              onChange={(theme) => {
                setForm((prev) =>
                  prev
                    ? {
                        ...prev,
                        widget_theme_id: theme.id,
                        primary_color_hex: theme.brand,
                      }
                    : prev
                )
                setSaved(false)
                setPreviewKey((k) => k + 1)
                // Persist immediately so the live widget preview updates.
                if (form.id) {
                  void supabaseBrowser
                    .from('contractor_settings')
                    .update({
                      widget_theme_id: theme.id,
                      primary_color_hex: theme.brand,
                    })
                    .eq('id', form.id)
                    .then(({ error: themeErr }) => {
                      if (themeErr) setError(themeErr.message)
                      else setSaved(true)
                    })
                }
              }}
            />
          </div>

          {/* Divider */}
          <div className="mb-8 border-t border-white/[0.04]" />

          {(() => {
            const slug = resolveIndustrySlug({ industry: form.industry })
            const profile = getEngineProfile(slug)
            const model = profile?.engagementModel || 'quote'

            if (model === 'order') {
              return <OrderEditor form={form} setForm={setForm} onSave={handleSave} saving={saving} />
            }
            if (model === 'booking') {
              return <BookingEditor form={form} setForm={setForm} onSave={handleSave} saving={saving} />
            }
            if (model === 'ticket') {
              return <TicketEditor form={form} setForm={setForm} onSave={handleSave} saving={saving} />
            }
            
            return (
              <>
          {/* Pricing — collapsible */}
          <button
            type="button"
            onClick={() => setRoomsOpen((o) => !o)}
            className="mb-2 flex w-full items-center justify-between gap-3 rounded-lg px-1 py-1 text-left transition hover:bg-white/[0.02]"
            aria-expanded={roomsOpen}
            aria-controls="room-pricing-panel"
          >
            <div className="flex items-baseline gap-3">
              <h2 className="text-sm font-medium uppercase tracking-widest text-zinc-500">
                {categoryLabel} Pricing Matrix
              </h2>
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                {visibleDefaultRooms.length} active · {customRooms.length} custom
              </span>
            </div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`h-4 w-4 text-zinc-500 transition-transform ${roomsOpen ? 'rotate-180' : ''}`}
            >
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </button>
          {roomsOpen && (
            <div id="room-pricing-panel">
              <p className="mb-5 text-xs text-zinc-500">
                Pricing for the {categoryLabel.toLowerCase()} types in your calculator. Add more {categoryLabel.toLowerCase()}s below if your offering grows.
              </p>
              <div className="mb-4 overflow-hidden rounded-xl border border-white/[0.06]">
                <div className="sticky top-0 z-10 grid grid-cols-[1.4fr_1fr_1fr_1fr_2.5rem] gap-px border-b border-white/[0.06] bg-white/[0.04] text-[10px] font-medium uppercase tracking-widest text-zinc-500 backdrop-blur">
                  <div className="bg-[#12151C]/95 px-4 py-3">{categoryLabel}</div>
                  {PRICING_TIERS.map((tier) => (
                    <div key={tier} className="bg-[#12151C]/95 px-4 py-3">
                      {tierLabel(tier)}
                    </div>
                  ))}
                  <div className="bg-[#12151C]/95 px-2 py-3 text-center" aria-label="Show in widget">On</div>
                </div>
                <div className="max-h-[28rem] overflow-y-auto">
                  {visibleDefaultRooms.map((room) => (
                    <div
                      key={room}
                      className="grid grid-cols-[1.4fr_1fr_1fr_1fr_2.5rem] gap-px border-t border-white/[0.04] bg-white/[0.04] first:border-t-0"
                    >
                      <div className="flex items-center bg-[#12151C] px-4 py-3 text-sm text-zinc-200">
                        {room}
                      </div>
                      {PRICING_TIERS.map((tier) => (
                        <div key={tier} className="bg-[#12151C] px-3 py-2">
                          <div className="relative">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-600">
                              $
                            </span>
                            <input
                              id={`room_pricing_${room}_${tier}`}
                              type="number"
                              min="0"
                              step="0.01"
                              aria-label={`${room} ${tier} price per ${form.domain_config?.unitLabel?.toLowerCase() || 'linear foot'}`}
                              value={form.room_pricing[room][tier] || ''}
                              onChange={(e) =>
                                handleRoomPriceChange(room, tier, e.target.value)
                              }
                              placeholder="0.00"
                              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] py-2 pl-7 pr-3 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-white/30 focus:bg-white/[0.08]"
                            />
                          </div>
                        </div>
                      ))}
                      <div className="flex items-center justify-center bg-[#12151C]">
                        <label className="relative inline-flex cursor-pointer items-center" title={`Hide this ${categoryLabel.toLowerCase()} from your widget`}>
                          <input
                            type="checkbox"
                            className="peer sr-only"
                            checked
                            onChange={(e) => toggleDefaultRoom(room, e.target.checked)}
                            aria-label={`Hide ${room}`}
                          />
                          <span className="h-4 w-7 rounded-full bg-zinc-700 transition-colors peer-checked:bg-emerald-500" />
                          <span className="absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white transition-transform peer-checked:translate-x-3" />
                        </label>
                      </div>
                    </div>
                  ))}
                  {customRooms.map((room) => (
                    <div
                      key={room.id}
                      className="grid grid-cols-[1.4fr_1fr_1fr_1fr_2.5rem] gap-px border-t border-white/[0.04] bg-white/[0.04]"
                    >
                      <div className="flex items-center gap-2 bg-[#12151C] px-4 py-3 text-sm text-zinc-200">
                        <span>{room.name}</span>
                        <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-zinc-500">custom</span>
                      </div>
                      {PRICING_TIERS.map((tier) => {
                        const col = tier === 'basic' ? 'price_basic' : tier === 'standard' ? 'price_standard' : 'price_premium'
                        return (
                          <div key={tier} className="bg-[#12151C] px-3 py-2">
                            <div className="relative">
                              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-600">$</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                aria-label={`${room.name} ${tier} price per ${form.domain_config?.unitLabel?.toLowerCase() || 'linear foot'}`}
                                value={room[col] || ''}
                                onChange={(e) => handleCustomRoomPriceChange(room.id, tier, e.target.value)}
                                placeholder="0.00"
                                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] py-2 pl-7 pr-3 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-white/30 focus:bg-white/[0.08]"
                              />
                            </div>
                          </div>
                        )
                      })}
                      <div className="flex items-center justify-center bg-[#12151C]">
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomRoom(room.id)}
                          className="p-1.5 text-zinc-600 transition hover:text-red-400"
                          title={`Delete custom ${categoryLabel.toLowerCase()}`}
                          aria-label={`Delete ${room.name}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add custom room form */}
              <div className="mb-8 flex flex-col gap-3 rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] p-4 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-widest text-zinc-500">
                    New {categoryLabel} Name
                  </label>
                  <input
                    type="text"
                    placeholder={categoryLabel === 'Service' ? 'e.g. Leak Detection' : 'e.g. Wine Cellar'}
                    value={newRoom.name}
                    onChange={(e) => setNewRoom((p) => ({ ...p, name: e.target.value }))}
                    className="w-full rounded-lg border border-white/[0.06] bg-[#12151C] px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-white/30"
                  />
                </div>
                {PRICING_TIERS.map((tier) => {
                  const col = tier === 'basic' ? 'price_basic' : tier === 'standard' ? 'price_standard' : 'price_premium'
                  return (
                    <div key={tier} className="w-full sm:w-24">
                      <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-widest text-zinc-500">
                        {tierLabel(tier)}
                      </label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={newRoom[col] || ''}
                          onChange={(e) => setNewRoom((p) => ({ ...p, [col]: parseFloat(e.target.value) || 0 }))}
                          className="w-full rounded-lg border border-white/[0.06] bg-[#12151C] py-2.5 pl-6 pr-2 text-sm text-white outline-none focus:border-white/30"
                        />
                      </div>
                    </div>
                  )
                })}
                <button
                  type="button"
                  onClick={handleAddCustomRoom}
                  disabled={addingRoom || !newRoom.name.trim()}
                  className="rounded-lg bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/20 disabled:opacity-50"
                >
                  Add {categoryLabel}
                </button>
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="mb-8 border-t border-white/[0.04]" />

          {/* Materials / Finishes — collapsible */}
          {(() => {
            const DEFAULT_FINISH_META: Record<PricingTier, { label: string; swatch: string }> = {
              basic: { label: 'White Melamine', swatch: '#F4F1EC' },
              standard: { label: 'Textured Wood', swatch: '#A0744A' },
              premium: { label: 'Custom Paint', swatch: '#3A4750' },
            }
            const disabledFinishes = form.disabled_default_finishes ?? []
            return (
              <>
                <button
                  type="button"
                  onClick={() => setFinishesOpen((o) => !o)}
                  className="mb-2 flex w-full items-center justify-between gap-3 rounded-lg px-1 py-1 text-left transition hover:bg-white/[0.02]"
                  aria-expanded={finishesOpen}
                  aria-controls="finishes-panel"
                >
                  <div className="flex items-baseline gap-3">
                    <h2 className="text-sm font-medium uppercase tracking-widest text-zinc-500">
                      Materials &amp; Finishes
                    </h2>
                    <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                      {customFinishes.length} material{customFinishes.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 text-zinc-500 transition-transform ${finishesOpen ? 'rotate-180' : ''}`}>
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </button>
                {finishesOpen && (
                  <div id="finishes-panel" className="mb-10">
                    <p className="mb-5 text-xs text-zinc-500">
                      Material options shown in your calculator. Each finish maps to a pricing tier ({tierLabel('basic')}, {tierLabel('standard')}, {tierLabel('premium')}).
                    </p>

                    <div className="mb-4 overflow-hidden rounded-xl border border-white/[0.06]">
                      <div className="grid grid-cols-[auto_1fr_auto_auto_2.5rem] gap-px border-b border-white/[0.06] bg-white/[0.04] text-[10px] font-medium uppercase tracking-widest text-zinc-500">
                        <div className="bg-[#12151C]/95 px-4 py-3">Swatch</div>
                        <div className="bg-[#12151C]/95 px-4 py-3">Name</div>
                        <div className="bg-[#12151C]/95 px-4 py-3">Tier</div>
                        <div className="bg-[#12151C]/95 px-4 py-3 text-center">On</div>
                        <div className="bg-[#12151C]/95 px-2 py-3" />
                      </div>

                      {!allDefaultFinishesHidden &&
                        PRICING_TIERS.map((tier) => {
                          const meta = DEFAULT_FINISH_META[tier]
                          const disabled = disabledFinishesList.includes(tier)
                          return (
                            <div key={tier} className={`grid grid-cols-[auto_1fr_auto_auto_2.5rem] items-center gap-px border-t border-white/[0.04] bg-white/[0.04] first:border-t-0 ${disabled ? 'opacity-50' : ''}`}>
                              <div className="bg-[#12151C] px-4 py-3">
                                <span className="block h-6 w-10 rounded-md border border-white/10" style={{ backgroundColor: meta.swatch }} />
                              </div>
                              <div className="bg-[#12151C] px-4 py-3 text-sm text-zinc-200">
                                {meta.label}
                                {disabled && (
                                  <span className="ml-2 rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-zinc-500">hidden</span>
                                )}
                              </div>
                              <div className="bg-[#12151C] px-4 py-3 text-xs uppercase tracking-wider text-zinc-500">{tierLabel(tier)}</div>
                              <div className="flex items-center justify-center bg-[#12151C] px-4 py-3">
                                <label className="relative inline-flex cursor-pointer items-center" title={disabled ? 'Show this finish in the widget' : 'Hide this finish from the widget'}>
                                  <input
                                    type="checkbox"
                                    className="peer sr-only"
                                    checked={!disabled}
                                    onChange={(e) => toggleDefaultFinish(tier, e.target.checked)}
                                    aria-label={`${disabled ? 'Show' : 'Hide'} ${meta.label}`}
                                  />
                                  <span className="h-4 w-7 rounded-full bg-zinc-700 transition-colors peer-checked:bg-emerald-500" />
                                  <span className="absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white transition-transform peer-checked:translate-x-3" />
                                </label>
                              </div>
                              <div className="bg-[#12151C]" />
                            </div>
                          )
                        })}

                      {customFinishes.map((finish) => (
                        <div key={finish.id} className="grid grid-cols-[auto_1fr_auto_auto_2.5rem] items-center gap-px border-t border-white/[0.04] bg-white/[0.04]">
                          <div className="bg-[#12151C] px-4 py-3">
                            <span className="block h-6 w-10 rounded-md border border-white/10" style={{ backgroundColor: finish.swatch_hex }} />
                          </div>
                          <div className="flex items-center gap-2 bg-[#12151C] px-4 py-3 text-sm text-zinc-200">
                            <span>{finish.label}</span>
                            <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-zinc-500">custom</span>
                          </div>
                          <div className="bg-[#12151C] px-4 py-3 text-xs uppercase tracking-wider text-zinc-500">{tierLabel(finish.tier as PricingTier)}</div>
                          <div className="bg-[#12151C] px-4 py-3 text-center text-xs text-emerald-400">✓</div>
                          <div className="flex items-center justify-center bg-[#12151C]">
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomFinish(finish.id)}
                              className="p-1.5 text-zinc-600 transition hover:text-red-400"
                              title="Delete custom finish"
                              aria-label={`Delete ${finish.label}`}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Add custom finish form */}
                    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] p-4 sm:flex-row sm:items-end">
                      <div className="w-full sm:w-24">
                        <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-widest text-zinc-500">Swatch</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={newFinish.swatch_hex}
                            onChange={(e) => setNewFinish((p) => ({ ...p, swatch_hex: e.target.value }))}
                            className="h-10 w-10 cursor-pointer rounded-lg border border-white/[0.06] bg-transparent p-1"
                            aria-label="Finish swatch color"
                          />
                        </div>
                      </div>
                      <div className="flex-1">
                        <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-widest text-zinc-500">Material Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Walnut Veneer"
                          value={newFinish.label}
                          onChange={(e) => setNewFinish((p) => ({ ...p, label: e.target.value }))}
                          className="w-full rounded-lg border border-white/[0.06] bg-[#12151C] px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-white/30"
                        />
                      </div>
                      <div className="w-full sm:w-36">
                        <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-widest text-zinc-500">Pricing Tier</label>
                        <select
                          value={newFinish.tier}
                          onChange={(e) => setNewFinish((p) => ({ ...p, tier: e.target.value as PricingTier }))}
                          className="w-full rounded-lg border border-white/[0.06] bg-[#12151C] px-3 py-2.5 text-sm text-white outline-none focus:border-white/30"
                        >
                          {PRICING_TIERS.map((t) => (
                            <option key={t} value={t}>{tierLabel(t)}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddCustomFinish}
                        disabled={addingFinish || !newFinish.label.trim()}
                        className="rounded-lg bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/20 disabled:opacity-50"
                      >
                        Add Material
                      </button>
                    </div>
                  </div>
                )}

                <div className="mb-8 border-t border-white/[0.04]" />
              </>
            )
          })()}

          {/* Add-ons — collapsible */}
          <button
            type="button"
            onClick={() => setAddonsOpen((o) => !o)}
            className="mb-5 flex w-full items-center justify-between gap-3 rounded-lg px-1 py-1 text-left transition hover:bg-white/[0.02]"
            aria-expanded={addonsOpen}
            aria-controls="addons-panel"
          >
            <div className="flex items-baseline gap-3">
              <h2 className="text-sm font-medium uppercase tracking-widest text-zinc-500">
                Manage Custom Add-ons
              </h2>
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                {addons.length} item{addons.length === 1 ? '' : 's'}
              </span>
            </div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`h-4 w-4 text-zinc-500 transition-transform ${addonsOpen ? 'rotate-180' : ''}`}
            >
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </button>
          {addonsOpen && (
          <div id="addons-panel" className="mb-10">
            {/* Add-on Builder */}
            <div className="mb-6 flex flex-col gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <AddonRoomScopePicker
                roomOptions={widgetRoomOptions}
                applyAllRooms={newAddon.apply_all_rooms}
                selectedRooms={newAddon.rooms}
                categoryLabel={categoryLabel}
                onChange={(applyAllRooms, selectedRooms) =>
                  setNewAddon((prev) => ({
                    ...prev,
                    apply_all_rooms: applyAllRooms,
                    rooms: selectedRooms,
                  }))
                }
              />
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-widest text-zinc-500">
                  Add-on Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Jewelry Tray"
                  value={newAddon.name}
                  onChange={(e) => setNewAddon(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-lg border border-white/[0.06] bg-[#12151C] px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-white/30"
                />
              </div>
              <div className="w-32">
                <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-widest text-zinc-500">
                  Price
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newAddon.price || ''}
                    onChange={(e) => setNewAddon(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                    className="w-full rounded-lg border border-white/[0.06] bg-[#12151C] py-2.5 pl-6 pr-3 text-sm text-white outline-none focus:border-white/30"
                  />
                </div>
              </div>
              <button
                onClick={handleAddAddon}
                disabled={
                  addingAddon ||
                  !newAddon.name.trim() ||
                  (!newAddon.apply_all_rooms && newAddon.rooms.length === 0)
                }
                className="rounded-lg bg-white/10 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-white/20 disabled:opacity-50"
              >
                Add Item
              </button>
              </div>
            </div>

            {/* Add-on List — grouped by room scope, each group collapsible */}
            {addons.length > 0 ? (
              <div className="space-y-2">
                {addonGroups.map((group) => (
                    <details
                      key={group.key}
                      className="group rounded-xl border border-white/[0.06] bg-[#12151C] open:bg-[#12151C]"
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-400 transition hover:text-zinc-200">
                        <span className="flex items-center gap-2">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="h-3.5 w-3.5 transition-transform group-open:rotate-90"
                          >
                            <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.06 10 7.23 6.29a.75.75 0 111.04-1.08l4.39 4.25a.75.75 0 010 1.08l-4.39 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                          </svg>
                          <span>{group.label}</span>
                        </span>
                        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium normal-case text-zinc-400">
                          {group.addons.length}
                        </span>
                      </summary>
                      <div className="border-t border-white/[0.04] px-4 py-3">
                        <AddonRoomScopePicker
                          roomOptions={widgetRoomOptions}
                          applyAllRooms={group.targets.length === 0}
                          selectedRooms={group.targets}
                          categoryLabel={categoryLabel}
                          onChange={(applyAllRooms, selectedRooms) =>
                            handleAddonScopeChange(
                              group.addons.map((a) => a.id),
                              applyAllRooms,
                              selectedRooms
                            )
                          }
                        />
                      </div>
                      <ul className="divide-y divide-white/[0.04] border-t border-white/[0.04]">
                        {group.addons.map((addon) => (
                          <li key={addon.id} className="flex items-center gap-3 px-4 py-3">
                            <input
                              type="text"
                              value={addon.name}
                              onChange={(e) => handleAddonNameChange(addon.id, e.target.value)}
                              onBlur={(e) => handleAddonNameBlur(addon.id, e.target.value)}
                              aria-label="Add-on name"
                              className="min-w-0 flex-1 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white outline-none transition focus:border-white/30 focus:bg-white/[0.08]"
                            />
                            <div className="relative w-28 shrink-0">
                              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-600">
                                $
                              </span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={addon.price || ''}
                                onChange={(e) => handleAddonPriceChange(addon.id, e.target.value)}
                                aria-label={`${addon.name} price`}
                                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] py-2 pl-7 pr-3 text-sm text-white outline-none transition focus:border-white/30 focus:bg-white/[0.08]"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteAddon(addon.id)}
                              className="shrink-0 p-1.5 text-zinc-600 transition hover:text-red-400"
                              title="Delete"
                              aria-label={`Delete ${addon.name}`}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </details>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/[0.06] p-8 text-center">
                <p className="text-sm text-zinc-500">No custom add-ons configured yet.</p>
              </div>
            )}
          </div>
          )}
          </>
            )
          })()}

          {/* Website Pages Manager */}
          <PageManager contractorId={form.id} />

          {/* Custom / purchased domains for the hosted site */}
          <DomainManager variant="dashboard" />

          {/* Save */}
          <div className="flex items-center gap-4">
            <button
              id="save-settings-btn"
              onClick={handleSave}
              disabled={saving}
              className="relative rounded-xl bg-white px-8 py-3.5 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:opacity-50"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <Spinner /> Saving…
                </span>
              ) : (
                'Save Settings'
              )}
            </button>
            {saved && (
              <span className="text-sm font-medium text-emerald-400 animate-fade-in">
                ✓ Saved successfully
              </span>
            )}
            {error && (
              <span className="text-sm font-medium text-red-400 animate-fade-in">
                ✕ {error}
              </span>
            )}
          </div>
        </section>

        {/* ─── Embed code ─── */}
        {embedRevealed && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 animate-fade-in backdrop-blur-sm">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-slate-300">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4"
                  >
                    <path
                      fillRule="evenodd"
                      d="M6.28 5.22a.75.75 0 010 1.06L2.56 10l3.72 3.72a.75.75 0 01-1.06 1.06L.97 10.53a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 0zm7.44 0a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L17.44 10l-3.72-3.72a.75.75 0 010-1.06zM11.377 2.011a.75.75 0 01.612.867l-2.5 14.5a.75.75 0 01-1.478-.255l2.5-14.5a.75.75 0 01.866-.612z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold tracking-tight">
                  Your Website Embed Code
                </h2>
              </div>
              {/* Copy button lives in the header so it never overlaps the
                  snippet text inside the <pre> block. */}
              <button
                id="copy-embed-btn"
                onClick={handleCopy}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-white/[0.08] hover:text-white"
              >
                {copied ? (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      className="h-3.5 w-3.5 text-emerald-400"
                    >
                      <path
                        fillRule="evenodd"
                        d="M12.416 3.376a.75.75 0 01.208 1.04l-5 7.5a.75.75 0 01-1.154.114l-3-3a.75.75 0 011.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 011.04-.207z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      className="h-3.5 w-3.5"
                    >
                      <path d="M5.5 3.5A1.5 1.5 0 017 2h2.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 01.439 1.061V9.5A1.5 1.5 0 0112 11V8.621a3 3 0 00-.879-2.121L9 4.379A3 3 0 006.879 3.5H5.5z" />
                      <path d="M4 5a1.5 1.5 0 00-1.5 1.5v6A1.5 1.5 0 004 14h5a1.5 1.5 0 001.5-1.5V8.621a1.5 1.5 0 00-.44-1.06L7.94 5.439A1.5 1.5 0 006.878 5H4z" />
                    </svg>
                    Copy
                  </>
                )}
              </button>
            </div>
            <p className="mb-5 text-sm text-zinc-500">
              Paste this snippet into your website&apos;s HTML to display the
              ClosetQuote Estimate Calculator widget.
            </p>

            <div>
              <pre className="overflow-x-auto rounded-xl border border-white/[0.06] bg-black/40 p-5 font-mono text-sm leading-relaxed text-slate-300">
                <code>{embedCode}</code>
              </pre>
            </div>
          </section>
        )}
          </div>

          {/* ─── Right Column: Live Sandbox Preview ─── */}
          <div className="sticky top-24 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight text-white">Live Sandbox Preview</h2>
              <span className="rounded-full bg-white/10 border border-white/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-slate-300">Interactive</span>
            </div>
            
            <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#12151C] shadow-2xl shadow-black/40">
              <div className="bg-white/[0.02] p-4 text-center border-b border-white/[0.04]">
                <p className="text-xs text-zinc-500">Your widget as it appears on your website</p>
              </div>
              <div className="p-6 bg-white min-h-[600px] flex items-center justify-center">
                {authChecked && form && (
                  <closet-quote-widget 
                    key={previewKey} 
                    data-contractor-id={form.id} 
                    data-api-url={typeof window !== 'undefined' ? window.location.origin : ''}
                    data-preview-color={form.primary_color_hex}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ─── Footer ─── */}
      <footer className="mt-auto border-t border-white/[0.04] py-6 text-center text-xs text-zinc-600">
        © {new Date().getFullYear()} ClosetQuote · All rights reserved
      </footer>
    </div>
  )
}

/* ─── Sub-components ───────────────────────────────────────────────── */

function AddonRoomScopePicker({
  roomOptions,
  applyAllRooms,
  selectedRooms,
  onChange,
  categoryLabel,
}: {
  roomOptions: string[]
  applyAllRooms: boolean
  selectedRooms: string[]
  onChange: (applyAllRooms: boolean, selectedRooms: string[]) => void
  categoryLabel?: string
}) {
  const toggleAllRooms = (checked: boolean) => {
    if (checked) {
      onChange(true, [])
      return
    }
    onChange(false, selectedRooms)
  }

  const toggleRoom = (room: string) => {
    const next = new Set(selectedRooms)
    if (next.has(room)) {
      next.delete(room)
    } else {
      next.add(room)
    }
    onChange(false, [...next])
  }

  return (
    <div>
      <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-zinc-500">
        Applies to
      </p>
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-zinc-200 transition hover:border-white/20">
          <input
            type="checkbox"
            className="rounded border-white/20 bg-transparent text-emerald-500 focus:ring-0 focus:ring-offset-0"
            checked={applyAllRooms}
            onChange={(e) => toggleAllRooms(e.target.checked)}
          />
          {categoryLabel ? `All ${categoryLabel.toLowerCase()}s` : 'All rooms'}
        </label>
        {roomOptions.map((room) => (
          <label
            key={room}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition ${
              !applyAllRooms && selectedRooms.includes(room)
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
                : 'border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:border-white/20'
            } ${applyAllRooms ? 'opacity-50' : ''}`}
          >
            <input
              type="checkbox"
              className="rounded border-white/20 bg-transparent text-emerald-500 focus:ring-0 focus:ring-offset-0"
              checked={!applyAllRooms && selectedRooms.includes(room)}
              disabled={applyAllRooms}
              onChange={() => toggleRoom(room)}
            />
            {room}
          </label>
        ))}
      </div>
      {!applyAllRooms && selectedRooms.length === 0 && (
        <p className="mt-2 text-xs text-amber-400/90">Select at least one {categoryLabel?.toLowerCase() || 'room'}.</p>
      )}
    </div>
  )
}

function SubscriptionBadge({
  status,
  trialEndsAt,
  plan,
  isDemo,
}: {
  status?: ContractorSettings['subscription_status']
  trialEndsAt?: string | null
  plan?: ContractorSettings['subscription_plan']
  isDemo?: boolean
}) {
  let label: string
  let dotClass: string
  let textClass: string
  let ringClass: string

  // Capture "now" once at mount so the render stays pure across re-renders.
  const nowMs = useState(() => Date.now())[0]

  if (isDemo) {
    label = 'Demo · Unlimited'
    dotClass = 'bg-emerald-400'
    textClass = 'text-emerald-300'
    ringClass = 'border-emerald-400/20 bg-emerald-400/5'
  } else if (status === 'active') {
    const planLabel = plan === 'yearly' ? 'Yearly' : plan === 'monthly' ? 'Monthly' : 'Active'
    label = `Pro · ${planLabel}`
    dotClass = 'bg-emerald-400'
    textClass = 'text-emerald-300'
    ringClass = 'border-emerald-400/20 bg-emerald-400/5'
  } else if (status === 'trialing') {
    const endsMs = trialEndsAt ? new Date(trialEndsAt).getTime() : 0
    const daysLeft = endsMs > nowMs
      ? Math.max(0, Math.ceil((endsMs - nowMs) / (1000 * 60 * 60 * 24)))
      : 0
    const urgent = daysLeft <= 7
    label = `Trial · ${daysLeft}d left`
    dotClass = urgent ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
    textClass = urgent ? 'text-amber-300' : 'text-emerald-300'
    ringClass = urgent
      ? 'border-amber-400/20 bg-amber-400/5'
      : 'border-emerald-400/20 bg-emerald-400/5'
  } else if (status === 'past_due' || status === 'unpaid') {
    label = 'Payment Issue'
    dotClass = 'bg-red-400 animate-pulse'
    textClass = 'text-red-300'
    ringClass = 'border-red-400/20 bg-red-400/5'
  } else if (status === 'canceled') {
    label = 'Canceled'
    dotClass = 'bg-slate-400'
    textClass = 'text-slate-300'
    ringClass = 'border-slate-400/20 bg-slate-400/5'
  } else {
    label = 'Inactive'
    dotClass = 'bg-slate-400'
    textClass = 'text-slate-300'
    ringClass = 'border-slate-400/20 bg-slate-400/5'
  }

  return (
    <Link
      href="/billing"
      className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition hover:opacity-80 ${ringClass} ${textClass}`}
      title="Manage subscription"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      {label}
    </Link>
  )
}

function TrialBanner({
  status,
  trialEndsAt,
  isDemo,
}: {
  status?: ContractorSettings['subscription_status']
  trialEndsAt?: string | null
  isDemo?: boolean
}) {
  // Capture "now" once at mount so the render stays pure across re-renders.
  const now = useState(() => Date.now())[0]
  if (isDemo) return null
  if (status === 'active') return null
  const endsMs = trialEndsAt ? new Date(trialEndsAt).getTime() : 0
  const daysLeft = endsMs > now
    ? Math.max(0, Math.ceil((endsMs - now) / (1000 * 60 * 60 * 24)))
    : 0

  // If the trial has expired the middleware should already have redirected
  // to /billing, so this branch is mostly defensive.
  if (daysLeft <= 0) return null

  const urgent = daysLeft <= 7

  return (
    <div className="mb-8 flex flex-col items-start justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-5 py-4 backdrop-blur-sm sm:flex-row sm:items-center">
      <div className="flex items-center gap-3">
        <span
          className={`h-2 w-2 rounded-full ${urgent ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}
        />
        <p className="text-sm text-slate-300">
          <span className="font-semibold text-white">{daysLeft} day{daysLeft === 1 ? '' : 's'}</span>
          {' '}left in your free trial.
        </p>
      </div>
      <Link
        href="/billing"
        className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black transition hover:bg-slate-200"
      >
        Upgrade to Pro
      </Link>
    </div>
  )
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
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
