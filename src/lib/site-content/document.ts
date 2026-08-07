import {
  htmlHasInjectableWidget,
  isCustomSiteConfig,
  stripLiveWidgetsToPlaceholder,
} from '@/lib/customSite'
import type { ContentChange, SiteContentDocument } from './types'
import { assertSafeContentValue, hardenCustomConfig } from './security'

export const SITE_CONTENT_COLUMNS = [
  'brand_name',
  'hero_config',
  'about_config',
  'process_config',
  'products_config',
  'seo_config',
  'before_after_config',
  'quiz_config',
  'nav_links',
  'pages_config',
  'logo_url',
  'pricing_notes',
  'custom_config',
  'content_structure',
] as const

const ALLOWED_ROOTS = new Set<string>(SITE_CONTENT_COLUMNS)
const PROTECTED_ENGINE_SECTIONS = new Set(['hero', 'engagement'])
const IMAGE_SIZES = new Set(['small', 'medium', 'large', 'full'])
const IMAGE_ASPECTS = new Set(['square', 'landscape', 'wide', 'portrait'])
const IMAGE_FITS = new Set(['cover', 'contain'])
const IMAGE_POSITIONS = new Set(['center', 'top', 'bottom', 'left', 'right'])
const IMAGE_SCALES = new Set(['90', '100', '110', '125'])
const HOME_SECTION_IDS = new Set([
  'hero', 'about', 'products', 'process', 'beforeAfter', 'socialProof', 'quiz', 'engagement',
])
const CUSTOM_PAGE_FIELDS = new Set(['html', 'title', 'description'])

type JsonObject = Record<string, unknown>

function assertHeroPresentation(hero: unknown) {
  if (!hero || typeof hero !== 'object') return
  const value = hero as Record<string, unknown>
  if (value.imageFit !== undefined && !IMAGE_FITS.has(String(value.imageFit))) throw new Error('Invalid hero image fit')
  if (value.imagePosition !== undefined && !IMAGE_POSITIONS.has(String(value.imagePosition))) throw new Error('Invalid hero image position')
  if (value.imageScale !== undefined && !IMAGE_SCALES.has(String(value.imageScale))) throw new Error('Invalid hero image zoom')
}

