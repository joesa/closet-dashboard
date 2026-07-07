'use client'

import React, { useState, useEffect } from 'react'
import { supabaseBrowser } from '@/lib/supabase-browser'

export default function OrderEditor({ form, setForm, onSave, saving }: any) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newItem, setNewItem] = useState({ name: '', description: '', price: 0, category: 'Menu' })

  useEffect(() => {
    async function loadItems() {
      const { data } = await supabaseBrowser
        .from('menu_items')
        .select('*')
        .eq('contractor_id', form.id)
        .order('sort_order', { ascending: true })
      if (data) setItems(data)
      setLoading(false)
    }
    loadItems()
  }, [form.id])

  const handleAddItem = async () => {
    if (!newItem.name.trim()) return
    const { data, error } = await supabaseBrowser
      .from('menu_items')
      .insert({
        contractor_id: form.id,
        name: newItem.name,
        description: newItem.description,
        price: newItem.price,
        category: newItem.category,
        available: true,
        sort_order: items.length
      })
      .select()
      .single()
      
    if (data && !error) {
      setItems([...items, data])
      setNewItem({ name: '', description: '', price: 0, category: 'Menu' })
    }
  }

  const handleDelete = async (id: string) => {
    setItems(items.filter(i => i.id !== id))
    await supabaseBrowser.from('menu_items').delete().eq('id', id)
  }

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-white/[0.06] bg-[#12151C] p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Menu Manager</h2>
            <p className="mt-1 text-sm text-zinc-500">Manage your online ordering menu.</p>
          </div>
        </div>

        <div className="space-y-4 mb-8">
          {loading ? (
            <div className="text-zinc-500">Loading items...</div>
          ) : items.length === 0 ? (
            <div className="text-zinc-500 text-sm italic">No items on your menu yet. Add one below.</div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <div>
                  <div className="font-semibold text-white">{item.name}</div>
                  <div className="text-sm text-zinc-400 mt-1">{item.description}</div>
                  <div className="text-xs text-indigo-400 mt-2 font-medium">{item.category}</div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-lg font-mono text-zinc-300">${(item.price / 100).toFixed(2)}</div>
                  <button onClick={() => handleDelete(item.id)} className="text-red-400 hover:text-red-300 text-sm">Delete</button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-white/[0.06] pt-8">
          <h3 className="text-lg font-medium text-white mb-4">Add Menu Item</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block uppercase tracking-widest">Name</label>
              <input value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} className="w-full rounded-lg bg-white/[0.03] border border-white/[0.06] px-4 py-2 text-sm text-white" placeholder="Cheeseburger" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block uppercase tracking-widest">Price (Cents)</label>
              <input type="number" value={newItem.price} onChange={e => setNewItem({...newItem, price: Number(e.target.value)})} className="w-full rounded-lg bg-white/[0.03] border border-white/[0.06] px-4 py-2 text-sm text-white font-mono" placeholder="1500 for $15.00" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-zinc-500 mb-1 block uppercase tracking-widest">Description</label>
              <input value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} className="w-full rounded-lg bg-white/[0.03] border border-white/[0.06] px-4 py-2 text-sm text-white" placeholder="Delicious burger with cheese." />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-zinc-500 mb-1 block uppercase tracking-widest">Category</label>
              <input value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} className="w-full rounded-lg bg-white/[0.03] border border-white/[0.06] px-4 py-2 text-sm text-white" placeholder="Mains, Starters, etc." />
            </div>
          </div>
          <button onClick={handleAddItem} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors">
            + Add Item
          </button>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          onClick={onSave}
          disabled={saving}
          className="rounded-xl bg-indigo-500 px-8 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-indigo-400 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
