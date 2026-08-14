export type ContentChange =
  | { op: 'set'; path: string; value: unknown }
  | { op: 'insert'; path: string; index: number; value: unknown }
  | { op: 'remove'; path: string }
  | { op: 'move'; path: string; from: number; to: number }

export type SiteContentDocument = {
  brand_name: string
  hero_config: Record<string, unknown>
  about_config: Record<string, unknown>
  process_config: Record<string, unknown>
  products_config: unknown[]
  seo_config: Record<string, unknown>
  before_after_config?: Record<string, unknown> | null
  quiz_config?: Record<string, unknown> | null
  nav_links: unknown[]
  pages_config: unknown[]
  logo_url?: string | null
  pricing_notes?: string | null
  custom_config?: unknown
  content_structure: Record<string, unknown>
}

export type SiteContentRevisionSummary = {
  id: string
  version: number
  changedPaths: string[]
  createdAt: string
  /** Session-start snapshot, exempt from ordinary revision eviction. */
  pinned?: boolean
  pinReason?: string | null
}

