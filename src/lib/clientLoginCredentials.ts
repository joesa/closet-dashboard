import { PUBLIC_API_URL } from '@/lib/urls'
import { generateStrongPassword } from '@/lib/generateStrongPassword'

/**
 * Temporary passwords for newly provisioned contractor dashboard accounts.
 * Also used when an admin regenerates credentials from Engagement tools.
 */

/**
 * Delegates to the crypto-backed generator. The previous implementation drew
 * every character from `Math.random()`, which is predictable from a handful of
 * observed outputs — unacceptable for a value that is a real login credential,
 * emailed to the customer and stored for admin retrieval.
 */
export function generateTempPassword(length = 12): string {
  return generateStrongPassword(length)
}

export function clientLoginUrl(loginOrigin?: string | null): string {
  const origin =
    (loginOrigin && loginOrigin.trim()) ||
    PUBLIC_API_URL.replace(/\/$/, '') ||
    ''
  if (!origin) return '/login'
  return `${origin.replace(/\/$/, '')}/login`
}
