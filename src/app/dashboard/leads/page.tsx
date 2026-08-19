import Link from 'next/link'
import { redirect } from 'next/navigation'
import { loadOwnLeads, leadName, type LeadRow } from '@/lib/leads/ownLeads'

export const dynamic = 'force-dynamic'

/**
 * The leads screen a paying customer never had.
 *
 * Leads were delivered as an email and a text and stored in a table only we
 * could read — the admin side has had a searchable table with CSV export the
 * whole time. So the answer to "what am I paying for" lived in the customer's
 * inbox, where it is unsearchable and one deleted message from gone.
 */

function money(value: number | null): string {
  if (!value || Number.isNaN(value)) return '—'
  return `$${Math.round(value).toLocaleString('en-US')}`
}

function when(iso: string, nowMs: number): string {
  const then = new Date(iso).getTime()
  const days = Math.floor((nowMs - then) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function quoteSummary(lead: LeadRow): string {
  const parts = [lead.room_type, lead.finish_type].filter(Boolean)
  if (lead.linear_feet) parts.push(`${lead.linear_feet} ft`)
  return parts.join(' · ') || '—'
}

export default async function LeadsPage() {
  const result = await loadOwnLeads()
  if (!result.ok && result.error.startsWith('Sign in')) redirect('/login')

  const leads = result.ok ? result.leads : []
  const totalValue = result.ok ? result.totalValue : 0
  const last30Count = result.ok ? result.last30 : 0
  const duplicateCount = result.ok ? result.duplicates : 0
  // Supplied by the loader; a server component may not read the clock while
  // rendering, and "how long ago" is a property of the fetched data anyway.
  const nowMs = result.ok ? result.asOf : 0

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="border-b border-white/[0.06]">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white">
            ← Dashboard
          </Link>
          <span className="text-sm font-semibold">Your leads</span>
          <a
            href="/api/dashboard/leads/export"
            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/[0.08]"
          >
            Download CSV
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        {!result.ok && (
          <p className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
            {result.error}
          </p>
        )}

        <div className="mb-8 grid grid-cols-1 gap-px overflow-hidden rounded-xl bg-white/[0.06] sm:grid-cols-3">
          <div className="bg-[#0f0f0f] p-5">
            <div className="text-2xl font-semibold">{leads.length - duplicateCount}</div>
            <div className="mt-1 text-xs text-zinc-500">
              {duplicateCount > 0
                ? `People who enquired · ${duplicateCount} follow-up${duplicateCount === 1 ? '' : 's'}`
                : 'People who enquired'}
            </div>
          </div>
          <div className="bg-[#0f0f0f] p-5">
            <div className="text-2xl font-semibold">{last30Count}</div>
            <div className="mt-1 text-xs text-zinc-500">In the last 30 days</div>
          </div>
          <div className="bg-[#0f0f0f] p-5">
            <div className="text-2xl font-semibold">{money(totalValue)}</div>
            <div className="mt-1 text-xs text-zinc-500">Total quoted value</div>
          </div>
        </div>

        {leads.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-10 text-center">
            <p className="text-zinc-300">No leads yet.</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
              When someone completes your calculator, they appear here — and you still get the
              email and text straight away.
            </p>
            <Link
              href="/dashboard"
              className="mt-5 inline-block rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black"
            >
              Check your embed code
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Lead</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Quote</th>
                  <th className="px-4 py-3 text-right font-medium">Value</th>
                  <th className="px-4 py-3 text-right font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-t border-white/[0.06] align-top">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{leadName(lead)}</span>
                        {lead.duplicate_of && (
                          <span
                            className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400"
                            title="This person had already enquired within the last 24 hours"
                          >
                            Follow-up
                          </span>
                        )}
                      </div>
                      {lead.message && (
                        <div className="mt-1 max-w-xs text-xs text-zinc-500">{lead.message}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-300">
                      {lead.email && (
                        <a href={`mailto:${lead.email}`} className="block hover:text-white">
                          {lead.email}
                        </a>
                      )}
                      {lead.phone && (
                        <a href={`tel:${lead.phone}`} className="block text-zinc-400 hover:text-white">
                          {lead.phone}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{quoteSummary(lead)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-200">
                      {money(lead.estimated_total)}
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-500">{when(lead.created_at, nowMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
