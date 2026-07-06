import {
  presentationFromIntakeRow,
  resolveSitePresentation,
} from '@/lib/ai/resolveSitePresentation'
import {
  coerceLayoutSlug,
  coerceThemeSlug,
} from '@/lib/catalog/sitePresentationCatalog'
import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'

/** Merge resolved theme/layout into AI generate-site output and persist presentation audit blob. */
export async function mergeAiSiteConfigWithPresentation(
  row: ProspectIntakeRow,
  data: Record<string, unknown>,
  opts?: { useGemini?: boolean }
): Promise<Record<string, unknown>> {
  const presentation = await resolveSitePresentation(
    presentationFromIntakeRow(row),
    opts
  )

  // If the user picked a theme/layout in the review step, it's stored in
  // row.ai_site_config.presentation — take that over the AI output.
  const storedRowPres = (row.ai_site_config as Record<string, unknown> | null)?.presentation as
    | { theme?: string; layoutStyle?: string; source?: string }
    | undefined
  const userTheme = storedRowPres?.source === 'user' ? storedRowPres?.theme : undefined
  const userLayout = storedRowPres?.source === 'user' ? storedRowPres?.layoutStyle : undefined

  const site =
    data.siteConfig && typeof data.siteConfig === 'object'
      ? ({ ...(data.siteConfig as Record<string, unknown>) } as Record<string, unknown>)
      : {}

  const theme = coerceThemeSlug(
    userTheme ?? (typeof site.theme === 'string' ? site.theme : presentation.theme)
  )
  const layoutStyle = coerceLayoutSlug(
    userLayout ?? (typeof site.layoutStyle === 'string' ? site.layoutStyle : presentation.layoutStyle)
  )
  const defaultRoom =
    typeof site.defaultRoom === 'string' && site.defaultRoom.trim()
      ? site.defaultRoom.trim()
      : presentation.defaultRoom

  site.theme = theme
  site.layoutStyle = layoutStyle
  site.defaultRoom = defaultRoom

  return {
    ...data,
    siteConfig: site,
    presentation: {
      theme,
      layoutStyle,
      defaultRoom,
      resolvedAt: new Date().toISOString(),
      rationale: presentation.rationale,
      source: presentation.source,
    },
  }
}
