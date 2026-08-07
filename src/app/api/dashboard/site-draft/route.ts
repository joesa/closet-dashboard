import { NextResponse } from 'next/server'
import { resolveDomainActor } from '@/lib/domains/auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  type EngineSiteDraft,
} from '@/lib/validation/siteArtifactValidator'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function parseDraft(value: unknown): EngineSiteDraft | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const draft = value as Partial<EngineSiteDraft>
  if (!Array.isArray(draft.pagesConfig) || !Array.isArray(draft.navLinks)) return null
  if (draft.pagesConfig.length > 30 || draft.navLinks.length > 30) return null
  if (
    draft.pagesConfig.some(
      (page) =>
        !page ||
        typeof page !== 'object' ||
        typeof page.slug !== 'string' ||
        !page.slug.startsWith('/') ||
        typeof page.title !== 'string' ||
        (page.is_active !== undefined && typeof page.is_active !== 'boolean') ||
        !page.hero ||
        typeof page.hero !== 'object' ||
        typeof page.hero.headline !== 'string' ||
        !Array.isArray(page.content_blocks)
    )
  ) return null
  if (
    draft.navLinks.some(
      (link) =>
        !link ||
        typeof link !== 'object' ||
        typeof link.label !== 'string' ||
        typeof link.slug !== 'string' ||
        !link.slug.startsWith('/')
    )
  ) return null
  return {
    pagesConfig: draft.pagesConfig,
    navLinks: draft.navLinks,
  }
}

async function resolveTenant() {
  const resolved = await resolveDomainActor()
  if ('error' in resolved) {
    return { response: NextResponse.json({ error: resolved.error }, { status: resolved.status }) }
  }
  return { tenantId: resolved.tenantId }
}

export async function GET() {
  const resolved = await resolveTenant()
  if (resolved.response) return resolved.response

  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('site_configs')
    .select(
      'pages_config, nav_links, engine_config_draft, draft_artifact_kind, draft_validation_status, draft_validation_report, draft_validated_at, draft_artifact_hash'
    )
    .eq('tenant_id', resolved.tenantId)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Site config not found' }, { status: 404 })

  const draft = parseDraft(data.engine_config_draft)
  return NextResponse.json({
    draft,
    published: {
      pagesConfig: Array.isArray(data.pages_config) ? data.pages_config : [],
      navLinks: Array.isArray(data.nav_links) ? data.nav_links : [],
    },
    validation:
      data.draft_artifact_kind === 'engine' && data.draft_validation_status
      ? {
          status: data.draft_validation_status,
          issues: Array.isArray(data.draft_validation_report) ? data.draft_validation_report : [],
          checkedAt: data.draft_validated_at,
          artifactHash: data.draft_artifact_hash,
        }
      : null,
  })
}

export async function POST() {
  return NextResponse.json(
    { error: 'Website page drafts have moved to the live Website Content Studio.' },
    { status: 410 }
  )
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Website publishing has moved to the autosaving Website Content Studio.' },
    { status: 410 }
  )
}
