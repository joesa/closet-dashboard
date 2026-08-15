import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import { listAssignments, listProviders } from '@/lib/ai/aiConfigAdmin'
import { secretBoxConfigured } from '@/lib/crypto/secretBox'
import AiModelsClient from './AiModelsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AiModelsPage() {
  await requireAdmin()

  const [providers, assignments] = await Promise.all([listProviders(), listAssignments()])
  // Reported rather than assumed: without the KEK this screen can still route
  // to keyless local endpoints, but it cannot store a vendor credential.
  const keyConfigured = secretBoxConfigured()

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin" className="text-sm text-blue-600 hover:underline">
          ← Admin
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-gray-900">AI models</h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-500">
          Register the endpoints this platform may call — hosted vendors or your own
          machines — then choose which one serves each job. Anything left unassigned keeps
          running on the built-in default, so an empty screen changes nothing.
        </p>
      </div>

      {!keyConfigured && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>AI_CONFIG_KEY is not set in this environment.</strong> Providers that need
          an API key cannot be saved until it is. Generate one with{' '}
          <code className="rounded bg-amber-100 px-1">openssl rand -base64 32</code> and set
          it on Vercel <em>and</em> in the worker VM&rsquo;s <code>.env.local</code> — if the
          two disagree, the worker silently falls back to the built-in chains while the web
          app uses your configuration.
        </div>
      )}

      <AiModelsClient initialProviders={providers} initialAssignments={assignments} />
    </div>
  )
}
