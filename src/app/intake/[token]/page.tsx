import { getIntakeByToken } from '@/lib/intake/getIntakeByToken'
import { buildIntakePublicJson } from '@/lib/intake/intakePublicResponse'
import { healIntakeTierFromPayments } from '@/lib/intake/intakeTierGates'
import { parseImageSelections } from '@/lib/intake/imageSelections'
import { getTierCatalog } from '@/lib/intake/tiers'
import IntakeFormClient from './IntakeFormClient'
import { getCurrentAdmin } from '@/lib/admin'

export const dynamic = 'force-dynamic'

export default async function IntakePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ tier?: string; pay?: string }>
}) {
  const { token } = await params
  const sp = await searchParams
  const row = await getIntakeByToken(token)

  if (!row || row.status === 'archived') {
    return <IntakeFormClient token={token} notFound />
  }

  const healed = await healIntakeTierFromPayments(row)
  const pub = buildIntakePublicJson(healed)
  const aiRaw = healed.ai_site_config as Record<string, unknown> | null

  const adminUser = await getCurrentAdmin()
  const isAdmin = adminUser !== null

  return (
    <IntakeFormClient
      token={token}
      businessName={healed.business_name ?? ''}
      prospectEmail={healed.contact_email || healed.verification_email || ''}
      requestedPages={healed.requested_pages ?? []}
      alreadySubmitted={pub.alreadySubmitted}
      needsEmailVerify={pub.source === 'public' && !pub.emailVerified}
      manualBuildOnSubmit={healed.provisioning_mode === 'manual'}
      intakeTier={pub.intakeTier}
      depositStatus={pub.depositStatus}
      depositRequiredCents={pub.depositRequiredCents}
      tierTotalCents={pub.tierTotalCents}
      tierAlreadySelected={pub.tierSelected}
      canUseImageStudio={pub.canUseImageStudio}
      tierCatalog={getTierCatalog()}
      aiSiteConfig={(aiRaw?.siteConfig ?? aiRaw) as Record<string, unknown> | null}
      widgetConfigHints={healed.widget_config_hints ?? null}
      imageSelections={parseImageSelections(healed.image_selections)}
      pageContents={healed.page_contents ?? {}}
      initialGalleryImages={healed.gallery_images ?? []}
      initialTierFromQuery={
        sp.tier === 'ai_premium' || sp.tier === 'standard' ? sp.tier : undefined
      }
      payKindFromQuery={
        sp.pay === 'balance' ||
        sp.pay === 'standard_build' ||
        sp.pay === 'maintenance' ||
        sp.pay === 'deposit'
          ? sp.pay
          : undefined
      }
      paymentDueLabel={pub.paymentDueLabel}
      paymentCheckoutKind={pub.paymentCheckoutKind}
      canPayToLaunch={pub.canPayToLaunch}
      paymentAmountCents={
        pub.paymentCheckoutKind === 'balance'
          ? pub.remainderCents
          : pub.paymentCheckoutKind === 'standard_build'
            ? pub.tierTotalCents
            : pub.paymentCheckoutKind === 'deposit'
              ? pub.depositRequiredCents
              : 0
      }
    />
  )
}
