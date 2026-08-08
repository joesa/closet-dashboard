import { generateTextWithFallback } from '@/lib/ai/aiTextProvider'
import { generateWithQualityRetry } from '@/lib/ai/generateWithQualityRetry'
import { findAiTellPhrases, HUMAN_COPY_VOICE_RULES } from '@/lib/ai/humanCopyVoice'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { validateTenantSite, saveValidationReport, type ValidationReport } from '@/lib/validation/siteValidator'
import { THEME_LAYOUT_AFFINITY, type ThemeSlug, type LayoutSlug } from '@/lib/catalog/sitePresentationCatalog'
import { resolveDesignSeed } from '@/lib/provision/resolveDesignSeed'
import { themeHeroUrl } from '@/lib/provision/buildTemplateSiteConfig'
import { revalidateTenantSiteCache } from '@/lib/tenants/revalidateTenantSite'
import { buildDefaultProcess } from '@/lib/provision/defaultCopy'

export type AutoFixResult = {
  report: ValidationReport
  fixesApplied: string[]
  unfixedIssues: string[]
  aiNote: string
}

const DEFAULT_ANCHOR_NAV = (ctaLabel: string) => [
  { label: 'Home', slug: '/' },
  { label: 'About', slug: '/#about' },
  { label: 'Our Work', slug: '/#portfolio' },
  { label: ctaLabel, slug: '/#quote' },
]

/**
 * Deterministically repairs whatever `fixable: true` issues the last
 * validation run found, then re-validates. Deterministic (not LLM-driven)
 * for the structural issues, since exact-correct-answer functions already
 * exist for all of them (layoutsForTheme, the anchor-nav default,
 * resolveDesignSeed) — an LLM would be strictly worse (slower, non-
 * deterministic, and no better informed) at picking a valid theme/layout
 * pairing than the catalog's own affinity table. Gemini is used only for the
 * one genuinely-subjective part: writing a short, human-readable summary of
 * what changed and what still needs manual attention, for the admin UI.
 */
