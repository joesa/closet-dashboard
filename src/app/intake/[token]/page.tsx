import { getIntakeByToken } from '@/lib/intake/getIntakeByToken'
import { buildIntakePublicJson } from '@/lib/intake/intakePublicResponse'
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

  const pub = buildIntakePublicJson(row)
  const aiRaw = row.ai_site_config as Record<string, unknown> | null

  const adminUser = await getCurrentAdmin()
  const isAdmin = adminUser !== null

  return (
    <IntakeFormClient
      isAdmin={isAdmin}
      token={token}
      businessName={row.business_name ?? ''}
      prospectEmail={row.contact_email || row.verification_email || ''}
      requestedPages={row.requested_pages ?? []}
      alreadySubmitted={pub.alreadySubmitted}
      needsEmailVerify={pub.source === 'public' && !pub.emailVerified}
      manualBuildOnSubmit={row.provisioning_mode === 'manual'}
      intakeTier={pub.intakeTier}
      depositStatus={pub.depositStatus}
      depositRequiredCents={pub.depositRequiredCents}
      tierTotalCents={pub.tierTotalCents}
      tierAlreadySelected={pub.tierSelected}
      canUseImageStudio={pub.canUseImageStudio}
      tierCatalog={getTierCatalog()}
      aiSiteConfig={(aiRaw?.siteConfig ?? aiRaw) as Record<string, unknown> | null}
      widgetConfigHints={row.widget_config_hints ?? null}
      imageSelections={parseImageSelections(row.image_selections)}
      pageContents={row.page_contents ?? {}}
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
            ? row.tier_total_cents
            : pub.paymentCheckoutKind === 'deposit'
              ? row.deposit_required_cents
              : 0
      }
    />
  )
}
