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

  const site =
    data.siteConfig && typeof data.siteConfig === 'object'
      ? ({ ...(data.siteConfig as Record<string, unknown>) } as Record<string, unknown>)
      : {}

  const theme = coerceThemeSlug(
    typeof site.theme === 'string' ? site.theme : presentation.theme
  )
  const layoutStyle = coerceLayoutSlug(
    typeof site.layoutStyle === 'string' ? site.layoutStyle : presentation.layoutStyle
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
