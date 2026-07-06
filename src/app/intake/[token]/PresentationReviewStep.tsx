'use client'

import { useEffect, useState } from 'react'
import {
  THEME_LAYOUT_AFFINITY,
  LAYOUT_SLUGS,
  type ThemeSlug,
  type LayoutSlug,
} from '@/lib/catalog/sitePresentationCatalog'
import {
  SURFACE_TOKENS,
  SHAPE_TOKENS,
  VOICE_TOKENS,
  SWATCH_TOKENS,
  SWATCH_HEX,
  type ThemeTokenSelection,
} from '@/lib/catalog/themeTokenPools'

function tokenDescription(pool: readonly { id: string; description: string }[], id: string): string {
  return pool.find((t) => t.id === id)?.description ?? id
}

function synthesizedTagline(tokens: ThemeTokenSelection): string {
  return `${tokenDescription(SURFACE_TOKENS, tokens.surface)} · ${tokenDescription(SHAPE_TOKENS, tokens.shape)} · ${tokenDescription(VOICE_TOKENS, tokens.voice)}`
}

// ─── Metadata ───────────────────────────────────────────────────────────────

const THEME_META: Record<string, { label: string; tagline: string; color: string }> = {
  'luxury-minimal':    { label: 'Luxury Minimal',      tagline: 'Clean lines, high-end feel',          color: '#0f172a' },
  'brutalist':         { label: 'Bold Industrial',     tagline: 'Strong, assertive, no-nonsense',      color: '#27272a' },
  'classic-warm':      { label: 'Classic Warm',        tagline: 'Timeless & inviting',                 color: '#92400e' },
  'modern-office':     { label: 'Modern Office',       tagline: 'Clean & professional',                color: '#1d4ed8' },
  'playful-kids':      { label: 'Playful & Friendly',  tagline: 'Fun, bright, approachable',           color: '#7c3aed' },
  'rustic-pantry':     { label: 'Rustic Natural',      tagline: 'Earthy, warm, handcrafted',           color: '#854d0e' },
  'sleek-entertainment': { label: 'Sleek Entertainment', tagline: 'High-tech, media-forward',          color: '#1e1b4b' },
  'elegant-dressing':  { label: 'Elegant Dressing',    tagline: 'Fashion-forward & refined',           color: '#831843' },
  'functional-utility':{ label: 'Functional Utility',  tagline: 'Practical & no-frills',               color: '#374151' },
  'fresh-clean':       { label: 'Fresh & Clean',       tagline: 'Crisp, hygienic, reliable',           color: '#0891b2' },
  'warm-handyman':     { label: 'Warm Handyman',       tagline: 'Trustworthy, neighborly',             color: '#c2410c' },
  'commercial-pro':    { label: 'Commercial Pro',      tagline: 'Business-grade credibility',          color: '#1e40af' },
  'swift-mobile':      { label: 'Swift Mobile',        tagline: 'Fast, on-demand service',             color: '#15803d' },
  'stone-masonry':     { label: 'Stone Masonry',       tagline: 'Solid, durable craftsmanship',        color: '#57534e' },
  'rich-flooring':     { label: 'Rich Flooring',       tagline: 'Premium, texture-forward',            color: '#a16207' },
  'artisan-wood':      { label: 'Artisan Wood',        tagline: 'Handcrafted & warm',                  color: '#78350f' },
  'garage-industrial': { label: 'Garage Industrial',   tagline: 'Tough, built to last',                color: '#3f3f46' },
  'home-guardian':     { label: 'Home Guardian',       tagline: 'Safe, trusted, dependable',           color: '#1e3a5f' },
  'eco-solar':         { label: 'Eco Solar',           tagline: 'Green, forward-thinking',             color: '#16a34a' },
  'care-comfort':      { label: 'Care & Comfort',      tagline: 'Gentle, caring, personal',            color: '#9d174d' },
  'pool-resort':       { label: 'Pool Resort',         tagline: 'Aqua luxury & relaxation',            color: '#0369a1' },
  'coastal-climate':   { label: 'Coastal Climate',     tagline: 'Breezy, outdoor-ready',               color: '#0891b2' },
  'minimalist-zen':    { label: 'Minimalist Zen',      tagline: 'Calm, simple, balanced',              color: '#6b7280' },
  'bold-remodel':      { label: 'Bold Remodel',        tagline: 'Dramatic before-&-after impact',      color: '#7c2d12' },
  'winter-ready':      { label: 'Winter Ready',        tagline: 'Seasonal urgency, snow & ice',        color: '#1e3a5f' },
  'event-festive':     { label: 'Event Festive',       tagline: 'Celebratory & energetic',             color: '#7e22ce' },
  'wellness-calm':     { label: 'Wellness Calm',       tagline: 'Soothing, health-focused',            color: '#065f46' },
  'fleet-logistics':   { label: 'Fleet Logistics',     tagline: 'Efficient, route-focused',            color: '#1e40af' },
  'media-creative':    { label: 'Media Creative',      tagline: 'Visual-first, portfolio-driven',      color: '#1e1b4b' },
  'gourmet-warm':      { label: 'Gourmet Warm',        tagline: 'Rich, foodie-forward',                color: '#7c2d12' },
}

