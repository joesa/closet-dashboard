/**
 * The registry of designs already shipped, and the prompt block that shows them
 * to the model.
 *
 * Two jobs. First, collision detection: a candidate Full redesign must not reuse
 * another artifact's composition and visual system. Second — and this is the
 * half that actually improves output — an avoid-list the enhancer and the site
 * generator both see up front, so the model steers away from taken directions
 * instead of being rejected afterwards.
 *
 * The avoid-list is load-bearing here in a way it would not be for most
 * pipelines: aiTextProvider deliberately does not send `temperature` to Claude
 * (the models reject it), and Full redesign uses a fixed provider chain, so sampling
 * variation is not available as a diversity lever. Prompt content is the lever.
 *
 * Every read is non-fatal. If the table is missing, unreachable, or the query
 * errors, callers get an empty list and the redesign proceeds exactly as it did
 * before this feature existed — a uniqueness check is not worth failing a
 * 40-minute job over. Same posture as resolveDesignSeed's missing-column
 * back-compat.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { CustomSiteConfig } from '@/lib/customSite'
import {
  CUSTOM_FINGERPRINT_VERSION,
  describeFingerprintForAvoidList,
  extractCustomDesignFingerprint,
  fingerprintKeys,
  isDesignCollision,
  visualSimilarity,
  type CustomDesignFingerprint,
} from '@/lib/design/customDesignFingerprint'
import {
  AVOID_LIST_MAX_CHARS,
  AVOID_LIST_MAX_ROWS,
} from '@/lib/validation/designGuardPolicy'

const TABLE = 'custom_design_fingerprints'

export type TakenDesign = {
  tenantId: string
  fingerprint: CustomDesignFingerprint
  signatureConcept: string | null
  industryKey?: string | null
  marketKey?: string | null
  updatedAt?: string | null
}

export type FontUsage = {
  fontKey: string
  updatedAt: string | null
  sameIndustry: boolean
  sameMarket: boolean
}

export type DesignAvoidList = {
  taken: TakenDesign[]
  takenSkeletonKeys: string[]
  takenPaletteKeys: string[]
  takenFontKeys: string[]
  fontUsage?: FontUsage[]
  /** Ready-to-paste prompt section, capped at AVOID_LIST_MAX_CHARS. Empty when nothing is taken. */
  promptBlock: string
}

export const EMPTY_AVOID_LIST: DesignAvoidList = {
  taken: [],
  takenSkeletonKeys: [],
  takenPaletteKeys: [],
  takenFontKeys: [],
  fontUsage: [],
  promptBlock: '',
}

function isFingerprint(value: unknown): value is CustomDesignFingerprint {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<CustomDesignFingerprint>
  return Array.isArray(v.skeleton) && typeof v.version === 'number'
}

/** Trim a `label: a · b · c` line so the whole block stays inside the budget. */
function joinCapped(label: string, values: string[], max: number): string {
  if (values.length === 0) return ''
  let line = `${label}: `
  const kept: string[] = []
  for (const value of values) {
    if (line.length + value.length + 3 > max) break
    kept.push(value)
    line = `${label}: ${kept.join(' · ')}`
  }
  return kept.length > 0 ? line : ''
}

export function buildAvoidPromptBlock(taken: TakenDesign[]): string {
  if (taken.length === 0) return ''
  const budget = Math.floor(AVOID_LIST_MAX_CHARS / 4)

  const skeletons = Array.from(
    new Set(taken.map((t) => t.fingerprint.skeleton.join('→')).filter(Boolean))
  )
  const palettes = Array.from(
    new Set(taken.map((t) => t.fingerprint.paletteBuckets.join(' ')).filter(Boolean))
  )
  const fonts = Array.from(
    new Set(
      taken
        .map((t) => [t.fingerprint.fonts.display, t.fingerprint.fonts.body].filter(Boolean).join(' + '))
        .filter(Boolean)
    )
  )
  const concepts = Array.from(
    new Set(taken.map((t) => t.signatureConcept?.trim()).filter((c): c is string => !!c))
  ).map((c) => `"${c.slice(0, 60)}"`)

  const lines = [
    '# ALREADY USED ON THIS PLATFORM — your direction must differ from every line below',
    joinCapped('Home section rhythms in use', skeletons, budget),
    joinCapped('Palettes in use (hue-lightness-chroma buckets)', palettes, budget),
    joinCapped('Type pairings in use', fonts, budget),
    joinCapped('Signature concepts already claimed', concepts, budget),
    'Your complete visual system MUST differ from every design above. A build is rejected when section rhythm alone matches OR when the weighted combination of composition, palette, typography, geometry, and motifs remains too similar. Recoloring or reordering the same template is not sufficient.',
  ].filter(Boolean)

  return lines.join('\n').slice(0, AVOID_LIST_MAX_CHARS)
}

/**
 * Designs already generated platform-wide, including this tenant's own history.
 * Published rows come first so a live site outranks somebody's abandoned draft.
 */
