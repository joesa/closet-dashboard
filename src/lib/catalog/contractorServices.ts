/**
 * Closet-focused service catalog — re-exports from the multi-industry catalog.
 * Prefer `@/lib/catalog/serviceCatalog` for new code.
 */
import type { RoomType } from '@/lib/rooms'
import {
  CUSTOM_CLOSETS_GROUPS,
  CUSTOM_CLOSETS_SERVICES,
} from '@/lib/catalog/industries/custom-closets'
import {
  collectThemeLayoutPools as collectPools,
  getServiceDef,
  getServiceCatalogEntry,
  servicesByGroup as servicesByGroupForIndustry,
} from '@/lib/catalog/serviceCatalog'
import type { LayoutSlug, ThemeSlug } from '@/lib/catalog/sitePresentationCatalog'

export type ServiceGroup = (typeof CUSTOM_CLOSETS_GROUPS)[number]

export type ContractorServiceDef = {
  label: string
  group: ServiceGroup
  widgetRoom: RoomType
  recommendedThemes: ThemeSlug[]
  recommendedLayouts: LayoutSlug[]
  catalog: { image: string; description: string }
}

export const OTHER_SERVICE_LABEL = 'Other (describe below)'

function toLegacyDef(
  s: (typeof CUSTOM_CLOSETS_SERVICES)[number]
): ContractorServiceDef {
  return {
    label: s.label,
    group: s.group as ServiceGroup,
    widgetRoom: (s.widgetRoom ?? 'Walk-In Closet') as RoomType,
    recommendedThemes: s.recommendedThemes,
    recommendedLayouts: s.recommendedLayouts,
    catalog: s.catalog,
  }
}

export const CONTRACTOR_SERVICES: ContractorServiceDef[] =
  CUSTOM_CLOSETS_SERVICES.map(toLegacyDef)

export const SERVICE_LABELS = CONTRACTOR_SERVICES.map((s) => s.label)

export const SERVICE_GROUPS_ORDER: ServiceGroup[] = [...CUSTOM_CLOSETS_GROUPS]

export { getServiceDef, getServiceCatalogEntry }

export function servicesByGroup(): Map<ServiceGroup, ContractorServiceDef[]> {
  const raw = servicesByGroupForIndustry('custom-closets')
  const map = new Map<ServiceGroup, ContractorServiceDef[]>()
  for (const g of SERVICE_GROUPS_ORDER) {
    map.set(g, (raw.get(g) ?? []).map(toLegacyDef))
  }
  return map
}

export function widgetRoomForService(label: string): RoomType {
  return getServiceDef(label)?.widgetRoom ?? 'Walk-In Closet'
}

export function collectThemeLayoutPools(
  serviceLabels: string[],
  otherServices?: string | null,
  industry?: string | null
): { themes: ThemeSlug[]; layouts: LayoutSlug[] } {
  const { themes, layouts } = collectPools({
    services: serviceLabels,
    other_services: otherServices,
    industry,
  })
  return { themes, layouts }
}
