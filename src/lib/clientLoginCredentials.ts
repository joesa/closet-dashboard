import { PUBLIC_API_URL } from '@/lib/urls'

/**
 * Temporary passwords for newly provisioned contractor dashboard accounts.
 * Also used when an admin regenerates credentials from Engagement tools.
 */

export function generateTempPassword(length = 12): string {
  const chars =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  let password = ''
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

export function clientLoginUrl(loginOrigin?: string | null): string {
  const origin =
    (loginOrigin && loginOrigin.trim()) ||
    PUBLIC_API_URL.replace(/\/$/, '') ||
    ''
  if (!origin) return '/login'
  return `${origin.replace(/\/$/, '')}/login`
}
