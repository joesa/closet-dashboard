import { generateTextWithFallback } from '@/lib/ai/aiTextProvider'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { validateTenantSite, saveValidationReport, type ValidationReport } from '@/lib/validation/siteValidator'
import { THEME_LAYOUT_AFFINITY, type ThemeSlug, type LayoutSlug } from '@/lib/catalog/sitePresentationCatalog'
import { resolveDesignSeed } from '@/lib/provision/resolveDesignSeed'
import { themeHeroUrl } from '@/lib/provision/buildTemplateSiteConfig'

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
export async function autoFixTenantSite(tenantId: string): Promise<AutoFixResult> {
  const supabase = getSupabaseAdmin()
  const before = await validateTenantSite(tenantId)

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

  for (const issue of before.issues) {
    if (!issue.fixable) {
      if (issue.severity === 'error') unfixedIssues.push(issue.message)
      continue
    }

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

  if (Object.keys(updates).length > 0) {
    await supabase.from('site_configs').update(updates).eq('tenant_id', tenantId)
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
    const steps = currentProcess?.steps || []
    const padded = [...steps]
    while (padded.length < 3) {
      padded.unshift({ number: '01', title: 'Consultation', description: 'Schedule a consultation.' })
    }
    const fixed = padded.slice(0, 3).map((s, i) => ({
      ...s,
      number: `0${i + 1}`,
      title: s.title || (i === 0 ? 'Consultation' : i === 1 ? 'Design' : 'Install'),
      description: s.description || (i === 0 ? 'We meet with you.' : i === 1 ? 'We design it.' : 'We build it.'),
    }))
    return {
      ...currentProcess,
      steps: fixed,
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
  const padded = [...steps]
  while (padded.length < 3) {
    padded.unshift({ number: '01', title: 'Consultation', description: 'Schedule a consultation.' })
  }
  return {
    title: currentProcess?.title || 'Our Process',
    subtitle: currentProcess?.subtitle || 'How we work',
    steps: padded.slice(0, 3).map((s, i) => ({
      ...s,
      number: `0${i + 1}`,
      title: s.title || (i === 0 ? 'Consultation' : i === 1 ? 'Design' : 'Install'),
      description: s.description || (i === 0 ? 'We meet with you.' : i === 1 ? 'We design it.' : 'We build it.'),
    }))
  }
}