export async function loadDesignAvoidList(opts: {
  supabase: SupabaseClient
  /** Same-tenant history is included so repeated Full redesigns cannot converge. */
  tenantId: string
  /** Publish validation excludes only the exact candidate draft already recorded. */
  excludeFingerprintHash?: string
  industryKey?: string | null
  marketKey?: string | null
  limit?: number
}): Promise<DesignAvoidList> {
  try {
    const { data, error } = await opts.supabase
      .from(TABLE)
      .select('tenant_id, fingerprint, signature_concept, status, industry_key, market_key, updated_at')
      .eq('version', CUSTOM_FINGERPRINT_VERSION)
      .order('status', { ascending: false }) // 'published' before 'draft'
      .order('updated_at', { ascending: false })
      .limit(opts.limit ?? AVOID_LIST_MAX_ROWS)

    if (error || !Array.isArray(data)) {
      if (error) {
        console.warn('[designAvoidList] load skipped:', error.message)
      }
      return EMPTY_AVOID_LIST
    }

    const taken: TakenDesign[] = []
    const seenHashes = new Set<string>()
    for (const row of data) {
      const tenantId = typeof row.tenant_id === 'string' ? row.tenant_id : ''
      if (!tenantId) continue
      if (!isFingerprint(row.fingerprint)) continue
      if (
        opts.excludeFingerprintHash &&
        tenantId === opts.tenantId &&
        row.fingerprint.hash === opts.excludeFingerprintHash
      ) {
        continue
      }
      if (seenHashes.has(row.fingerprint.hash)) continue
      seenHashes.add(row.fingerprint.hash)
      taken.push({
        tenantId,
        fingerprint: row.fingerprint,
        signatureConcept:
          typeof row.signature_concept === 'string' ? row.signature_concept : null,
        industryKey: typeof row.industry_key === 'string' ? row.industry_key : null,
        marketKey: typeof row.market_key === 'string' ? row.market_key : null,
        updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
      })
    }

    return {
      taken,
      takenSkeletonKeys: taken.map((t) => fingerprintKeys(t.fingerprint).skeletonKey),
      takenPaletteKeys: taken.map((t) => fingerprintKeys(t.fingerprint).paletteKey),
      takenFontKeys: taken.map((t) => fingerprintKeys(t.fingerprint).fontKey),
      fontUsage: taken.map((t) => ({
        fontKey: fingerprintKeys(t.fingerprint).fontKey,
        updatedAt: t.updatedAt || null,
        sameIndustry: !!opts.industryKey && t.industryKey === opts.industryKey,
        sameMarket: !!opts.marketKey && t.marketKey === opts.marketKey,
      })),
      promptBlock: buildAvoidPromptBlock(taken),
    }
  } catch (err) {
    console.warn('[designAvoidList] load failed:', err)
    return EMPTY_AVOID_LIST
  }
}

/**
 * Prior designs whose complete visual system this candidate reproduces.
 * Sorted worst-first so the caller can name the closest match.
 */
export function findDesignCollisions(
  candidate: CustomDesignFingerprint,
  taken: TakenDesign[],
  threshold?: number
): Array<{ tenantId: string; score: number; signatureConcept: string | null }> {
  return taken
    .map((t) => ({
      tenantId: t.tenantId,
      score: visualSimilarity(candidate, t.fingerprint),
      collides: isDesignCollision(candidate, t.fingerprint, threshold),
      signatureConcept: t.signatureConcept,
    }))
    .filter((row) => row.collides)
    .sort((a, b) => b.score - a.score)
    .map(({ collides: _collides, ...row }) => row)
}

/**
 * Record a distinct tenant design. History is retained so a later Full redesign
 * must differ from this tenant's own prior attempts as well as every other site.
 *
 * Non-fatal by design — a failed write must never fail a redesign or a publish.
 * Returns the fingerprint regardless so callers can still use it in-memory.
 */
export async function recordCustomDesignFingerprint(opts: {
  supabase: SupabaseClient
  tenantId: string
  status: 'draft' | 'published'
  config: CustomSiteConfig
  signatureConcept?: string | null
  industryKey?: string | null
  marketKey?: string | null
}): Promise<CustomDesignFingerprint> {
  const fingerprint = extractCustomDesignFingerprint(opts.config)
  const keys = fingerprintKeys(fingerprint)
  try {
    const { error } = await opts.supabase.from(TABLE).upsert(
      {
        tenant_id: opts.tenantId,
        version: fingerprint.version,
        status: opts.status,
        skeleton_key: keys.skeletonKey,
        palette_key: keys.paletteKey,
        font_key: keys.fontKey,
        shape_key: keys.shapeKey,
        motif_key: keys.motifKey,
        artifact_hash: fingerprint.hash,
        fingerprint,
        signature_concept: opts.signatureConcept ?? null,
        industry_key: opts.industryKey ?? null,
        market_key: opts.marketKey ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,status,artifact_hash' }
    )
    if (error) console.warn('[designAvoidList] record skipped:', error.message)
  } catch (err) {
    console.warn('[designAvoidList] record failed:', err)
  }
  return fingerprint
}

/** One-line summary of the taken rhythms, for the DIRECTION LOCK block. */
export function describeTakenSkeletons(avoid: DesignAvoidList, max = 6): string {
  const rhythms = Array.from(
    new Set(avoid.taken.map((t) => t.fingerprint.skeleton.join('→')).filter(Boolean))
  ).slice(0, max)
  return rhythms.join(' · ')
}

export { describeFingerprintForAvoidList }
