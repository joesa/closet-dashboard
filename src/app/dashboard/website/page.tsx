'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ContentChange, SiteContentDocument, SiteContentRevisionSummary } from '@/lib/site-content/types'
import { coupledEngineChanges } from '@/lib/site-content/editorChanges'

type StudioPayload = {
  tenant: {
    id: string
    businessName: string
    siteStatus: string | null
    validationStatus: string | null
    validationReport: Array<{ message?: string; severity?: string }>
    validatedAt: string | null
  }
  renderMode: 'engine' | 'custom'
  publicUrl: string
  version: number
  document: SiteContentDocument
  pageTree: Array<{ slug: string; title: string; isActive: boolean; protected: boolean }>
  revisions: SiteContentRevisionSummary[]
  editorToken: string
}

type SaveState = 'loading' | 'live' | 'unsaved' | 'saving' | 'offline' | 'conflict' | 'error'
type Viewport = 'desktop' | 'tablet' | 'mobile'

const EDITABLE_ROOTS = [
  'brand_name', 'hero_config', 'about_config', 'process_config', 'products_config',
  'before_after_config', 'quiz_config', 'nav_links', 'pages_config', 'seo_config',
  'logo_url', 'pricing_notes', 'content_structure', 'custom_config',
] as const

const HOME_SECTIONS = [
  { id: 'hero', label: 'Hero', path: '/hero_config' },
  { id: 'about', label: 'About', path: '/about_config' },
  { id: 'products', label: 'Services / Products', path: '/products_config' },
  { id: 'process', label: 'Process', path: '/process_config' },
  { id: 'beforeAfter', label: 'Before & After', path: '/before_after_config' },
  { id: 'socialProof', label: 'Social proof', path: '/seo_config/socialProof' },
  { id: 'quiz', label: 'Quiz', path: '/quiz_config' },
  { id: 'engagement', label: 'Quote / booking engine', path: '/pricing_notes' },
]

function encodePointer(value: string) {
  return value.replace(/~/g, '~0').replace(/\//g, '~1')
}

function pointerParts(path: string) {
  return path.slice(1).split('/').map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'))
}

function valueAt(document: unknown, path: string): unknown {
  let value = document
  for (const part of pointerParts(path)) {
    if (!value || typeof value !== 'object') return undefined
    value = Array.isArray(value) ? value[Number(part)] : (value as Record<string, unknown>)[part]
  }
  return value
}

function applyLocal(document: SiteContentDocument, change: ContentChange): SiteContentDocument {
  const next = structuredClone(document) as SiteContentDocument & Record<string, unknown>
  const parts = pointerParts(change.path)
  let target: Record<string, unknown> | unknown[] = next
  for (const part of parts.slice(0, change.op === 'insert' || change.op === 'move' ? parts.length : -1)) {
    target = (Array.isArray(target) ? target[Number(part)] : target[part]) as Record<string, unknown> | unknown[]
  }
  if (change.op === 'insert' || change.op === 'move') {
    const collection = target as unknown[]
    if (change.op === 'insert') collection.splice(change.index, 0, structuredClone(change.value))
    else {
      const [item] = collection.splice(change.from, 1)
      collection.splice(change.to, 0, item)
    }
  } else {
    const key = parts.at(-1)!
    if (Array.isArray(target)) {
      if (change.op === 'remove') target.splice(Number(key), 1)
      else target[Number(key)] = structuredClone(change.value)
    } else if (change.op === 'remove') delete target[key]
    else target[key] = structuredClone(change.value)
  }
  return next
}

function labelFor(key: string) {
  return key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (v) => v.toUpperCase())
}

function altPathForImage(path: string) {
  if (/\/backgroundImage$/.test(path)) return path.replace(/backgroundImage$/, 'backgroundImageAlt')
  if (/\/beforeImage$/.test(path)) return path.replace(/beforeImage$/, 'beforeImageAlt')
  if (/\/afterImage$/.test(path)) return path.replace(/afterImage$/, 'afterImageAlt')
  if (/\/image$/.test(path)) return path.replace(/image$/, 'imageAlt')
  return null
}

function defaultArrayItem(path: string): unknown {
  if (path.endsWith('/nav_links')) return { label: 'New link', slug: '/' }
  if (path.endsWith('/pages_config')) return {
    slug: `/page-${Date.now().toString(36)}`,
    title: 'New page',
    is_active: true,
    hero: { headline: 'New page', subheadline: '', backgroundImage: '' },
    content_blocks: [{ type: 'text', heading: 'New section', body: '' }],
  }
  if (path.includes('products_config')) return { title: 'New service', image: '', description: '' }
  if (path.endsWith('/steps')) return { number: '01', title: 'New step', description: '' }
  if (path.endsWith('/testimonials')) return { quote: '', name: '', role: '' }
  if (path.endsWith('/stats')) return { value: '', label: '' }
  if (path.endsWith('/content_blocks')) return { type: 'text', heading: 'New section', body: '' }
  if (path.endsWith('/images') || path.endsWith('/specifications')) return ''
  return {}
}

