import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { THEME_SLUGS, LAYOUT_SLUGS, type ThemeSlug, type LayoutSlug } from '@/lib/catalog/sitePresentationCatalog'
import type { BeforeAfterCategory } from '@/lib/openai-images'
import type { EngagementModel } from '@/lib/catalog/types'

export type CustomIndustryService = {
  label: string
  keywords: string[]
  widgetCategory: string
  description?: string
}

export type CustomIndustryRecord = {
  slug: string
  label: string
  keywords: string[]
  services: CustomIndustryService[]
  defaultThemes: ThemeSlug[]
  defaultLayouts: LayoutSlug[]
  beforeAfterCategory: BeforeAfterCategory
  engagementModel: EngagementModel
}

type CustomIndustryRow = {
  slug: string
  label: string
  keywords: string[] | null
  services: unknown
  default_themes: string[] | null
  default_layouts: string[] | null
  before_after_category: string
  engagement_model: string | null
}

function isValidThemeSlug(v: string): v is ThemeSlug {
  return (THEME_SLUGS as readonly string[]).includes(v)
}
function isValidLayoutSlug(v: string): v is LayoutSlug {
  return (LAYOUT_SLUGS as readonly string[]).includes(v)
}

function sanitizeServices(raw: unknown): CustomIndustryService[] {
  if (!Array.isArray(raw)) return []
  const out: CustomIndustryService[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const s = item as Record<string, unknown>
    const label = typeof s.label === 'string' ? s.label.trim() : ''
    if (!label) continue
    out.push({
      label,
      keywords: Array.isArray(s.keywords) ? s.keywords.filter((k): k is string => typeof k === 'string') : [],
      widgetCategory: typeof s.widgetCategory === 'string' && s.widgetCategory.trim() ? s.widgetCategory.trim() : label,
      description: typeof s.description === 'string' ? s.description.trim() : undefined,
    })
  }
  return out
}

const ENGAGEMENT_MODELS: readonly EngagementModel[] = [
  'quote',
  'order',
  'booking',
  'ticket',
]

function parseEngagementModel(v: string | null | undefined): EngagementModel {
  if (v && (ENGAGEMENT_MODELS as readonly string[]).includes(v)) {
    return v as EngagementModel
  }
  return 'quote'
}

function rowToRecord(row: CustomIndustryRow): CustomIndustryRecord {
  const themes = (row.default_themes ?? []).filter(isValidThemeSlug)
  const layouts = (row.default_layouts ?? []).filter(isValidLayoutSlug)
  return {
    slug: row.slug,
    label: row.label,
    keywords: row.keywords ?? [],
    services: sanitizeServices(row.services),
    defaultThemes: themes.length > 0 ? themes : ['luxury-minimal'],
    defaultLayouts: layouts.length > 0 ? layouts : ['standard'],
    beforeAfterCategory: (row.before_after_category as BeforeAfterCategory) || 'not-applicable',
    engagementModel: parseEngagementModel(row.engagement_model),
  }
}

export function slugifyIndustryLabel(label: string): string {
  return (
    label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'custom-industry'
  )
}

/** Case-insensitive lookup by the exact label a contractor typed. */
export async function findCustomIndustryByLabel(label: string): Promise<CustomIndustryRecord | null> {
  const trimmed = label.trim()
  if (!trimmed) return null
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('custom_industries')
    .select('slug, label, keywords, services, default_themes, default_layouts, before_after_category, engagement_model')
    .ilike('label', trimmed)
    .maybeSingle()
  if (error || !data) return null
  return rowToRecord(data as CustomIndustryRow)
}

export async function findCustomIndustryBySlug(slug: string): Promise<CustomIndustryRecord | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('custom_industries')
    .select('slug, label, keywords, services, default_themes, default_layouts, before_after_category, engagement_model')
    .eq('slug', slug)
    .maybeSingle()
  if (error || !data) return null
  return rowToRecord(data as CustomIndustryRow)
}

/** All custom industries, for merging into the intake form's industry dropdown. */
export async function listCustomIndustries(): Promise<Array<{ slug: string; label: string }>> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('custom_industries')
    .select('slug, label')
    .order('label', { ascending: true })
  if (error || !data) return []
  return data as Array<{ slug: string; label: string }>
}

/**
 * Persists a newly AI-generated (or manually curated) custom industry.
 * Slug collisions (two contractors coining similar labels, e.g. "Mobile Dog
 * Grooming" vs "Dog Grooming Mobile") get a numeric suffix rather than
 * failing — the label is what's actually shown/matched against, the slug is
 * just an internal identifier.
 */
export async function createCustomIndustry(
  input: Omit<CustomIndustryRecord, 'slug'> & { slug?: string; sourceIntakeId?: string }
): Promise<CustomIndustryRecord> {
  const supabase = getSupabaseAdmin()
  const baseSlug = input.slug || slugifyIndustryLabel(input.label)

  let slug = baseSlug
  for (let attempt = 0; attempt < 20; attempt++) {
    const { data, error } = await supabase
      .from('custom_industries')
      .insert({
        slug,
        label: input.label,
        keywords: input.keywords,
        services: input.services,
        default_themes: input.defaultThemes,
        default_layouts: input.defaultLayouts,
        before_after_category: input.beforeAfterCategory,
        engagement_model: input.engagementModel,
        source_intake_id: input.sourceIntakeId || null,
      })
      .select('slug, label, keywords, services, default_themes, default_layouts, before_after_category, engagement_model')
      .maybeSingle()

    if (!error && data) return rowToRecord(data as CustomIndustryRow)

    // 23505 = unique_violation (slug collision) — retry with a numeric suffix.
    if ((error as { code?: string } | null)?.code === '23505') {
      slug = `${baseSlug}-${attempt + 2}`
      continue
    }
    throw error
  }
  throw new Error('Could not generate a unique slug for custom industry after 20 attempts')
}
