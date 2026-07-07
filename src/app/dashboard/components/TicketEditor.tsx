'use client'

import React, { useState, useEffect } from 'react'
import { supabaseBrowser } from '@/lib/supabase-browser'

export default function TicketEditor({ form, onSave, saving }: any) {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [newEvent, setNewEvent] = useState({ 
    name: '', 
    description: '',
    event_date: '', 
    event_time: '19:00',
    venue: '',
    capacity: 100,
    price_cents: 0
  })

  useEffect(() => {
    async function load() {
      const { data } = await supabaseBrowser
        .from('ticket_events')
        .select('*')
        .eq('contractor_id', form.id)
        .order('event_date', { ascending: true })
      
      if (data) setEvents(data)
      setLoading(false)
    }
    load()
  }, [form.id])

  const handleAddEvent = async () => {
    if (!newEvent.name || !newEvent.event_date) return
    const { data, error } = await supabaseBrowser.from('ticket_events').insert({
      contractor_id: form.id,
      name: newEvent.name,
      description: newEvent.description,
      event_date: newEvent.event_date,
      event_time: newEvent.event_time,
      venue: newEvent.venue,
      capacity: newEvent.capacity,
      price_cents: newEvent.price_cents,
      is_active: true
    }).select().single()
    if (data && !error) {
      setEvents([...events, data].sort((a,b) => a.event_date.localeCompare(b.event_date)))
      setNewEvent({ ...newEvent, name: '', description: '', event_date: '', venue: '' })
    }
  }

  const handleDeleteEvent = async (id: string) => {
    setEvents(events.filter(e => e.id !== id))
    await supabaseBrowser.from('ticket_events').delete().eq('id', id)
  }

  const formatDate = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString()

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-white/[0.06] bg-[#12151C] p-8">
        <h2 className="text-2xl font-semibold tracking-tight mb-2">Event Manager</h2>
        <p className="text-sm text-zinc-500 mb-8">Create and manage your ticketed events.</p>
        
        <div className="space-y-4 mb-8">
          {loading ? (
            <div className="text-zinc-500">Loading events...</div>
          ) : events.length === 0 ? (
            <div className="text-zinc-500 text-sm italic">No events created yet.</div>
          ) : (
            events.map(e => (
              <div key={e.id} className="flex flex-col sm:flex-row justify-between p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl gap-4">
                <div>
                  <div className="font-semibold text-white">{e.name}</div>
                  <div className="text-sm text-zinc-400 mt-1">{formatDate(e.event_date)} at {e.event_time}</div>
                  <div className="text-xs text-zinc-500 mt-1">{e.venue} • {e.capacity} capacity</div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-xl">${(e.price_cents / 100).toFixed(2)}</span>
                  <button onClick={() => handleDeleteEvent(e.id)} className="text-red-400 hover:text-red-300 text-sm">Delete</button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-white/[0.06] pt-6 space-y-4">
          <h3 className="font-medium text-white mb-2">Create New Event</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block uppercase tracking-widest">Event Name</label>
              <input value={newEvent.name} onChange={e => setNewEvent({...newEvent, name: e.target.value})} className="w-full rounded-lg bg-white/[0.03] border border-white/[0.06] px-4 py-2 text-sm text-white" placeholder="Summer Bash" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block uppercase tracking-widest">Venue / Location</label>
              <input value={newEvent.venue} onChange={e => setNewEvent({...newEvent, venue: e.target.value})} className="w-full rounded-lg bg-white/[0.03] border border-white/[0.06] px-4 py-2 text-sm text-white" placeholder="Downtown Park" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block uppercase tracking-widest">Date</label>
                <input type="date" value={newEvent.event_date} onChange={e => setNewEvent({...newEvent, event_date: e.target.value})} className="w-full rounded-lg bg-white/[0.03] border border-white/[0.06] px-4 py-2 text-sm text-white" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block uppercase tracking-widest">Time</label>
                <input type="time" value={newEvent.event_time} onChange={e => setNewEvent({...newEvent, event_time: e.target.value})} className="w-full rounded-lg bg-white/[0.03] border border-white/[0.06] px-4 py-2 text-sm text-white" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block uppercase tracking-widest">Capacity</label>
                <input type="number" value={newEvent.capacity} onChange={e => setNewEvent({...newEvent, capacity: Number(e.target.value)})} className="w-full rounded-lg bg-white/[0.03] border border-white/[0.06] px-4 py-2 text-sm text-white font-mono" />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block uppercase tracking-widest">Price (cents)</label>
                <input type="number" value={newEvent.price_cents} onChange={e => setNewEvent({...newEvent, price_cents: Number(e.target.value)})} className="w-full rounded-lg bg-white/[0.03] border border-white/[0.06] px-4 py-2 text-sm text-white font-mono" placeholder="2500" />
              </div>
            </div>
          </div>
          <button onClick={handleAddEvent} className="w-full px-4 py-3 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium">Create Event</button>
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