function themeLabel(slug: string): string {
  return THEME_META[slug]?.label ?? slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
function themeTagline(slug: string): string {
  return THEME_META[slug]?.tagline ?? 'Custom style'
}
function themeColor(slug: string): string {
  return THEME_META[slug]?.color ?? '#4f46e5'
}

const LAYOUT_META: Record<string, { label: string; tagline: string; icon: string }> = {
  'standard':          { label: 'Standard',            tagline: 'Balanced, versatile layout',          icon: '⊞' },
  'portfolio-first':   { label: 'Portfolio First',     tagline: 'Lead with project photos',            icon: '🖼️' },
  'conversion-focus':  { label: 'Conversion Focus',    tagline: 'CTAs above the fold',                 icon: '⚡' },
  'storyteller':       { label: 'Storyteller',         tagline: 'Brand narrative & trust',             icon: '📖' },
  'minimalist-lead':   { label: 'Minimalist',          tagline: 'Simple, direct, fast',                icon: '○' },
  'visual-impact':     { label: 'Visual Impact',       tagline: 'Full-bleed imagery',                  icon: '✦' },
  'trust-builder':     { label: 'Trust Builder',       tagline: 'Reviews, credentials, proof',         icon: '🏅' },
  'gallery-showcase':  { label: 'Gallery Showcase',    tagline: 'Photo grid takes center stage',       icon: '⊡' },
  'local-expert':      { label: 'Local Expert',        tagline: 'Neighborhood authority',              icon: '📍' },
  'compact-quote':     { label: 'Compact Quote',       tagline: 'Quote form up front',                 icon: '✉' },
  'emergency-first':   { label: 'Emergency First',     tagline: 'Phone number & urgency prominent',    icon: '🚨' },
  'before-after':      { label: 'Before & After',      tagline: 'Transformation photos',               icon: '↔' },
  'process-steps':     { label: 'Process Steps',       tagline: 'Numbered how-it-works',               icon: '1→' },
  'seasonal-cta':      { label: 'Seasonal CTA',        tagline: 'Time-sensitive seasonal push',        icon: '📅' },
  'trust-report':      { label: 'Trust Report',        tagline: 'Inspection-style summary + badges',   icon: '📋' },
  'service-zones':     { label: 'Service Zones',       tagline: 'Coverage area & delivery radius',     icon: '🗺️' },
  'event-booking':     { label: 'Event Booking',       tagline: 'Date picker & package selection',     icon: '🗓️' },
}

function layoutLabel(slug: string): string {
  return LAYOUT_META[slug]?.label ?? slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
function layoutTagline(slug: string): string {
  return LAYOUT_META[slug]?.tagline ?? 'Page layout style'
}
function layoutIcon(slug: string): string {
  return LAYOUT_META[slug]?.icon ?? '□'
}

// ─── Component ──────────────────────────────────────────────────────────────

type Props = {
  aiTheme: string
  aiLayout: string
  selectedTheme: string
  selectedLayout: string
  allowedThemes: string[]
  allowedLayouts: string[]
  themeTokens?: ThemeTokenSelection | null
  isSynthesized?: boolean
  isAdmin?: boolean
  onThemeChange: (t: string) => void
  onLayoutChange: (l: string) => void
  onBack: () => void
  onConfirm: () => void
  submitting: boolean
  error?: string
}

export default function PresentationReviewStep({
  aiTheme,
  aiLayout,
  selectedTheme,
  selectedLayout,
  allowedThemes,
  allowedLayouts,
  themeTokens,
  isSynthesized,
  isAdmin = false,
  onThemeChange,
  onLayoutChange,
  onBack,
  onConfirm,
  submitting,
  error,
}: Props) {
  const [showAllThemes, setShowAllThemes] = useState(false)
  const [showAllLayouts, setShowAllLayouts] = useState(false)
  // True while the reviewer is still on the AI-synthesized "last resort" look
  // (as opposed to having picked a different real named theme instead).
  const showingSynthesized = !!isSynthesized && !!themeTokens && selectedTheme === aiTheme

  // Compute which layouts are compatible with the currently selected theme
  const compatibleLayouts: string[] = (THEME_LAYOUT_AFFINITY[selectedTheme as ThemeSlug] ?? []) as string[]
  // Show: overlap of allowedLayouts with compatibleLayouts, falling back to all allowed
  const layoutPool = allowedLayouts.filter((l) => compatibleLayouts.includes(l))
  const narrowedLayouts = layoutPool.length >= 2 ? layoutPool : (compatibleLayouts.length >= 2 ? compatibleLayouts : allowedLayouts)
  // "Browse all layouts" escapes the narrow theme+industry intersection
  // above (which can shrink to as few as 2 options) and shows every layout
  // in the catalog, same as the theme picker's "Browse all themes" toggle.
  const layoutsToShow = showAllLayouts ? [...LAYOUT_SLUGS] : narrowedLayouts

  // If the current selectedLayout is not compatible after theme change, auto-pick first compatible
  useEffect(() => {
    if (layoutsToShow.length > 0 && !layoutsToShow.includes(selectedLayout)) {
      onLayoutChange(layoutsToShow[0])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTheme])

  const displayThemes = showAllThemes ? (Array.from(new Set([...allowedThemes, ...Object.keys(THEME_META)]))) : allowedThemes

  return (
    <div className="rounded-xl border-2 border-indigo-400 bg-white p-6 shadow-md">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-gray-900">Review your site&apos;s look</h2>
        <p className="mt-1 text-sm text-gray-500">
          We picked these based on your services and style preferences. You can keep them or choose different ones below.
        </p>
      </div>

      {/* AI picks summary */}
      <div className="mb-6 flex gap-3 flex-wrap">
        {showingSynthesized ? (
          <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700">
            ✨ We designed a bespoke look for your business — no existing template was a strong fit for your industry
          </span>
        ) : (
          <span className="rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs font-semibold text-indigo-700">
            ✨ AI picked: <strong>{themeLabel(aiTheme)}</strong> theme + <strong>{layoutLabel(aiLayout)}</strong> layout
          </span>
        )}
        {(selectedTheme !== aiTheme || selectedLayout !== aiLayout) && (
          <span className="rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-700">
            ↳ Your choice: <strong>{themeLabel(selectedTheme)}</strong> + <strong>{layoutLabel(selectedLayout)}</strong>
          </span>
        )}
      </div>

      {/* ── Bespoke synthesized design card (last-resort case only) ── */}
      {showingSynthesized && themeTokens && (
        <div className="mb-6 rounded-xl border-2 border-emerald-400 ring-2 ring-emerald-100 overflow-hidden">
          <div className="h-8 w-full" style={{ backgroundColor: SWATCH_HEX[themeTokens.swatch] ?? '#4f46e5' }} />
          <div className="px-4 py-3 bg-white">
            <p className="text-sm font-bold text-gray-900">Your custom bespoke design</p>
            <p className="text-xs text-gray-500 mt-0.5">{synthesizedTagline(themeTokens)} · {tokenDescription(SWATCH_TOKENS, themeTokens.swatch)} accent</p>
          </div>
        </div>
      )}

      {/* ── Theme picker (admin only) ── */}
      {isAdmin && (
        <div className="mb-6">
          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3">Theme</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {displayThemes.map((slug) => {
              const active = slug === selectedTheme
              return (
                <button
                  key={slug}
                  type="button"
                  onClick={() => onThemeChange(slug)}
                  className={`relative text-left rounded-xl border-2 overflow-hidden transition-all focus:outline-none ${
                    active
                      ? 'border-indigo-500 ring-2 ring-indigo-300 shadow-md'
                      : 'border-gray-200 hover:border-indigo-300 hover:shadow-sm'
                  }`}
                >
                  {/* Color strip */}
                  <div
                    className="h-8 w-full"
                    style={{ backgroundColor: themeColor(slug) }}
                  />
                  <div className="px-3 py-2">
                    <p className="text-xs font-bold text-gray-900 leading-tight">{themeLabel(slug)}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">{themeTagline(slug)}</p>
                  </div>
                  {active && (
                    <span className="absolute top-1.5 right-1.5 rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white">✓</span>
                  )}
                  {slug === aiTheme && !active && (
                    <span className="absolute top-1.5 right-1.5 rounded-full bg-gray-100 border border-gray-300 px-1.5 py-0.5 text-[10px] text-gray-500">AI</span>
                  )}
                </button>
              )
            })}
          </div>
          <button
            type="button"
            onClick={() => setShowAllThemes((v) => !v)}
            className="mt-3 text-xs font-semibold text-indigo-600 hover:underline"
          >
            {showAllThemes ? '↑ Show fewer themes' : `↓ Browse all themes`}
          </button>
        </div>
      )}

      {/* ── Layout picker (admin only) ── */}
      {isAdmin && (
        <div className="mb-6">
          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3">Page layout</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {layoutsToShow.map((slug) => {
              const active = slug === selectedLayout
              return (
                <button
                  key={slug}
                  type="button"
                  onClick={() => onLayoutChange(slug)}
                  className={`flex items-start gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition-all focus:outline-none ${
                    active
                      ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-300'
                      : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-xl mt-0.5 select-none">{layoutIcon(slug)}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900 leading-tight">{layoutLabel(slug)}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">{layoutTagline(slug)}</p>
                  </div>
                  {active && (
                    <span className="ml-auto rounded-full bg-indigo-600 w-4 h-4 flex items-center justify-center text-white text-[10px] shrink-0">✓</span>
                  )}
                </button>
              )
            })}
          </div>
          <button
            type="button"
            onClick={() => setShowAllLayouts((v) => !v)}
            className="mt-3 text-xs font-semibold text-indigo-600 hover:underline"
          >
            {showAllLayouts ? '↑ Show fewer layouts' : '↓ Browse all layouts'}
          </button>
        </div>
      )}

      {/* Errors */}
      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          ← Back to form
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={submitting}
          className="flex-1 rounded-lg bg-indigo-600 px-6 py-2.5 font-bold text-white hover:bg-indigo-500 disabled:opacity-50 text-sm"
        >
          {submitting ? 'Submitting…' : 'Confirm & Submit →'}
        </button>
      </div>
    </div>
  )
}
