import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'

const NAV = [
  { href: '/admin',               label: 'Health' },
  { href: '/admin/contractors',   label: 'Contractors' },
  { href: '/admin/leads',         label: 'Widget leads' },
  { href: '/admin/scraper-leads', label: 'Scraper leads' },
  { href: '/admin/sites',         label: 'Platform Control Center' },
  { href: '/admin/intakes',       label: 'Prospect Intakes' },
  { href: '/admin/provision-jobs', label: 'Provision Jobs' },
  { href: '/admin/sandbox/onboarding', label: 'Sandbox Emulator' },
  { href: '/admin/scraper',       label: 'Scraper' },
  { href: '/admin/subscriptions', label: 'Subscriptions' },
  { href: '/admin/stripe-events', label: 'Stripe Events' },
  { href: '/admin/audit',         label: 'Audit Log' },
]

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Middleware already gates this, but a server-side check is cheap insurance
  // and gives us the admin's email for the header.
  const admin = await requireAdmin()

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-60 shrink-0 border-r border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-4">
          <div className="text-xs uppercase tracking-wider text-gray-400">
            ClosetQuote
          </div>
          <div className="mt-0.5 text-base font-semibold text-gray-900">
            Admin
          </div>
        </div>
        <nav className="px-2 py-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-gray-200 px-5 py-3 text-xs text-gray-500">
          Signed in as
          <div className="mt-0.5 truncate font-medium text-gray-700">
            {admin.email ?? admin.id}
          </div>
          <Link
            href="/dashboard"
            className="mt-3 inline-block text-blue-600 hover:underline"
          >
            ← Back to dashboard
          </Link>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-8 py-8">{children}</div>
      </main>
    </div>
  )
}
