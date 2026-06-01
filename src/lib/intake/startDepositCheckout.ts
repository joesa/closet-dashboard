/** Start AI Premium deposit checkout; redirects to Stripe on success. */
export async function startIntakeDepositCheckout(token: string): Promise<void> {
  const res = await fetch(`/api/intake/${token}/checkout`, { method: 'POST' })
  const json = (await res.json()) as { url?: string; error?: string }
  if (!res.ok || !json.url) {
    throw new Error(json.error || 'Could not start checkout')
  }
  window.location.href = json.url
}
