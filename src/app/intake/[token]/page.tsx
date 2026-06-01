import { getIntakeByToken } from '@/lib/intake/getIntakeByToken'
import { buildIntakePublicJson } from '@/lib/intake/intakePublicResponse'
import { parseImageSelections } from '@/lib/intake/imageSelections'
import { getTierCatalog } from '@/lib/intake/tiers'
import IntakeFormClient from './IntakeFormClient'

export const dynamic = 'force-dynamic'

export default async function IntakePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const row = await getIntakeByToken(token)

  if (!row || row.status === 'archived') {
    return <IntakeFormClient token={token} notFound />
  }

  const pub = buildIntakePublicJson(row)
  const aiRaw = row.ai_site_config as Record<string, unknown> | null

  return (
    <IntakeFormClient
      token={token}
      businessName={row.business_name ?? ''}
      alreadySubmitted={pub.alreadySubmitted}
      needsEmailVerify={pub.source === 'public' && !pub.emailVerified}
      manualBuildOnSubmit={row.provisioning_mode === 'manual'}
      intakeTier={pub.intakeTier}
      depositStatus={pub.depositStatus}
      depositRequiredCents={pub.depositRequiredCents}
      tierTotalCents={pub.tierTotalCents}
      canUseImageStudio={pub.canUseImageStudio}
      tierCatalog={getTierCatalog()}
      aiSiteConfig={(aiRaw?.siteConfig ?? aiRaw) as Record<string, unknown> | null}
      imageSelections={parseImageSelections(row.image_selections)}
    />
  )
}