function assertImagePresentations(structure: Record<string, unknown>) {
  const presentations = structure.imagePresentation
  if (presentations === undefined) return
  if (!presentations || typeof presentations !== 'object' || Array.isArray(presentations)) {
    throw new Error('Invalid image presentation map')
  }
  const entries = Object.entries(presentations)
  if (entries.length > 300) throw new Error('Too many resized images')
  for (const [path, raw] of entries) {
    if (!path.startsWith('/') || path.length > 500 || !/(?:image|logo)/i.test(path)) {
      throw new Error('Invalid resized image path')
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid image dimensions')
    const value = raw as Record<string, unknown>
    const width = Number(value.widthPercent)
    const ratio = Number(value.aspectRatio)
    if (!Number.isFinite(width) || width < 5 || width > 100) throw new Error('Invalid image width')
    if (!Number.isFinite(ratio) || ratio < 0.2 || ratio > 5) throw new Error('Invalid image aspect ratio')
  }
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function decodePointer(path: string): string[] {
  if (!path.startsWith('/')) throw new Error('Content paths must be JSON pointers')
  const parts = path
    .slice(1)
    .split('/')
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'))
  if (!parts[0] || !ALLOWED_ROOTS.has(parts[0])) throw new Error('Content path is not editable')
  if (parts.some((part) => part === '__proto__' || part === 'prototype' || part === 'constructor')) {
    throw new Error('Unsafe content path')
  }
  return parts
}

function parentAt(document: JsonObject, parts: string[]): { parent: JsonObject | unknown[]; key: string } {
  let current: unknown = document
  for (const part of parts.slice(0, -1)) {
    if (!current || typeof current !== 'object') throw new Error('Content path does not exist')
    const next = Array.isArray(current) ? current[Number(part)] : (current as JsonObject)[part]
    if (next === undefined) throw new Error('Content path does not exist')
    current = next
  }
  if (!current || typeof current !== 'object') throw new Error('Content path is not a container')
  return { parent: current as JsonObject | unknown[], key: parts.at(-1)! }
}

function collectionAt(document: JsonObject, parts: string[]): unknown[] {
  let current: unknown = document
  for (const part of parts) {
    if (!current || typeof current !== 'object') throw new Error('Collection path does not exist')
    current = Array.isArray(current) ? current[Number(part)] : (current as JsonObject)[part]
  }
  if (!Array.isArray(current)) throw new Error('Content path is not a collection')
  return current
}

function assertChangeAllowed(change: ContentChange, renderMode: 'engine' | 'custom') {
  const parts = decodePointer(change.path)
  const root = parts[0]
  if (renderMode === 'custom' && root !== 'custom_config' && !['brand_name', 'seo_config', 'logo_url'].includes(root)) {
    throw new Error('This field is not used by custom sites')
  }
  if (renderMode === 'engine' && root === 'custom_config') {
    throw new Error('Custom HTML is not editable on an engine site')
  }
  if (renderMode === 'custom') {
    if ((root === 'brand_name' || root === 'logo_url') && parts.length !== 1) {
      throw new Error('This custom-site field is not editable')
    }
    if (root === 'custom_config') {
      const pagePath = parts[1] === 'pages'
      const pagesCollection = pagePath && parts.length === 2 && change.op === 'set'
      const pageEntry = pagePath && parts.length === 3 && (change.op === 'set' || change.op === 'remove')
      const pageField = pagePath && parts.length === 4 && change.op === 'set' && CUSTOM_PAGE_FIELDS.has(parts[3])
      if (!pagesCollection && !pageEntry && !pageField) {
        throw new Error('Custom-site design, CSS, mode, and platform controls are not editable in Content Studio')
      }
    }
  }
  if (change.op === 'remove' && parts.length === 1) {
    throw new Error('Top-level content fields cannot be removed')
  }
}

function preserveCustomSiteDesign(source: SiteContentDocument, document: SiteContentDocument) {
  if (!isCustomSiteConfig(source.custom_config) || !isCustomSiteConfig(document.custom_config)) return
  const sourceConfig = source.custom_config
  const nextConfig = document.custom_config
  document.custom_config = {
    mode: sourceConfig.mode,
    globalCss: sourceConfig.globalCss,
    pages: Object.fromEntries(Object.entries(nextConfig.pages).map(([path, page]) => {
      const originalCss = sourceConfig.pages[path]?.css
      const content = { html: page?.html || '', title: page?.title, description: page?.description }
      return [path, originalCss === undefined ? content : { ...content, css: originalCss }]
    })),
  }
}

function syncPageNavigation(
  document: SiteContentDocument,
  parts: string[],
  change: ContentChange
) {
  if (parts[0] !== 'pages_config' || parts.length < 2) return
  const pageIndex = Number(parts[1])
  if (!Number.isInteger(pageIndex) || pageIndex < 0) return
  const pages = document.pages_config as Array<Record<string, unknown>>
  const page = pages[pageIndex]
  if (!page) return
  const links = document.nav_links as Array<Record<string, unknown>>
  const oldSlug = typeof page.slug === 'string' ? page.slug : ''

  if (change.op === 'remove' && parts.length === 2) {
    document.nav_links = links.filter((link) => link.slug !== oldSlug)
    return
  }
  if (change.op !== 'set' || parts.length !== 3) return
  const field = parts[2]
  if (field === 'title' && typeof change.value === 'string') {
    for (const link of links) {
      if (link.slug === oldSlug) link.label = change.value
    }
  } else if (field === 'slug' && typeof change.value === 'string') {
    for (const link of links) {
      if (link.slug === oldSlug) link.slug = change.value
    }
  } else if (field === 'is_active' && change.value === false) {
    document.nav_links = links.filter((link) => link.slug !== oldSlug)
  }
}

export function applyContentChanges(
  source: SiteContentDocument,
  changes: ContentChange[],
  renderMode: 'engine' | 'custom'
): SiteContentDocument {
  if (!Array.isArray(changes) || changes.length === 0 || changes.length > 100) {
    throw new Error('Between 1 and 100 content changes are required')
  }
  const document = clone(source) as SiteContentDocument & JsonObject
  for (const change of changes) {
    assertChangeAllowed(change, renderMode)
    const parts = decodePointer(change.path)
    if (renderMode === 'engine') syncPageNavigation(document, parts, change)
    if (change.op === 'set') {
      const { parent, key } = parentAt(document, parts)
      if (Array.isArray(parent)) {
        const index = Number(key)
        if (!Number.isInteger(index) || index < 0 || index >= parent.length) throw new Error('Invalid array index')
        parent[index] = clone(change.value)
      } else {
        parent[key] = clone(change.value)
      }
    } else if (change.op === 'remove') {
      const { parent, key } = parentAt(document, parts)
      if (Array.isArray(parent)) {
        const index = Number(key)
        if (!Number.isInteger(index) || index < 0 || index >= parent.length) throw new Error('Invalid array index')
        parent.splice(index, 1)
      } else {
        delete parent[key]
      }
    } else {
      const collection = collectionAt(document, parts)
      if (change.op === 'insert') {
        if (!Number.isInteger(change.index) || change.index < 0 || change.index > collection.length) {
          throw new Error('Invalid insertion index')
        }
        collection.splice(change.index, 0, clone(change.value))
      } else {
        if (
          !Number.isInteger(change.from) || !Number.isInteger(change.to) ||
          change.from < 0 || change.from >= collection.length ||
          change.to < 0 || change.to >= collection.length
        ) throw new Error('Invalid move indexes')
        const [item] = collection.splice(change.from, 1)
        collection.splice(change.to, 0, item)
      }
    }
  }
  if (renderMode === 'custom') preserveCustomSiteDesign(source, document)
  return normalizeAndValidateDocument(document, renderMode)
}

export function normalizeAndValidateDocument(
  input: SiteContentDocument,
  renderMode: 'engine' | 'custom'
): SiteContentDocument {
  assertSafeContentValue(input)
  const document = clone(input)
  document.brand_name = String(document.brand_name || '').trim().slice(0, 255)
  if (!document.brand_name) throw new Error('Brand name is required')
  document.products_config = Array.isArray(document.products_config) ? document.products_config.slice(0, 100) : []
  document.pages_config = Array.isArray(document.pages_config) ? document.pages_config.slice(0, 30) : []
  document.nav_links = Array.isArray(document.nav_links) ? document.nav_links.slice(0, 30) : []

  if (renderMode === 'engine') {
    assertHeroPresentation(document.hero_config)
    const pages = document.pages_config as Array<{ slug?: unknown; title?: unknown; is_active?: unknown }>
    const activeSlugs = new Set(['/'])
    for (const page of pages) {
      if (!page || typeof page !== 'object') throw new Error('Every page must be an object')
      if (typeof page.slug !== 'string' || !page.slug.startsWith('/') || page.slug === '/') {
        throw new Error('Non-home pages require a unique slash-prefixed slug')
      }
      if (activeSlugs.has(page.slug)) throw new Error(`Duplicate page slug: ${page.slug}`)
      if (page.is_active !== false) activeSlugs.add(page.slug)
      if (typeof page.title !== 'string' || !page.title.trim()) throw new Error('Every page requires a title')
      assertHeroPresentation((page as Record<string, unknown>).hero)
      const blocks = Array.isArray((page as Record<string, unknown>).content_blocks)
        ? (page as Record<string, unknown>).content_blocks as Array<Record<string, unknown>>
        : []
      for (const block of blocks) {
        if (!block || typeof block !== 'object') throw new Error('Every page block must be an object')
        if (block.imageSize !== undefined && !IMAGE_SIZES.has(String(block.imageSize))) throw new Error('Invalid image size')
        if (block.imageAspect !== undefined && !IMAGE_ASPECTS.has(String(block.imageAspect))) throw new Error('Invalid image shape')
        if (block.imageFit !== undefined && !IMAGE_FITS.has(String(block.imageFit))) throw new Error('Invalid image fit')
        const items = Array.isArray(block.items) ? block.items as Array<Record<string, unknown>> : []
        for (const item of items) {
          if (item.imageSize !== undefined && !IMAGE_SIZES.has(String(item.imageSize))) throw new Error('Invalid image size')
          if (item.imageAspect !== undefined && !IMAGE_ASPECTS.has(String(item.imageAspect))) throw new Error('Invalid image shape')
          if (item.imageFit !== undefined && !IMAGE_FITS.has(String(item.imageFit))) throw new Error('Invalid image fit')
        }
      }
    }
    for (const link of document.nav_links as Array<{ label?: unknown; slug?: unknown }>) {
      if (!link || typeof link.label !== 'string' || !link.label.trim() || typeof link.slug !== 'string') {
        throw new Error('Navigation links require a label and slug')
      }
      if (!activeSlugs.has(link.slug) && !link.slug.startsWith('/#') && !link.slug.startsWith('#')) {
        throw new Error(`Navigation target does not exist: ${link.slug}`)
      }
    }
    const structure = document.content_structure || {}
    assertImagePresentations(structure)
    const order = Array.isArray(structure.homeSections)
      ? [...new Set(structure.homeSections.map(String).filter((section) => HOME_SECTION_IDS.has(section)))]
      : []
    for (const required of PROTECTED_ENGINE_SECTIONS) {
      if (!order.includes(required)) throw new Error(`The ${required} section cannot be removed`)
    }
    const hidden = Array.isArray(structure.hiddenHomeSections)
      ? [...new Set(structure.hiddenHomeSections.map(String).filter((section) => HOME_SECTION_IDS.has(section)))]
      : []
    if (hidden.some((section) => PROTECTED_ENGINE_SECTIONS.has(section))) {
      throw new Error('The hero and engagement sections cannot be hidden')
    }
    document.content_structure = {
      homeSections: order,
      hiddenHomeSections: hidden,
      ...(structure.imagePresentation === undefined ? {} : { imagePresentation: structure.imagePresentation }),
    }
  } else {
    if (!isCustomSiteConfig(document.custom_config)) throw new Error('Custom site content is missing')
    const sanitized = hardenCustomConfig({
      ...document.custom_config,
      pages: Object.fromEntries(
        Object.entries(document.custom_config.pages || {}).map(([path, page]) => [
          path,
          { ...page, html: stripLiveWidgetsToPlaceholder(page?.html || '') },
        ])
      ),
    })
    const home = sanitized.pages['/']
    if (!home?.html?.trim()) throw new Error('The home page cannot be removed')
    if (!htmlHasInjectableWidget(home.html)) throw new Error('The home page engagement widget cannot be removed')
    document.custom_config = sanitized
  }
  assertSafeContentValue(document)
  return document
}

export function documentFromRow(row: Record<string, unknown>): SiteContentDocument {
  const document: SiteContentDocument = {
    brand_name: String(row.brand_name || ''),
    hero_config: (row.hero_config || {}) as Record<string, unknown>,
    about_config: (row.about_config || {}) as Record<string, unknown>,
    process_config: (row.process_config || { steps: [] }) as Record<string, unknown>,
    products_config: Array.isArray(row.products_config) ? row.products_config : [],
    seo_config: (row.seo_config || {}) as Record<string, unknown>,
    before_after_config: (row.before_after_config || null) as Record<string, unknown> | null,
    quiz_config: (row.quiz_config || null) as Record<string, unknown> | null,
    nav_links: Array.isArray(row.nav_links) ? row.nav_links : [],
    pages_config: Array.isArray(row.pages_config) ? row.pages_config : [],
    logo_url: typeof row.logo_url === 'string' ? row.logo_url : null,
    pricing_notes: typeof row.pricing_notes === 'string' ? row.pricing_notes : null,
    content_structure: (row.content_structure || {}) as Record<string, unknown>,
  }
  if (row.custom_config) document.custom_config = row.custom_config
  return document
}