function statusLabel(state: SaveState) {
  return {
    loading: 'Loading…', live: 'Live', unsaved: 'Unsaved', saving: 'Saving…',
    offline: 'Offline — retrying', conflict: 'Conflict', error: 'Save failed',
  }[state]
}

function previewNeedsReload(changes: ContentChange[]) {
  return changes.some((change) =>
    change.op !== 'set' ||
    change.path.startsWith('/content_structure/') ||
    /\/pages_config\/\d+\/(?:slug|is_active)$/.test(change.path)
  )
}

export default function WebsiteStudioPage() {
  const [payload, setPayload] = useState<StudioPayload | null>(null)
  const [document, setDocument] = useState<SiteContentDocument | null>(null)
  const documentRef = useRef<SiteContentDocument | null>(null)
  const versionRef = useRef(1)
  const [state, setState] = useState<SaveState>('loading')
  const [message, setMessage] = useState('')
  const [selectedPath, setSelectedPath] = useState('/hero_config')
  const [viewport, setViewport] = useState<Viewport>('desktop')
  const [previewNonce, setPreviewNonce] = useState(0)
  const [previewPath, setPreviewPath] = useState('/')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [mediaOpen, setMediaOpen] = useState(false)
  const [sessionUndo, setSessionUndo] = useState<SiteContentDocument[]>([])
  const [sessionRedo, setSessionRedo] = useState<SiteContentDocument[]>([])
  const pendingRef = useRef<ContentChange[]>([])
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savingRef = useRef(false)
  const flushRef = useRef<() => Promise<void>>(async () => {})

  const load = useCallback(async () => {
    const res = await fetch('/api/dashboard/site-content', { cache: 'no-store' })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error || 'Could not load website content')
    setPayload(json)
    let loadedDocument = json.document as SiteContentDocument
    versionRef.current = json.version
    if (json.renderMode === 'custom') setSelectedPath('/custom_config/pages/~1/html')
    let restoredPending = false
    let pendingConflict = false
    setMessage('')
    try {
      const pending = localStorage.getItem(`site-content-pending:${json.tenant.id}`)
      if (pending) {
        const saved = JSON.parse(pending) as { version?: number; changes?: ContentChange[] }
        if (saved.version === json.version && Array.isArray(saved.changes) && saved.changes.length > 0) {
          for (const change of saved.changes) loadedDocument = applyLocal(loadedDocument, change)
          pendingRef.current = saved.changes
          restoredPending = true
          setMessage('Restored an offline edit and retrying it now.')
          setTimeout(() => void flushRef.current(), 1000)
        } else {
          pendingConflict = true
          setMessage('An offline edit was preserved, but the live site changed. Review the latest version before reapplying it.')
        }
      }
    } catch { /* ignore */ }
    setDocument(loadedDocument)
    documentRef.current = loadedDocument
    setState(pendingConflict ? 'conflict' : restoredPending ? 'unsaved' : 'live')
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      load().catch((error) => {
        setState('error')
        setMessage(error instanceof Error ? error.message : 'Could not load editor')
      })
    }, 0)
    return () => clearTimeout(timer)
  }, [load])

  const flush = useCallback(async () => {
    if (savingRef.current || pendingRef.current.length === 0 || !payload) return
    const changes = pendingRef.current.splice(0)
    savingRef.current = true
    let shouldContinue = true
    setState('saving')
    try {
      const res = await fetch('/api/dashboard/site-content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseVersion: versionRef.current,
          idempotencyKey: crypto.randomUUID(),
          changes,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.status === 409) {
        pendingRef.current.unshift(...changes)
        shouldContinue = false
        setState('conflict')
        setMessage('This site changed in another session. Reload to merge against the latest version.')
        return
      }
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        shouldContinue = false
        setState('error')
        setMessage(json.error || 'This edit is not valid.')
        if (payload.document) {
          setDocument(payload.document)
          documentRef.current = payload.document
        }
        return
      }
      if (!res.ok) throw new Error(json.error || 'Save failed')
      versionRef.current = json.version
      if (json.document) {
        // Keystrokes can arrive while this request is in flight. Rebase those
        // still-pending operations onto the acknowledged server document so a
        // slower response never makes the input jump back to older text.
        const rebased = pendingRef.current.reduce(applyLocal, json.document as SiteContentDocument)
        setDocument(rebased)
        documentRef.current = rebased
      }
      setPayload((current) => current ? { ...current, version: json.version, document: json.document || current.document } : current)
      // Text and image edits are painted into the iframe optimistically. Only
      // structural changes require a full navigation/remount.
      if (previewNeedsReload(changes)) setPreviewNonce(json.version)
      setState(json.cacheInvalidated ? 'live' : 'offline')
      setMessage(json.cacheInvalidated ? 'Published to your website.' : 'Saved. Website cache invalidation is retrying.')
      try {
        if (pendingRef.current.length > 0) {
          localStorage.setItem(`site-content-pending:${payload.tenant.id}`, JSON.stringify({
            version: json.version,
            changes: pendingRef.current,
          }))
        } else {
          localStorage.removeItem(`site-content-pending:${payload.tenant.id}`)
        }
      } catch { /* ignore */ }
      if (!json.cacheInvalidated) {
        setTimeout(async () => {
          const retry = await fetch('/api/dashboard/site-content/revalidate', { method: 'POST' }).catch(() => null)
          if (retry?.ok) {
            setState('live')
            setMessage('Published to your website.')
            setPreviewNonce((nonce) => nonce + 1)
          }
        }, 4000)
      }
    } catch (error) {
      pendingRef.current.unshift(...changes)
      setState('offline')
      setMessage(error instanceof Error ? error.message : 'Network unavailable; edit preserved locally.')
      try {
        localStorage.setItem(`site-content-pending:${payload.tenant.id}`, JSON.stringify({ version: versionRef.current, changes: pendingRef.current }))
      } catch { /* ignore */ }
      setTimeout(() => void flushRef.current(), 5000)
    } finally {
      savingRef.current = false
      if (shouldContinue && pendingRef.current.length > 0) setTimeout(() => void flushRef.current(), 20)
    }
  }, [payload])

  useEffect(() => {
    flushRef.current = flush
  }, [flush])

  const queueChange = useCallback((change: ContentChange, immediate = false, recordUndo = true) => {
    const current = documentRef.current
    if (!current) return
    if (recordUndo) {
      setSessionUndo((stack) => [...stack.slice(-24), structuredClone(current)])
      setSessionRedo([])
    }
    const changes = payload?.renderMode === 'engine' ? coupledEngineChanges(current, change) : [change]
    const next = changes.reduce(applyLocal, current)
    documentRef.current = next
    setDocument(next)
    pendingRef.current.push(...changes)
    if (payload?.renderMode === 'engine' && payload.publicUrl !== '#') {
      const frame = window.document.querySelector('iframe[title="Live website preview"]') as HTMLIFrameElement | null
      if (frame?.contentWindow) {
        const targetOrigin = new URL(payload.publicUrl).origin
        for (const item of changes) {
          if (item.op === 'set') {
            frame.contentWindow.postMessage({
              type: 'dtf:engine-content-update',
              path: item.path,
              value: item.value,
              sessionToken: payload.editorToken,
            }, targetOrigin)
          }
        }
      }
    }
    setState('unsaved')
    if (flushTimer.current) clearTimeout(flushTimer.current)
    flushTimer.current = setTimeout(() => void flush(), immediate ? 0 : 700)
  }, [flush, payload?.renderMode])

  const restoreSessionDocument = useCallback((target: SiteContentDocument, destination: 'undo' | 'redo') => {
    const current = documentRef.current
    if (!current) return
    if (destination === 'undo') setSessionRedo((stack) => [...stack, structuredClone(current)])
    else setSessionUndo((stack) => [...stack, structuredClone(current)])
    documentRef.current = target
    setDocument(target)
    const changes: ContentChange[] = EDITABLE_ROOTS
      .filter((root) => payload?.renderMode === 'engine' || ['brand_name', 'seo_config', 'logo_url', 'custom_config'].includes(root))
      .map((root) => ({ op: 'set', path: `/${root}`, value: target[root as keyof SiteContentDocument] }))
    pendingRef.current.push(...changes)
    setState('unsaved')
    setTimeout(() => void flush(), 0)
  }, [flush, payload?.renderMode])

  const undo = () => {
    const target = sessionUndo.at(-1)
    if (!target) return
    setSessionUndo((stack) => stack.slice(0, -1))
    restoreSessionDocument(target, 'undo')
  }
  const redo = () => {
    const target = sessionRedo.at(-1)
    if (!target) return
    setSessionRedo((stack) => stack.slice(0, -1))
    restoreSessionDocument(target, 'redo')
  }

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!payload?.publicUrl || payload.publicUrl === '#') return
      let expectedOrigin = ''
      try { expectedOrigin = new URL(payload.publicUrl).origin } catch { return }
      const frame = window.document.querySelector('iframe[title="Live website preview"]') as HTMLIFrameElement | null
      if (
        event.origin !== expectedOrigin ||
        event.source !== frame?.contentWindow ||
        !event.data ||
        typeof event.data !== 'object' ||
        event.data.sessionToken !== payload.editorToken
      ) return
      if (event.data.type === 'dtf:content-select' && typeof event.data.path === 'string') {
        setSelectedPath(event.data.path)
      }
      if (
        payload.renderMode === 'custom' &&
        event.data.type === 'dtf:custom-html' &&
        typeof event.data.path === 'string' &&
        typeof event.data.html === 'string'
      ) {
        const pagePath = encodePointer(event.data.path)
        queueChange({ op: 'set', path: `/custom_config/pages/${pagePath}/html`, value: event.data.html })
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [payload, queueChange])

  const previewUrl = useMemo(() => {
    if (!payload?.publicUrl || payload.publicUrl === '#') return ''
    try {
      const url = new URL(payload.publicUrl)
      url.pathname = previewPath
      url.searchParams.set('content_editor', '1')
      url.searchParams.set('editor_origin', typeof window === 'undefined' ? '' : window.location.origin)
      url.searchParams.set('content_version', String(previewNonce || payload.version))
      url.searchParams.set('content_editor_token', payload.editorToken)
      return url.toString()
    } catch { return '' }
  }, [payload, previewNonce, previewPath])

  if (!payload || !document) {
    return <div className="min-h-screen bg-[#08090c] p-8 text-white"><p>{message || 'Loading Website Content Studio…'}</p><Link href="/dashboard" className="mt-4 inline-block text-indigo-300">← Dashboard</Link></div>
  }

  const selectedValue = valueAt(document, selectedPath)
  const selectedAltPath = altPathForImage(selectedPath)
  const orderedSections = Array.isArray(document.content_structure?.homeSections)
    ? document.content_structure.homeSections.map(String)
    : HOME_SECTIONS.map((section) => section.id)
  const hiddenSections = Array.isArray(document.content_structure?.hiddenHomeSections)
    ? document.content_structure.hiddenHomeSections.map(String)
    : []
  const customPages = payload.renderMode === 'custom'
    ? Object.entries(((document.custom_config as { pages?: Record<string, { title?: string }> } | undefined)?.pages || {}))
      .map(([slug, page]) => ({ slug, title: page.title || (slug === '/' ? 'Home' : slug.split('/').filter(Boolean).at(-1) || 'Page'), protected: slug === '/' }))
      .sort((a, b) => a.slug === '/' ? -1 : b.slug === '/' ? 1 : a.slug.localeCompare(b.slug))
    : []
  const customArtifactMode = payload.renderMode === 'custom'
    ? (document.custom_config as { mode?: string } | undefined)?.mode
    : null

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#08090c] text-white">
      <header className="flex h-16 shrink-0 items-center gap-4 border-b border-white/10 bg-[#0d0f14] px-5">
        <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white">← Dashboard</Link>
        <div className="min-w-0">
          <h1 className="truncate font-semibold">{payload.tenant.businessName} — Website Content</h1>
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">{payload.renderMode} site · version {payload.version}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={undo} disabled={!sessionUndo.length} className="rounded-lg border border-white/10 px-3 py-2 text-xs disabled:opacity-30">Undo</button>
          <button onClick={redo} disabled={!sessionRedo.length} className="rounded-lg border border-white/10 px-3 py-2 text-xs disabled:opacity-30">Redo</button>
          <button onClick={() => setMediaOpen(true)} className="rounded-lg border border-white/10 px-3 py-2 text-xs">Media</button>
          <button onClick={() => setHistoryOpen(true)} className="rounded-lg border border-white/10 px-3 py-2 text-xs">History</button>
          {state === 'conflict' && <button onClick={() => void load()} className="rounded-lg bg-amber-400 px-3 py-2 text-xs font-semibold text-black">Reload latest</button>}
          <span className={`rounded-full px-3 py-1.5 text-xs font-medium ${state === 'live' ? 'bg-emerald-500/15 text-emerald-300' : state === 'conflict' || state === 'error' ? 'bg-red-500/15 text-red-300' : 'bg-amber-500/15 text-amber-200'}`}>{statusLabel(state)}</span>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[260px_minmax(420px,1fr)_360px]">
        <aside className="overflow-y-auto border-r border-white/10 bg-[#0d0f14] p-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Pages and sections</p>
          <div className="mb-2 rounded-xl border border-white/8 bg-white/[0.02] p-2">
            <p className="px-2 pb-1 pt-1 text-sm font-medium">Brand & navigation</p>
            <div className={`grid gap-1 ${payload.renderMode === 'engine' ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <button onClick={() => setSelectedPath('/brand_name')} className={`rounded-lg px-2 py-2 text-left text-xs ${selectedPath === '/brand_name' ? 'bg-indigo-500/15 text-indigo-100' : 'hover:bg-white/5'}`}>Brand name</button>
              {payload.renderMode === 'engine' && <button onClick={() => setSelectedPath('/nav_links')} className={`rounded-lg px-2 py-2 text-left text-xs ${selectedPath.startsWith('/nav_links') ? 'bg-indigo-500/15 text-indigo-100' : 'hover:bg-white/5'}`}>Navigation links</button>}
            </div>
          </div>
          {payload.renderMode === 'engine' ? <div className="rounded-xl border border-white/8 bg-white/[0.02] p-2">
            <button onClick={() => { setSelectedPath('/hero_config'); setPreviewPath('/') }} className="w-full px-2 py-2 text-left text-sm font-semibold">Home</button>
            <div className="space-y-1">
              {orderedSections.map((id, index) => {
                const section = HOME_SECTIONS.find((entry) => entry.id === id)
                if (!section) return null
                const protectedSection = id === 'hero' || id === 'engagement'
                return (
                  <div key={id} className={`group flex items-center rounded-lg ${selectedPath.startsWith(section.path) ? 'bg-indigo-500/15' : 'hover:bg-white/5'}`}>
                    <button onClick={() => setSelectedPath(section.path)} className="min-w-0 flex-1 truncate px-2 py-2 text-left text-xs">{section.label}</button>
                    <button disabled={index === 0} onClick={() => queueChange({ op: 'move', path: '/content_structure/homeSections', from: index, to: index - 1 }, true)} className="px-1 text-zinc-500 disabled:opacity-20">↑</button>
                    <button disabled={index === orderedSections.length - 1} onClick={() => queueChange({ op: 'move', path: '/content_structure/homeSections', from: index, to: index + 1 }, true)} className="px-1 text-zinc-500 disabled:opacity-20">↓</button>
                    <button disabled={protectedSection} onClick={() => queueChange(hiddenSections.includes(id) ? { op: 'remove', path: `/content_structure/hiddenHomeSections/${hiddenSections.indexOf(id)}` } : { op: 'insert', path: '/content_structure/hiddenHomeSections', index: hiddenSections.length, value: id }, true)} className="px-2 text-[10px] text-zinc-500 disabled:opacity-20">{hiddenSections.includes(id) ? 'Show' : 'Hide'}</button>
                  </div>
                )
              })}
            </div>
          </div> : <div className="space-y-1 rounded-xl border border-white/8 bg-white/[0.02] p-2">
            {customPages.map((page) => <div key={page.slug} className={`flex items-center rounded-lg ${previewPath === page.slug ? 'bg-indigo-500/15' : 'hover:bg-white/5'}`}><button onClick={() => { setPreviewPath(page.slug); setSelectedPath(`/custom_config/pages/${encodePointer(page.slug)}/html`) }} className="min-w-0 flex-1 truncate px-2 py-2 text-left text-xs">{page.title}</button><button title="Page title and description" onClick={() => setSelectedPath(`/custom_config/pages/${encodePointer(page.slug)}`)} className="px-1 text-zinc-500">⚙</button>{!page.protected && <button onClick={() => { queueChange({ op: 'remove', path: `/custom_config/pages/${encodePointer(page.slug)}` }, true); setPreviewPath('/') }} className="px-2 text-red-400/70">×</button>}</div>)}
            <button onClick={() => { const slug = `/page-${Date.now().toString(36)}`; queueChange({ op: 'set', path: `/custom_config/pages/${encodePointer(slug)}`, value: { title: 'New page', description: '', html: '<main><section><h1>New page</h1><p>Add your content here.</p></section></main>' } }, true); setPreviewPath(slug); setSelectedPath(`/custom_config/pages/${encodePointer(slug)}/html`) }} className="w-full rounded-lg border border-dashed border-white/10 px-3 py-2 text-xs text-zinc-400">+ Add page</button>
          </div>}
          {payload.renderMode === 'engine' && <div className="mt-3 space-y-1">
            {(document.pages_config as Array<{ slug?: string; title?: string; is_active?: boolean }>).map((page, index) => {
              const navIndex = (document.nav_links as Array<{ slug?: string }>).findIndex((link) => link.slug === page.slug)
              const inNavigation = navIndex >= 0
              return (
                <div key={`${page.slug}-${index}`} className={`flex items-center rounded-lg ${selectedPath.startsWith(`/pages_config/${index}`) ? 'bg-indigo-500/15 text-indigo-100' : 'hover:bg-white/5'}`}>
                  <button onClick={() => { setSelectedPath(`/pages_config/${index}`); setPreviewPath(page.slug || '/') }} className="min-w-0 flex-1 px-3 py-2 text-left text-xs">
                    <span className="block truncate">{page.title || 'Untitled page'}</span>
                    <span className="text-[10px] text-zinc-600">{page.is_active === false ? 'Hidden · ' : ''}{page.slug}</span>
                  </button>
                  <button
                    disabled={page.is_active === false || !page.slug}
                    title={inNavigation ? 'Remove this page from navigation' : 'Add this page to navigation'}
                    onClick={() => queueChange(inNavigation
                      ? { op: 'remove', path: `/nav_links/${navIndex}` }
                      : { op: 'insert', path: '/nav_links', index: document.nav_links.length, value: { label: page.title || 'Untitled page', slug: page.slug } }, true)}
                    className={`mr-2 shrink-0 rounded-md border px-2 py-1 text-[10px] disabled:cursor-not-allowed disabled:opacity-30 ${inNavigation ? 'border-emerald-400/20 text-emerald-300' : 'border-white/10 text-zinc-400'}`}
                  >
                    {inNavigation ? 'In nav ✓' : '+ Nav'}
                  </button>
                </div>
              )
            })}
            {payload.renderMode === 'engine' && <button onClick={() => { const page = defaultArrayItem('/pages_config'); queueChange({ op: 'insert', path: '/pages_config', index: document.pages_config.length, value: page }, true) }} className="w-full rounded-lg border border-dashed border-white/10 px-3 py-2 text-xs text-zinc-400 hover:border-white/30">+ Add page</button>}
          </div>}
          <button onClick={() => setSelectedPath('/seo_config')} className="mt-3 w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-white/5">SEO & contact details</button>
          {message && <p className="mt-5 rounded-lg bg-white/5 p-3 text-xs leading-relaxed text-zinc-400">{message}</p>}
          {payload.tenant.validationStatus === 'failed' && payload.tenant.validationReport.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-3">
              <p className="text-xs font-semibold text-amber-200">Quality recommendations</p>
              <ul className="mt-2 space-y-1 text-[11px] text-amber-100/70">
                {payload.tenant.validationReport.slice(0, 5).map((issue, index) => <li key={index}>{issue.message || 'Review this content on the live site.'}</li>)}
              </ul>
            </div>
          )}
        </aside>

        <main className="flex min-w-0 flex-col bg-[#111319]">
          <div className="flex h-12 items-center justify-center gap-2 border-b border-white/10">
            {(['desktop', 'tablet', 'mobile'] as Viewport[]).map((item) => <button key={item} onClick={() => setViewport(item)} className={`rounded-md px-3 py-1.5 text-xs capitalize ${viewport === item ? 'bg-white text-black' : 'text-zinc-400'}`}>{item}</button>)}
            <button onClick={() => setPreviewNonce((n) => n + 1)} className="ml-4 rounded-md border border-white/10 px-3 py-1.5 text-xs text-zinc-400">Refresh</button>
            {payload.publicUrl !== '#' && <a href={payload.publicUrl} target="_blank" rel="noreferrer" className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-zinc-400">Open live ↗</a>}
          </div>
          <div className="flex min-h-0 flex-1 justify-center overflow-auto p-5">
            {previewUrl ? (
              <iframe
                key={previewUrl}
                src={previewUrl}
                title="Live website preview"
                className="h-full min-h-[700px] bg-white shadow-2xl transition-[width]"
                style={{ width: viewport === 'desktop' ? '100%' : viewport === 'tablet' ? 768 : 390 }}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              />
            ) : <div className="m-auto text-sm text-zinc-500">No reachable website domain is configured.</div>}
          </div>
        </main>

        <aside className="overflow-y-auto border-l border-white/10 bg-[#0d0f14] p-5">
          <div className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Content inspector</p>
            <p className="mt-1 break-all text-xs text-zinc-600">{selectedPath}</p>
          </div>
          {payload.renderMode === 'custom' && customArtifactMode !== 'iframe' && selectedPath.endsWith('/html') ? (
            <CustomInspector publicUrl={payload.publicUrl} selectedPath={selectedPath} />
          ) : (
            <ValueEditor path={selectedPath} value={selectedValue} onChange={queueChange} onSelectPath={setSelectedPath} />
          )}
          {customArtifactMode === 'iframe' && selectedPath.includes('/html') && (
            <p className="mt-3 text-xs leading-relaxed text-amber-200/70">This legacy page uses isolated iframe mode, so its sanitized HTML is edited here instead of by clicking inside the preview.</p>
          )}
          {payload.renderMode === 'engine' && selectedAltPath && (
            <div className="mt-5 border-t border-white/10 pt-5">
              <label className="mb-2 block text-xs font-medium text-zinc-400">Image alt text</label>
              <input
                value={String(valueAt(document, selectedAltPath) || '')}
                onChange={(event) => queueChange({ op: 'set', path: selectedAltPath, value: event.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                placeholder="Describe this image for accessibility"
              />
            </div>
          )}
        </aside>
      </div>

      {historyOpen && <HistoryDialog revisions={payload.revisions} onClose={() => setHistoryOpen(false)} onRestored={() => { setHistoryOpen(false); void load(); setPreviewNonce((n) => n + 1) }} />}
      {mediaOpen && <MediaDialog onClose={() => setMediaOpen(false)} onUse={(url) => { if (typeof selectedValue === 'string') queueChange({ op: 'set', path: selectedPath, value: url }, true); setMediaOpen(false) }} />}
    </div>
  )
}

function ValueEditor({ path, value, onChange, onSelectPath }: {
  path: string
  value: unknown
  onChange: (change: ContentChange, immediate?: boolean) => void
  onSelectPath: (path: string) => void
}) {
  if (value === undefined || value === null) {
    return <div><p className="text-sm text-zinc-500">This section has no content yet.</p><button onClick={() => onChange({ op: 'set', path, value: {} }, true)} className="mt-3 rounded-lg bg-indigo-500 px-3 py-2 text-xs">Create section</button></div>
  }
  if (typeof value === 'boolean') {
    return <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={value} onChange={(event) => onChange({ op: 'set', path, value: event.target.checked }, true)} /> Enabled</label>
  }
  if (typeof value === 'number') {
    return <input type="number" value={value} onChange={(event) => onChange({ op: 'set', path, value: Number(event.target.value) })} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
  }
  if (typeof value === 'string') {
    const multiline = value.length > 80 || /description|body|quote|notes|html/i.test(path)
    const className = "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm leading-relaxed outline-none focus:border-indigo-400"
    return multiline
      ? <textarea rows={Math.min(14, Math.max(4, Math.ceil(value.length / 55)))} value={value} onChange={(event) => onChange({ op: 'set', path, value: event.target.value })} className={className} />
      : <input value={value} onChange={(event) => onChange({ op: 'set', path, value: event.target.value })} className={className} />
  }
  if (Array.isArray(value)) {
    return (
      <div className="space-y-3">
        {value.map((item, index) => {
          const itemPath = `${path}/${index}`
          return <div key={index} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="mb-3 flex items-center gap-1">
              <button onClick={() => onSelectPath(itemPath)} className="min-w-0 flex-1 truncate text-left text-xs font-medium">{typeof item === 'object' && item ? String((item as Record<string, unknown>).title || (item as Record<string, unknown>).label || (item as Record<string, unknown>).name || `Item ${index + 1}`) : `Item ${index + 1}`}</button>
              <button disabled={index === 0} onClick={() => onChange({ op: 'move', path, from: index, to: index - 1 }, true)} className="px-1 text-zinc-500 disabled:opacity-20">↑</button>
              <button disabled={index === value.length - 1} onClick={() => onChange({ op: 'move', path, from: index, to: index + 1 }, true)} className="px-1 text-zinc-500 disabled:opacity-20">↓</button>
              <button onClick={() => onChange({ op: 'remove', path: itemPath }, true)} className="px-1 text-red-400/70">×</button>
            </div>
            <ValueEditor path={itemPath} value={item} onChange={onChange} onSelectPath={onSelectPath} />
          </div>
        })}
        <button onClick={() => onChange({ op: 'insert', path, index: value.length, value: defaultArrayItem(path) }, true)} className="w-full rounded-lg border border-dashed border-white/15 py-2 text-xs text-zinc-400">+ Add item</button>
      </div>
    )
  }
  if (typeof value === 'object') {
    return <div className="space-y-4">{Object.entries(value as Record<string, unknown>).map(([key, child]) => {
      const childPath = `${path}/${encodePointer(key)}`
      return <div key={key}><div className="mb-1.5 flex items-center justify-between"><label className="text-xs font-medium text-zinc-400">{labelFor(key)}</label>{typeof child === 'object' && child !== null && <button onClick={() => onSelectPath(childPath)} className="text-[10px] text-indigo-300">Focus</button>}</div><ValueEditor path={childPath} value={child} onChange={onChange} onSelectPath={onSelectPath} /></div>
    })}</div>
  }
  return <p className="text-sm text-zinc-500">Unsupported content value.</p>
}

function CustomInspector({ publicUrl, selectedPath }: { publicUrl: string; selectedPath: string }) {
  const send = (action: string, value?: string) => {
    const frame = document.querySelector('iframe[title="Live website preview"]') as HTMLIFrameElement | null
    if (!frame?.contentWindow) return
    const token = new URL(frame.src).searchParams.get('content_editor_token')
    frame.contentWindow.postMessage({ type: 'dtf:editor-command', action, value, sessionToken: token }, new URL(publicUrl).origin)
  }
  return <div className="space-y-3"><p className="text-sm leading-relaxed text-zinc-400">Click text, links, images, or sections in the preview. Changes are serialized from the custom page while its CSS remains untouched.</p><textarea id="custom-editor-value" rows={6} className="w-full rounded-lg border border-white/10 bg-white/5 p-3 text-sm" placeholder="Replacement text, link, image URL, or alt text" /><button onClick={() => send('setValue', (document.getElementById('custom-editor-value') as HTMLTextAreaElement)?.value)} className="w-full rounded-lg bg-indigo-500 py-2 text-sm font-medium">Apply to selection</button><button onClick={() => send('setAlt', (document.getElementById('custom-editor-value') as HTMLTextAreaElement)?.value)} className="w-full rounded-lg border border-white/10 py-2 text-xs">Apply as image alt text</button><div className="grid grid-cols-2 gap-2"><button onClick={() => send('duplicate')} className="rounded-lg border border-white/10 py-2 text-xs">Duplicate</button><button onClick={() => send('remove')} className="rounded-lg border border-red-500/20 py-2 text-xs text-red-300">Remove</button><button onClick={() => send('moveUp')} className="rounded-lg border border-white/10 py-2 text-xs">Move up</button><button onClick={() => send('moveDown')} className="rounded-lg border border-white/10 py-2 text-xs">Move down</button></div><p className="break-all text-[10px] text-zinc-600">{selectedPath}</p></div>
}

function HistoryDialog({ revisions, onClose, onRestored }: { revisions: SiteContentRevisionSummary[]; onClose: () => void; onRestored: () => void }) {
  const [busy, setBusy] = useState('')
  const restore = async (id: string) => {
    setBusy(id)
    const res = await fetch(`/api/dashboard/site-content/revisions/${id}/restore`, { method: 'POST' })
    setBusy('')
    if (res.ok) onRestored()
  }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-6"><div className="max-h-[80vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/10 bg-[#12151c] p-6"><div className="mb-5 flex items-center"><h2 className="text-xl font-semibold">Revision history</h2><button onClick={onClose} className="ml-auto text-zinc-400">Close</button></div><div className="space-y-2">{revisions.length ? revisions.map((revision) => <div key={revision.id} className="flex items-center gap-3 rounded-xl border border-white/8 p-3"><div className="min-w-0 flex-1"><p className="text-sm">Version {revision.version}</p><p className="truncate text-xs text-zinc-500">{revision.changedPaths.join(', ') || 'Website content'}</p><p className="text-[10px] text-zinc-600">{new Date(revision.createdAt).toLocaleString()}</p></div><button disabled={!!busy} onClick={() => void restore(revision.id)} className="rounded-lg border border-white/10 px-3 py-2 text-xs disabled:opacity-40">{busy === revision.id ? 'Restoring…' : 'Restore'}</button></div>) : <p className="text-sm text-zinc-500">Revisions appear after the first edit.</p>}</div></div></div>
}

function MediaDialog({ onClose, onUse }: { onClose: () => void; onUse: (url: string) => void }) {
  const [assets, setAssets] = useState<Array<{ path: string; url: string; name: string }>>([])
  const [references, setReferences] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const loadMedia = useCallback(async () => {
    const res = await fetch('/api/dashboard/site-media', { cache: 'no-store' })
    const json = await res.json().catch(() => ({}))
    if (res.ok) { setAssets(json.assets || []); setReferences(json.references || []) }
  }, [])
  useEffect(() => {
    const timer = setTimeout(() => void loadMedia(), 0)
    return () => clearTimeout(timer)
  }, [loadMedia])
  const upload = async (file: File) => {
    setBusy(true)
    const form = new FormData(); form.append('file', file)
    const res = await fetch('/api/dashboard/site-media', { method: 'POST', body: form })
    const json = await res.json().catch(() => ({}))
    setBusy(false)
    if (res.ok && json.asset?.url) { await loadMedia(); onUse(json.asset.url) }
  }
  const urls = [...new Set([...assets.map((asset) => asset.url), ...references])]
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-6"><div className="max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/10 bg-[#12151c] p-6"><div className="mb-5 flex items-center"><h2 className="text-xl font-semibold">Media library</h2><label className="ml-auto cursor-pointer rounded-lg bg-white px-4 py-2 text-xs font-medium text-black">{busy ? 'Uploading…' : 'Upload image'}<input disabled={busy} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file) }} /></label><button onClick={onClose} className="ml-3 text-zinc-400">Close</button></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">{urls.map((url) => <button key={url} onClick={() => onUse(url)} className="overflow-hidden rounded-xl border border-white/10 bg-black/20 text-left"><img src={url} alt="" className="h-32 w-full object-cover" /><span className="block truncate p-2 text-[10px] text-zinc-500">{url.split('/').pop()}</span></button>)}</div></div></div>
}
