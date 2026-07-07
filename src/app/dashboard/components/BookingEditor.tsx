'use client'

import React, { useState, useEffect } from 'react'
import { supabaseBrowser } from '@/lib/supabase-browser'

export default function BookingEditor({ form, onSave, saving }: any) {
  const [services, setServices] = useState<any[]>([])
  const [availability, setAvailability] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [newService, setNewService] = useState({ name: '', duration_minutes: 60, price_cents: 0 })
  const [newAvailability, setNewAvailability] = useState({ day_of_week: 1, start_time: '09:00', end_time: '17:00' })

  useEffect(() => {
    async function load() {
      const { data: s } = await supabaseBrowser
        .from('service_catalog')
        .select('*')
        .eq('contractor_id', form.id)
        .order('sort_order', { ascending: true })
      
      const { data: a } = await supabaseBrowser
        .from('booking_availability')
        .select('*')
        .eq('contractor_id', form.id)
        .order('day_of_week', { ascending: true })

      if (s) setServices(s)
      if (a) setAvailability(a)
      setLoading(false)
    }
    load()
  }, [form.id])

  const handleAddService = async () => {
    if (!newService.name) return
    const { data, error } = await supabaseBrowser.from('service_catalog').insert({
      contractor_id: form.id,
      name: newService.name,
      duration_minutes: newService.duration_minutes,
      price_cents: newService.price_cents,
      sort_order: services.length
    }).select().single()
    if (data && !error) {
      setServices([...services, data])
      setNewService({ name: '', duration_minutes: 60, price_cents: 0 })
    }
  }

  const handleDeleteService = async (id: string) => {
    setServices(services.filter(s => s.id !== id))
    await supabaseBrowser.from('service_catalog').delete().eq('id', id)
  }

  const handleAddAvailability = async () => {
    const { data, error } = await supabaseBrowser.from('booking_availability').insert({
      contractor_id: form.id,
      day_of_week: newAvailability.day_of_week,
      start_time: newAvailability.start_time,
      end_time: newAvailability.end_time,
      slot_duration_minutes: 60
    }).select().single()
    if (data && !error) {
      setAvailability([...availability, data].sort((a,b) => a.day_of_week - b.day_of_week))
    }
  }

  const handleDeleteAvailability = async (id: string) => {
    setAvailability(availability.filter(a => a.id !== id))
    await supabaseBrowser.from('booking_availability').delete().eq('id', id)
  }

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-white/[0.06] bg-[#12151C] p-8">
        <h2 className="text-2xl font-semibold tracking-tight mb-2">Services & Pricing</h2>
        <p className="text-sm text-zinc-500 mb-8">Manage the services customers can book.</p>
        
        <div className="space-y-4 mb-8">
          {loading ? (
            <div className="text-zinc-500">Loading...</div>
          ) : services.length === 0 ? (
            <div className="text-zinc-500 text-sm italic">No services added.</div>
          ) : (
            services.map(s => (
              <div key={s.id} className="flex justify-between p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <div>
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-sm text-zinc-400 mt-1">{s.duration_minutes} min</div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono">${(s.price_cents / 100).toFixed(2)}</span>
                  <button onClick={() => handleDeleteService(s.id)} className="text-red-400 hover:text-red-300 text-sm">Delete</button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-white/[0.06] pt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-zinc-500 mb-1 block uppercase tracking-widest">Service Name</label>
            <input value={newService.name} onChange={e => setNewService({...newService, name: e.target.value})} className="w-full rounded-lg bg-white/[0.03] border border-white/[0.06] px-4 py-2 text-sm text-white" placeholder="Consultation" />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block uppercase tracking-widest">Duration (min)</label>
            <input type="number" value={newService.duration_minutes} onChange={e => setNewService({...newService, duration_minutes: Number(e.target.value)})} className="w-full rounded-lg bg-white/[0.03] border border-white/[0.06] px-4 py-2 text-sm text-white font-mono" />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block uppercase tracking-widest">Price (cents)</label>
            <div className="flex gap-2">
              <input type="number" value={newService.price_cents} onChange={e => setNewService({...newService, price_cents: Number(e.target.value)})} className="w-full rounded-lg bg-white/[0.03] border border-white/[0.06] px-4 py-2 text-sm text-white font-mono" placeholder="5000" />
              <button onClick={handleAddService} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm whitespace-nowrap">Add</button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.06] bg-[#12151C] p-8">
        <h2 className="text-2xl font-semibold tracking-tight mb-2">Weekly Availability</h2>
        <p className="text-sm text-zinc-500 mb-8">Set your recurring weekly hours.</p>

        <div className="space-y-4 mb-8">
          {availability.map(a => (
            <div key={a.id} className="flex justify-between p-4 bg-white/[0.02] border border-white/[0.06] rounded-xl">
              <div className="font-semibold text-indigo-400">{days[a.day_of_week]}</div>
              <div className="flex items-center gap-6 text-zinc-300 font-mono">
                {a.start_time.slice(0,5)} - {a.end_time.slice(0,5)}
                <button onClick={() => handleDeleteAvailability(a.id)} className="text-red-400 hover:text-red-300 text-sm font-sans">Delete</button>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-white/[0.06] pt-6 grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-zinc-500 mb-1 block uppercase tracking-widest">Day</label>
            <select value={newAvailability.day_of_week} onChange={e => setNewAvailability({...newAvailability, day_of_week: Number(e.target.value)})} className="w-full rounded-lg bg-white/[0.03] border border-white/[0.06] px-4 py-2 text-sm text-white">
              {days.map((d, i) => <option key={i} value={i} className="bg-zinc-800">{d}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block uppercase tracking-widest">Start Time</label>
            <input type="time" value={newAvailability.start_time} onChange={e => setNewAvailability({...newAvailability, start_time: e.target.value})} className="w-full rounded-lg bg-white/[0.03] border border-white/[0.06] px-4 py-2 text-sm text-white" />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block uppercase tracking-widest">End Time</label>
            <input type="time" value={newAvailability.end_time} onChange={e => setNewAvailability({...newAvailability, end_time: e.target.value})} className="w-full rounded-lg bg-white/[0.03] border border-white/[0.06] px-4 py-2 text-sm text-white" />
          </div>
          <div className="flex items-end">
            <button onClick={handleAddAvailability} className="w-full px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm">Add Hours</button>
          </div>
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
