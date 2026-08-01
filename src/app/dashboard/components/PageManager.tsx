'use client'

import React, { useState, useEffect } from 'react'

type PageConfig = {
  slug: string
  title: string
  is_active?: boolean
  hero?: Record<string, unknown>
  content_blocks?: Array<{ type?: string; image?: string }>
}

type NavLink = {
  label: string
  slug: string
}

type ValidationIssue = { code?: string; message?: string; severity?: string }

export default function PageManager() {
  const [pages, setPages] = useState<PageConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [validationStatus, setValidationStatus] = useState<string | null>(null)
  const [issues, setIssues] = useState<ValidationIssue[]>([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/dashboard/site-draft', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setPages((data.draft?.pagesConfig || data.published?.pagesConfig || []) as PageConfig[])
        setValidationStatus(data.validation?.status || null)
        setIssues(Array.isArray(data.validation?.issues) ? data.validation.issues : [])
      } else {
        setMessage(data.error || 'Failed to load website pages')
      }
      setLoading(false)
    }
    load()
  }, [])

  const togglePage = (index: number) => {
    const updated = [...pages]
    const current = updated[index].is_active
    // default is true if undefined, so toggle to false
    updated[index].is_active = current === false ? true : false
    setPages(updated)
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    // Update pages_config
    // Also derive new nav_links from the updated pages
    const navLinks: NavLink[] = [{ label: 'Home', slug: '/' }]
    pages.forEach((page) => {
      if (page.is_active !== false) {
        navLinks.push({ label: page.title, slug: page.slug })
      }
    })

    try {
      const res = await fetch('/api/dashboard/site-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pagesConfig: pages, navLinks }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setValidationStatus(data.validation?.status || null)
        setIssues(Array.isArray(data.validation?.issues) ? data.validation.issues : [])
        setMessage(
          data.validation?.status === 'passed'
            ? 'Draft saved and validated. Publish when ready.'
            : 'Draft saved with quality issues. Published pages are unchanged.'
        )
      } else {
        setMessage(data.error || 'Failed to save draft')
      }
    } catch {
      setMessage('Failed to save draft')
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    setPublishing(true)
    setMessage('')
    try {
      const res = await fetch('/api/dashboard/site-draft', { method: 'PUT' })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setValidationStatus(null)
        setIssues([])
        setMessage('Website pages published.')
      } else {
        setMessage(data.error || 'Failed to publish draft')
      }
    } catch {
      setMessage('Failed to publish draft')
    } finally {
      setPublishing(false)
    }
  }

  if (loading) {
    return <div className="text-zinc-500">Loading pages...</div>
  }

  if (pages.length === 0) {
    return null // No pages to manage for this site
  }

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-[#12151C] p-8 mt-10">
      <h2 className="text-2xl font-semibold tracking-tight mb-2">Website Pages</h2>
      <p className="text-sm text-zinc-500 mb-8">
        Toggle pages, save a validated draft, then publish. Hidden pages are removed from navigation and return a 404.
      </p>

      {message ? (
        <p className={`mb-4 text-sm ${validationStatus === 'failed' ? 'text-amber-300' : 'text-zinc-300'}`}>
          {message}
        </p>
      ) : null}

      {validationStatus === 'failed' && issues.length > 0 ? (
        <ul className="mb-6 list-disc space-y-1 pl-5 text-sm text-amber-200">
          {issues.filter((issue) => issue.severity === 'error').slice(0, 6).map((issue, index) => (
            <li key={`${issue.code || 'issue'}-${index}`}>{issue.message || issue.code}</li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-4 mb-8">
        {pages.map((page, i) => (
          <div key={page.slug} className="flex justify-between items-center p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl">
            <div>
              <div className="font-semibold text-white">{page.title}</div>
              <div className="text-sm text-zinc-400 mt-1">{page.slug}</div>
            </div>
            <div className="flex items-center gap-4">
              <span className={`text-sm ${page.is_active !== false ? 'text-green-400' : 'text-zinc-500'}`}>
                {page.is_active !== false ? 'Active' : 'Inactive'}
              </span>
              <button
                onClick={() => togglePage(i)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  page.is_active !== false ? 'bg-indigo-500' : 'bg-white/10'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    page.is_active !== false ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleSave}
          disabled={saving || publishing}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg font-medium transition-colors"
        >
          {saving ? 'Validating...' : 'Save Draft'}
        </button>
        <button
          onClick={handlePublish}
          disabled={publishing || saving || validationStatus !== 'passed'}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded-lg font-medium transition-colors"
        >
          {publishing ? 'Publishing...' : 'Publish Draft'}
        </button>
      </div>
    </section>
  )
}
