'use client'

import React, { useState, useEffect } from 'react'
import { supabaseBrowser } from '@/lib/supabase-browser'

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

export default function PageManager({ contractorId }: { contractorId: string }) {
  const [pages, setPages] = useState<PageConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabaseBrowser
        .from('site_configs')
        .select('pages_config')
        .eq('tenant_id', contractorId)
        .maybeSingle()
      
      if (data && data.pages_config) {
        setPages(data.pages_config as PageConfig[])
      }
      setLoading(false)
    }
    load()
  }, [contractorId])

  const togglePage = (index: number) => {
    const updated = [...pages]
    const current = updated[index].is_active
    // default is true if undefined, so toggle to false
    updated[index].is_active = current === false ? true : false
    setPages(updated)
  }

  const handleSave = async () => {
    setSaving(true)
    // Update pages_config
    // Also derive new nav_links from the updated pages
    const navLinks: NavLink[] = [{ label: 'Home', slug: '/' }]
    pages.forEach((page) => {
      if (page.is_active !== false) {
        navLinks.push({ label: page.title, slug: page.slug })
      }
    })

    await supabaseBrowser
      .from('site_configs')
      .update({
        pages_config: pages,
        nav_links: navLinks
      })
      .eq('tenant_id', contractorId)

    setSaving(false)
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
        Toggle the pages you want to show on your website. Hidden pages will be completely removed from the site navigation and return a 404.
      </p>

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

      <div className="flex justify-end border-t border-white/[0.06] pt-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl bg-indigo-500 px-8 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-indigo-400 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Pages'}
        </button>
      </div>
    </section>
  )
}
