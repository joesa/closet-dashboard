import type { RoomType } from '@/lib/rooms'
import type { LayoutSlug, ThemeSlug } from '@/lib/catalog/sitePresentationCatalog'

export type IndustrySlug =
  | 'custom-closets'
  | 'plumbing'
  | 'hvac'
  | 'landscaping'
  | 'towing'
  | 'roofing'
  | 'electrical'
  | 'pest-control'
  | 'pressure-washing'
  | 'tree-service'
  | 'painting'

export type ServiceDef = {
  label: string
  group: string
  industry: IndustrySlug
  /** Extra terms for fuzzy matching free-text service labels. */
  keywords: string[]
  /** Primary widget / calculator category label for this service. */
  widgetCategory: string
  /** Closet vertical only — maps to legacy RoomType when present. */
  widgetRoom?: RoomType
  recommendedThemes: ThemeSlug[]
  recommendedLayouts: LayoutSlug[]
  catalog: { image: string; description: string }
}

export type IndustryDef = {
  slug: IndustrySlug
  label: string
  /** Match free-text industry / trade fields (e.g. "plumber", "HVAC"). */
  keywords: string[]
  serviceGroups: string[]
  defaultThemes: ThemeSlug[]
  defaultLayouts: LayoutSlug[]
  services: ServiceDef[]
}