export async function autoFixTenantSite(
  tenantId: string,
  opts?: { codes?: string[] }
): Promise<AutoFixResult> {
  const supabase = getSupabaseAdmin()
  const before = await validateTenantSite(tenantId)
  const onlyCodes =
    Array.isArray(opts?.codes) && opts.codes.length > 0
      ? new Set(opts.codes.filter((c) => typeof c === 'string' && c.trim()))
      : null

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, widget_id, business_name, site_configs ( theme, layout_style, design_variant, nav_links, hero_config, before_after_config, products_config, brand_name, engagement_model, process_config )')
    .eq('id', tenantId)
    .maybeSingle()

  const config = tenant
    ? ((Array.isArray(tenant.site_configs) ? tenant.site_configs[0] : tenant.site_configs) as {
        theme?: string
        layout_style?: string
        design_variant?: string | null
        nav_links?: unknown[] | null
        hero_config?: Record<string, unknown> | null
        before_after_config?: Record<string, unknown> | null
        products_config?: { image?: string }[] | null
        brand_name?: string | null
        engagement_model?: string | null
        process_config?: {
          title?: string
          subtitle?: string
          steps?: { number?: string; title?: string; description?: string }[]
        } | null
      } | null)
    : null

  const fixesApplied: string[] = []
  const unfixedIssues: string[] = []
  const updates: Record<string, unknown> = {}
  const copyTellSamples = new Set<string>()

  for (const issue of before.issues) {
    if (!issue.fixable) {
      if (issue.severity === 'error') unfixedIssues.push(issue.message)
      continue
    }
    if (onlyCodes && !onlyCodes.has(issue.code)) continue

    switch (issue.code) {
      case 'theme_layout_mismatch': {
        const theme = config?.theme as ThemeSlug | undefined
        const affinity = theme ? THEME_LAYOUT_AFFINITY[theme] : undefined
        if (theme && affinity && affinity.length > 0) {
          updates.layout_style = affinity[0]
          fixesApplied.push(`Changed layout from "${config?.layout_style}" to "${affinity[0]}" — a valid pairing for theme "${theme}".`)
        } else {
          unfixedIssues.push(issue.message)
        }
        break
      }

      case 'missing_nav_links': {
        const em = config?.engagement_model
        const ctaLabel = em === 'order' ? 'Order'
          : em === 'booking' ? 'Book Now'
          : em === 'ticket' ? 'Get Tickets'
          : 'Get Quote'
        updates.nav_links = DEFAULT_ANCHOR_NAV(ctaLabel)
        fixesApplied.push(`Added a default in-page anchor nav (Home / About / Our Work / ${ctaLabel}) so the themed Navbar now renders.`)
        break
      }

      case 'duplicate_design': {
        const theme = config?.theme as ThemeSlug | undefined
        if (theme) {
          const newSeed = await resolveDesignSeed({
            supabase,
            theme,
            answers: [config?.brand_name, tenant?.widget_id],
            fallbackId: `${tenantId}-refresh`,
            excludeTenantId: tenantId,
          })
          updates.design_variant = newSeed
          fixesApplied.push('Re-seeded the design variant so this site no longer shares an identical design fingerprint with another tenant on the same theme.')
        } else {
          unfixedIssues.push(issue.message)
        }
        break
      }

      case 'broken_image': {
        const brokenUrl = issue.meta?.url as string | undefined
        const theme = (config?.theme as ThemeSlug | undefined) || 'luxury-minimal'
        const fallback = themeHeroUrl(theme)
        let patched = false
        const heroCfg = updates.hero_config as { backgroundImage?: string } | undefined
        if (brokenUrl && (heroCfg?.backgroundImage === brokenUrl || config?.hero_config?.backgroundImage === brokenUrl)) {
          updates.hero_config = { ...(config?.hero_config || {}), backgroundImage: fallback }
          patched = true
        }
        const baCfg = config?.before_after_config as { beforeImage?: string; afterImage?: string } | undefined
        if (brokenUrl && baCfg && (baCfg.beforeImage === brokenUrl || baCfg.afterImage === brokenUrl)) {
          updates.before_after_config = {
            ...baCfg,
            beforeImage: baCfg.beforeImage === brokenUrl ? fallback : baCfg.beforeImage,
            afterImage: baCfg.afterImage === brokenUrl ? fallback : baCfg.afterImage,
          }
          patched = true
        }
        if (brokenUrl && Array.isArray(config?.products_config)) {
          const patchedProducts = config.products_config.map((p) => (p.image === brokenUrl ? { ...p, image: fallback } : p))
          if (patchedProducts.some((p, i) => p.image !== config?.products_config?.[i]?.image)) {
            updates.products_config = patchedProducts
            patched = true
          }
        }
        if (patched) {
          fixesApplied.push(`Replaced a broken image (${brokenUrl?.slice(0, 80)}) with a known-good theme photo.`)
        } else {
          unfixedIssues.push(issue.message)
        }
        break
      }

      case 'copy_ai_tell_phrase': {
        // Collect samples across pages; repaired once, after the loop, so a
        // phrase appearing on three pages triggers one rewrite pass, not three.
        const samples = Array.isArray(issue.meta?.samples) ? issue.meta.samples : []
        let collected = 0
        for (const s of samples) {
          if (typeof s === 'string' && s.trim()) {
            copyTellSamples.add(s.trim())
            collected++
          }
        }
        if (collected === 0) unfixedIssues.push(issue.message)
        break
      }

      case 'invalid_process_steps': {
        const brandName = config?.brand_name || tenant?.business_name || 'Your Business'
        const currentProcess = config?.process_config || {}
        const fixedProcess = await fixProcessStepsWithAi(tenantId, brandName, currentProcess)
        updates.process_config = fixedProcess
        fixesApplied.push('Regenerated and correctly numbered the process steps using AI to form a complete 3-step sequence starting with 01.')
        break
      }

      default:
        unfixedIssues.push(issue.message)
    }
  }

  if (copyTellSamples.size > 0) {
    const repair = await repairCopyTells(tenantId, [...copyTellSamples], updates)
    if (repair.fixed.length > 0) {
      fixesApplied.push(
        `Rewrote ${repair.fixed.length} copy string${repair.fixed.length === 1 ? '' : 's'} that contained banned AI marketing phrases (${[...copyTellSamples].slice(0, 4).join(', ')}${copyTellSamples.size > 4 ? ', …' : ''}).`
      )
    }
    if (repair.unfixed.length > 0) {
      unfixedIssues.push(
        `Could not automatically rewrite ${repair.unfixed.length} copy string${repair.unfixed.length === 1 ? '' : 's'} containing banned phrases — the phrases may live in generated page HTML rather than the site config, or the rewrite failed the copy gate. Manual edit needed.`
      )
    }
  }

  if (Object.keys(updates).length > 0) {
    await supabase.from('site_configs').update(updates).eq('tenant_id', tenantId)
    // Bust the tenant site's config cache so the fixes are live immediately
    // (and so the re-validation crawl below sees the fixed site, not a stale
    // cached render of the broken one).
    await revalidateTenantSiteCache(tenantId)
  }

  const after = await validateTenantSite(tenantId)
  await saveValidationReport(tenantId, after)

  const aiNote = await summarizeFixes({
    fixesApplied,
    remainingIssues: after.issues.map((i) => i.message),
    passed: after.status === 'passed',
  })

  return { report: after, fixesApplied, unfixedIssues, aiNote }
}

