import type { IntakeCheckoutKind } from '@/lib/intake/intakePaymentStage'

/** Start intake Stripe checkout; redirects on success. */
export async function startIntakeCheckout(
  token: string,
  kind: IntakeCheckoutKind = 'deposit'
): Promise<void> {
  const res = await fetch(`/api/intake/${token}/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind }),
  })
  const json = (await res.json()) as { url?: string; error?: string }
  if (!res.ok || !json.url) {
    throw new Error(json.error || 'Could not start checkout')
  }
  window.location.href = json.url
}

/** @deprecated Use startIntakeCheckout(token, 'deposit') */
export async function startIntakeDepositCheckout(token: string): Promise<void> {
  return startIntakeCheckout(token, 'deposit')
}
