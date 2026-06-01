import { getSupabaseAdmin } from '@/lib/supabase-admin'
import IntakeFormClient from './IntakeFormClient'

export const dynamic = 'force-dynamic'

export default async function IntakePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const admin = getSupabaseAdmin()

  const { data, error } = await admin
    .from('prospect_intakes')
    .select('business_name, status, source, email_verified_at, provisioning_mode')
    .eq('token', token)
    .maybeSingle()

  if (error || !data || data.status === 'archived') {
    return <IntakeFormClient token={token} notFound />
  }

  const alreadySubmitted = data.status !== 'draft'
  const needsEmailVerify =
    data.source === 'public' && !data.email_verified_at

  return (
    <IntakeFormClient
      token={token}
      businessName={data.business_name ?? ''}
      alreadySubmitted={alreadySubmitted}
      needsEmailVerify={needsEmailVerify}
      manualBuildOnSubmit={data.provisioning_mode === 'manual'}
    />
  )
}