async function summarizeFixes(input: { fixesApplied: string[]; remainingIssues: string[]; passed: boolean }): Promise<string> {
  const fallback =
    input.fixesApplied.length === 0
      ? input.passed
        ? 'No fixable issues were found; the site already passes validation.'
        : 'No automatic fixes were available for the remaining issues — manual review needed.'
      : `Applied ${input.fixesApplied.length} fix${input.fixesApplied.length === 1 ? '' : 'es'}: ${input.fixesApplied.join(' ')}${
          input.passed ? ' The site now passes all validation checks.' : ' Some issues still need manual attention.'
        }`

  if (!process.env.GEMINI_API_KEY) return fallback

  try {
    const prompt = `You are a QA assistant summarizing an automated website-fix run for a non-technical admin reviewing a contractor's marketing site before approving it live.

Fixes just applied:
${input.fixesApplied.length > 0 ? input.fixesApplied.map((f) => `- ${f}`).join('\n') : '(none)'}

Remaining issues after re-validation:
${input.remainingIssues.length > 0 ? input.remainingIssues.map((i) => `- ${i}`).join('\n') : '(none — all checks pass)'}

Write a short (2-4 sentence) plain-English summary for the admin: what was fixed, and what (if anything) still needs their attention. No markdown, no headers.`

    const { text } = await generateTextWithFallback({
      prompt,
      jsonMode: false,
      temperature: 0.3,
      maxOutputTokens: 300,
    })
    return text.trim() || fallback
  } catch {
    return fallback
  }
}

/** site_configs columns that hold customer-visible copy the fixer may rewrite. */
const COPY_COLUMNS = [
  'hero_config',
  'about_config',
  'process_config',
  'products_config',
  'before_after_config',
  'seo_config',
] as const

/** Keys whose string values are machine config, never visible copy. */
const NON_COPY_KEY_RE =
  /(image|img|url|href|slug|icon|color|colour|font|id|key|src|path|video|room)$/i

function walkStrings(
  node: unknown,
  visit: (value: string, replace: (next: string) => void) => void,
  keyHint = ''
): void {
  if (typeof node !== 'object' || node === null) return
  if (Array.isArray(node)) {
    node.forEach((item, i) => {
      if (typeof item === 'string') {
        visit(item, (next) => {
          ;(node as unknown[])[i] = next
        })
      } else {
        walkStrings(item, visit, keyHint)
      }
    })
    return
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (NON_COPY_KEY_RE.test(key)) continue
    if (typeof value === 'string') {
      visit(value, (next) => {
        ;(node as Record<string, unknown>)[key] = next
      })
    } else {
      walkStrings(value, visit, key)
    }
  }
}

