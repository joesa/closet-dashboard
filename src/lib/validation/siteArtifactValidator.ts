import { createHash } from 'node:crypto'
import { validateCustomConfig, type CustomSiteConfig } from '@/lib/customSite'
import { analyzeSpecificity, analyzeToneBalance } from '@/lib/validation/specificityGate'

export type ArtifactValidationIssue = {
  code: string
  severity: 'error' | 'warning'
  message: string
  fixable: boolean
  meta?: Record<string, unknown>
}

export type ArtifactValidationReport = {
  status: 'passed' | 'failed'
  issues: ArtifactValidationIssue[]
  checkedAt: string
  artifactHash: string
}

export type EngineDraftPage = {
  slug: string
  title: string
  is_active?: boolean
  hero?: { headline?: string; subheadline?: string }
  content_blocks?: Array<{
    heading?: string
    body?: string
    items?: Array<{ title?: string; description?: string }>
  }>
}

export type EngineSiteDraft = {
  pagesConfig: EngineDraftPage[]
  navLinks: Array<{ label: string; slug: string }>
}

export function hashSiteArtifact(artifact: unknown): string {
  return createHash('sha256').update(JSON.stringify(artifact)).digest('hex')
}

export function validateEngineSiteDraft(
  draft: EngineSiteDraft,
  options: { businessName?: string | null } = {}
): ArtifactValidationReport {
  const issues: ArtifactValidationIssue[] = []
  const slugs = draft.pagesConfig.map((page) => page.slug?.trim()).filter(Boolean)
  const duplicateSlugs = slugs.filter((slug, index) => slugs.indexOf(slug) !== index)
  if (duplicateSlugs.length > 0) {
    issues.push({
      code: 'duplicate_page_slug',
      severity: 'error',
      message: `Duplicate page slug: ${Array.from(new Set(duplicateSlugs)).join(', ')}`,
      fixable: false,
    })
  }

  const activeSlugs = new Set(
    draft.pagesConfig
      .filter((page) => page.is_active !== false)
      .map((page) => page.slug)
  )
  activeSlugs.add('/')
  for (const link of draft.navLinks) {
    if (!link.label?.trim() || !link.slug?.trim()) {
      issues.push({
        code: 'invalid_nav_link',
        severity: 'error',
        message: 'Navigation links require both a label and a slug.',
        fixable: false,
      })
    } else if (!activeSlugs.has(link.slug)) {
      issues.push({
        code: 'nav_link_missing_page',
        severity: 'error',
        message: `Navigation link "${link.label}" points to inactive or missing page "${link.slug}".`,
        fixable: false,
        meta: { slug: link.slug },
      })
    }
  }

  const pageTexts: string[] = []
  for (const page of draft.pagesConfig.filter((candidate) => candidate.is_active !== false)) {
    const text = [
      page.title,
      page.hero?.headline,
      page.hero?.subheadline,
      ...(page.content_blocks || []).flatMap((block) => [
        block.heading,
        block.body,
        ...(block.items || []).flatMap((item) => [item.title, item.description]),
      ]),
    ]
      .filter(Boolean)
      .join(' ')
    pageTexts.push(text)
    for (const finding of analyzeSpecificity({ text, businessName: options.businessName })) {
      issues.push({
        code: finding.code,
        severity: 'error',
        message: `${page.slug}: ${finding.message}`,
        fixable: false,
        meta: {
          path: page.slug,
          ...(finding.samples.length > 0 ? { samples: finding.samples } : {}),
        },
      })
    }
  }
  for (const finding of analyzeToneBalance(pageTexts)) {
    issues.push({
      code: finding.code,
      severity: 'error',
      message: finding.message,
      fixable: false,
    })
  }

  return {
    status: issues.some((issue) => issue.severity === 'error') ? 'failed' : 'passed',
    issues,
    checkedAt: new Date().toISOString(),
    artifactHash: hashSiteArtifact(draft),
  }
}

export function validateCustomSiteArtifact(
  artifact: CustomSiteConfig,
  options: { businessName?: string | null } = {}
): ArtifactValidationReport {
  const issues: ArtifactValidationIssue[] = []
  const shape = validateCustomConfig(artifact)
  for (const message of shape.errors) {
    issues.push({ code: 'custom_widget_invalid', severity: 'error', message, fixable: true })
  }
  for (const message of shape.warnings) {
    issues.push({ code: 'custom_artifact_warning', severity: 'warning', message, fixable: false })
  }

  const pageTexts: string[] = []
  for (const [path, page] of Object.entries(artifact.pages)) {
    const text = [page.title, page.description, page.html].filter(Boolean).join(' ')
    pageTexts.push(text)
    for (const finding of analyzeSpecificity({
      text,
      businessName: options.businessName,
    })) {
      issues.push({
        code: finding.code,
        severity: 'error',
        message: `${path}: ${finding.message}`,
        fixable: false,
        meta: {
          path,
          ...(finding.samples.length > 0 ? { samples: finding.samples } : {}),
        },
      })
    }
  }
  for (const finding of analyzeToneBalance(pageTexts)) {
    issues.push({
      code: finding.code,
      severity: 'error',
      message: finding.message,
      fixable: false,
    })
  }

  return {
    status: issues.some((issue) => issue.severity === 'error') ? 'failed' : 'passed',
    issues,
    checkedAt: new Date().toISOString(),
    artifactHash: hashSiteArtifact(artifact),
  }
}