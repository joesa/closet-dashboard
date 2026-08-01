import { NextResponse } from 'next/server'
import { resolveDomainActor } from '@/lib/domains/auth'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { revalidateTenantSiteCache } from '@/lib/tenants/revalidateTenantSite'
import {
  validateEngineSiteDraft,
  type EngineSiteDraft,
} from '@/lib/validation/siteArtifactValidator'
import {
  saveValidationReport,
  validateTenantSite,
} from '@/lib/validation/siteValidator'

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

export async function POST(req: Request) {
  const resolved = await resolveTenant()
  if (resolved.response) return resolved.response
  const draft = parseDraft(await req.json().catch(() => null))
  if (!draft) return NextResponse.json({ error: 'Invalid engine draft' }, { status: 400 })

  const admin = getSupabaseAdmin()
  const { data: tenant } = await admin
    .from('tenants')
    .select('business_name')
    .eq('id', resolved.tenantId)
    .maybeSingle()
  const report = validateEngineSiteDraft(draft, { businessName: tenant?.business_name })
  const { error } = await admin
    .from('site_configs')
    .update({
      engine_config_draft: draft,
      draft_artifact_kind: 'engine',
      draft_validation_status: report.status,
      draft_validation_report: report.issues,
      draft_validated_at: report.checkedAt,
      draft_artifact_hash: report.artifactHash,
    })
    .eq('tenant_id', resolved.tenantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, draft, validation: report })
}

export async function PUT() {
  const resolved = await resolveTenant()
  if (resolved.response) return resolved.response
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('site_configs')
    .select('engine_config_draft, draft_artifact_kind, draft_validation_status, draft_artifact_hash')
    .eq('tenant_id', resolved.tenantId)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Site config not found' }, { status: 404 })

  const draft = parseDraft(data.engine_config_draft)
  if (!draft) return NextResponse.json({ error: 'No engine draft to publish' }, { status: 400 })
  const { data: tenant } = await admin
    .from('tenants')
    .select('business_name')
    .eq('id', resolved.tenantId)
    .maybeSingle()
  const report = validateEngineSiteDraft(draft, { businessName: tenant?.business_name })
  if (
    report.status !== 'passed' ||
    data.draft_artifact_kind !== 'engine' ||
    data.draft_validation_status !== 'passed' ||
    data.draft_artifact_hash !== report.artifactHash
  ) {
    return NextResponse.json(
      { error: 'Draft changed or failed validation. Save and validate it again.', validation: report },
      { status: 409 }
    )
  }

  const { data: updated, error: updateError } = await admin
    .from('site_configs')
    .update({
      pages_config: draft.pagesConfig,
      nav_links: draft.navLinks,
      engine_config_draft: null,
      draft_artifact_kind: null,
      draft_validation_status: null,
      draft_validation_report: null,
      draft_validated_at: null,
      draft_artifact_hash: null,
    })
    .eq('tenant_id', resolved.tenantId)
    .eq('draft_artifact_hash', report.artifactHash)
    .select('tenant_id')
    .maybeSingle()
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
  if (!updated) {
    return NextResponse.json(
      { error: 'Draft changed while publishing. Save and validate it again.' },
      { status: 409 }
    )
  }

  await revalidateTenantSiteCache(resolved.tenantId)
  const publishedReport = await validateTenantSite(resolved.tenantId)
  await saveValidationReport(resolved.tenantId, publishedReport)
  return NextResponse.json({ ok: true, validation: publishedReport })
}