/**
 * Rewrites config copy strings that contain banned AI-tell phrases via
 * `generateWithQualityRetry` (same retry wrapper as other gated surfaces).
 * Mutates `updates` in place with the repaired config columns.
 */
async function repairCopyTells(
  tenantId: string,
  samples: string[],
  updates: Record<string, unknown>
): Promise<{ fixed: string[]; unfixed: string[] }> {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('site_configs')
    .select(COPY_COLUMNS.join(', '))
    .eq('tenant_id', tenantId)
    .maybeSingle()
  const row = data as unknown as Record<string, unknown> | null
  if (!row) return { fixed: [], unfixed: samples }

  const lowerSamples = samples.map((s) => s.toLowerCase())
  type Offender = { text: string; replace: (next: string) => void }
  const offenders: Offender[] = []
  const configs: Record<string, unknown> = {}
  for (const column of COPY_COLUMNS) {
    const value = (row as Record<string, unknown>)[column]
    if (!value || typeof value !== 'object') continue
    // Deep clone so we can mutate freely and only persist columns that changed.
    const clone = JSON.parse(JSON.stringify(value))
    configs[column] = clone
    walkStrings(clone, (text, replace) => {
      const lower = text.toLowerCase()
      if (lowerSamples.some((s) => lower.includes(s))) {
        offenders.push({ text, replace })
      }
    })
  }
  if (offenders.length === 0) return { fixed: [], unfixed: samples }

  const unitIds = offenders.map((_, i) => `copy_${i}`)
  const initial = Object.fromEntries(
    offenders.map((o, i) => [unitIds[i], o.text])
  ) as Record<string, string>

  const validate = (output: Record<string, string>) => {
    const findings = unitIds.flatMap((id) => {
      const text = output[id] || ''
      const hits = findAiTellPhrases(text)
      if (hits.length === 0) return []
      return [
        {
          unitId: id,
          code: 'copy_ai_tell_phrase',
          message: `Still contains AI-tell phrasing: ${hits.join(', ')}`,
          samples: hits,
        },
      ]
    })
    return {
      status: findings.length === 0 ? ('passed' as const) : ('failed' as const),
      findings,
      failedUnitIds: findings.map((f) => f.unitId),
    }
  }

  const rewriteBatch = async (texts: string[], findingsNote: string) => {
    const prompt = `You are rewriting short pieces of website copy for a local service business so they stop using banned generic marketing phrases.

Banned phrases found: ${samples.join('; ')}
${findingsNote}

${HUMAN_COPY_VOICE_RULES}

Rewrite each string below. Keep the same meaning, roughly the same length, and any concrete facts (numbers, materials, place names) exactly as they are. Remove or replace the banned phrasing with plain, specific language. Never invent statistics, awards, or testimonials.

Input strings (JSON array):
${JSON.stringify(texts)}

Output ONLY a JSON array of the same length with the rewritten strings, in the same order.`
    const { text } = await generateTextWithFallback({
      prompt,
      jsonMode: true,
      temperature: 0.4,
      maxOutputTokens: 1500,
    })
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? parsed : []
  }

  let result
  try {
    result = await generateWithQualityRetry({
      initial,
      validate,
      maxRetries: 2,
      regenerate: async ({ failedUnitIds, findings, current }) => {
        const failedSet = new Set(failedUnitIds)
        const failedTexts = unitIds
          .filter((id) => failedSet.has(id))
          .map((id) => current[id])
        const note =
          findings.length > 0
            ? `\nPrevious attempt still failed: ${findings.map((f) => f.message).join('; ')}`
            : ''
        const rewrites = await rewriteBatch(failedTexts, note)
        const out: Record<string, string> = {}
        let ri = 0
        for (const id of unitIds) {
          if (!failedSet.has(id)) continue
          const next = typeof rewrites[ri] === 'string' ? rewrites[ri].trim() : ''
          ri += 1
          if (next) out[id] = next
        }
        return out
      },
    })
  } catch {
    return { fixed: [], unfixed: offenders.map((o) => o.text) }
  }

  const fixed: string[] = []
  const unfixed: string[] = []
  offenders.forEach((offender, i) => {
    const id = unitIds[i]
    const rewrite = (result.output[id] || '').trim()
    if (
      rewrite &&
      rewrite !== offender.text &&
      findAiTellPhrases(rewrite).length === 0
    ) {
      offender.replace(rewrite)
      fixed.push(offender.text)
    } else {
      unfixed.push(offender.text)
    }
  })

  if (fixed.length > 0) {
    for (const column of Object.keys(configs)) {
      const original = (row as Record<string, unknown>)[column]
      if (JSON.stringify(original) !== JSON.stringify(configs[column])) {
        updates[column] = configs[column]
      }
    }
  }
  return { fixed, unfixed }
}

