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

type JsonObject = Record<string, unknown>

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
  if (change.op === 'remove' && parts.length === 1) {
    throw new Error('Top-level content fields cannot be removed')
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
    const order = Array.isArray(structure.homeSections) ? structure.homeSections.map(String) : []
    for (const required of PROTECTED_ENGINE_SECTIONS) {
      if (!order.includes(required)) throw new Error(`The ${required} section cannot be removed`)
    }
    const hidden = Array.isArray(structure.hiddenHomeSections)
      ? structure.hiddenHomeSections.map(String)
      : []
    if (hidden.some((section) => PROTECTED_ENGINE_SECTIONS.has(section))) {
      throw new Error('The hero and engagement sections cannot be hidden')
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