async function fixProcessStepsWithAi(
  tenantId: string,
  brandName: string,
  currentProcess: any
): Promise<any> {
  const supabase = getSupabaseAdmin()
  const { data: intake } = await supabase
    .from('prospect_intakes')
    .select('industry, services')
    .eq('provisioned_contractor_id', tenantId)
    .maybeSingle()

  const industry = intake?.industry || 'home services'
  const services = Array.isArray(intake?.services) ? intake.services.join(', ') : ''

  if (!process.env.GEMINI_API_KEY) {
    const primary = (services || '').split(',')[0]?.trim() || 'the work'
    const fallback = buildDefaultProcess('quote', primary, brandName || tenantId)
    return {
      ...fallback,
      ...currentProcess,
      title: currentProcess?.title || fallback.title,
      subtitle: currentProcess?.subtitle || fallback.subtitle,
      steps: fallback.steps,
    }
  }

  try {
    const prompt = `You are a premium visual director and copywriter.
We have a local service business with the brand name "${brandName}", operating in the industry/services: "${industry} / ${services}".
The process section on their homepage must have exactly 3 steps.
Currently, the process config is invalid or incomplete:
${JSON.stringify(currentProcess || {})}

Please output a corrected, premium 3-step process configuration as a valid JSON object matching this schema:
{
  "title": "string",
  "subtitle": "string",
  "steps": [
    { "number": "01", "title": "string", "description": "string" },
    { "number": "02", "title": "string", "description": "string" },
    { "number": "03", "title": "string", "description": "string" }
  ]
}

Ensure the steps are exactly numbered '01', '02', '03' in that order. Keep the copy premium, specific to their trade (e.g. beauty/grooming vs HVAC vs construction), and consistent with any existing valid steps.
Only output JSON.`

    const { text } = await generateTextWithFallback({
      prompt,
      jsonMode: true,
      temperature: 0.3,
      maxOutputTokens: 500,
    })
    const parsed = JSON.parse(text)
    if (parsed && Array.isArray(parsed.steps) && parsed.steps.length === 3) {
      return parsed
    }
  } catch (err) {
    console.error('Error in fixProcessStepsWithAi:', err)
  }

  const steps = currentProcess?.steps || []
  const primary = (services || '').split(',')[0]?.trim() || 'the work'
  const fallback = buildDefaultProcess('quote', primary, brandName || tenantId)
  if (steps.length >= 3) {
    return {
      title: currentProcess?.title || fallback.title,
      subtitle: currentProcess?.subtitle || fallback.subtitle,
      steps: steps.slice(0, 3).map((s: { number?: string; title?: string; description?: string }, i: number) => ({
        number: `0${i + 1}`,
        title: s.title || fallback.steps[i].title,
        description: s.description || fallback.steps[i].description,
      })),
    }
  }
  return {
    title: currentProcess?.title || fallback.title,
    subtitle: currentProcess?.subtitle || fallback.subtitle,
    steps: fallback.steps,
  }
}
