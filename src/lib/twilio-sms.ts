import { getSupabaseAdmin } from '@/lib/supabase-admin'

// ── Phone normalization ────────────────────────────────────────────

/**
 * Normalize a phone number to E.164 format.
 * Strips non-digit characters and prepends +1 for US numbers.
 */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null

  // Already has country code (11 digits starting with 1)
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`

  // US 10-digit number
  if (digits.length === 10) return `+1${digits}`

  // International or already full format
  if (digits.length >= 10) return `+${digits}`

  return null
}

// ── Suppression check ──────────────────────────────────────────────

/**
 * Check if a phone number is suppressed (opted out).
 * Returns true if the number should NOT be contacted.
 */
export async function isPhoneSuppressed(phone: string): Promise<boolean> {
  const admin = getSupabaseAdmin()

  const { data } = await admin
    .from('global_suppressions')
    .select('id')
    .eq('contact_value', phone)
    .eq('type', 'phone')
    .maybeSingle()

  return !!data
}

// ── Send SMS via Twilio REST API ───────────────────────────────────

export interface SmsSendResult {
  success: boolean
  messageSid: string | null
  error: string | null
}

/**
 * Send an SMS message via Twilio REST API.
 * Uses raw fetch (no SDK dependency) for Edge compatibility.
 */
export async function sendSms(to: string, body: string): Promise<SmsSendResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    console.warn('Twilio env vars not configured — skipping SMS.')
    return { success: false, messageSid: null, error: 'twilio_not_configured' }
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const credentials = btoa(`${accountSid}:${authToken}`)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: to,
        From: fromNumber,
        Body: body,
      }),
    })

    if (!res.ok) {
      const errBody = await res.text()
      console.error('Twilio SMS error:', res.status, errBody)
      return { success: false, messageSid: null, error: `twilio_${res.status}` }
    }

    const json = await res.json()
    return { success: true, messageSid: json.sid || null, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Twilio SMS exception:', message)
    return { success: false, messageSid: null, error: message }
  }
}

// ── SMS template personalization ───────────────────────────────────

/**
 * Replace template variables like {businessName}, {city} with actual values.
 */
export function personalizeTemplate(
  template: string,
  vars: Record<string, string>
): string {
  let result = template
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, value)
  }
  return result
}

// ── Default SMS templates for Pipeline B ───────────────────────────

export type SmsTemplate = {
  step: number
  delayDays: number
  body: string
}

const BRAND = process.env.BRAND_NAME || 'ClosetQuote'
const BRAND_DOMAIN = process.env.BRAND_DOMAIN || 'closetquotes.com'
const INDUSTRY = process.env.INDUSTRY_NAME || 'closet'

export const PIPELINE_B_SMS_TEMPLATES: SmsTemplate[] = [
  {
    step: 1,
    delayDays: 0,
    body: `Hi! I found {businessName} on Google Maps while searching for ${INDUSTRY} contractors in {city}. Noticed you don't have a website yet — I build premium sites for contractors that come with a built-in quote calculator. It texts leads straight to your phone. Want to see a 60-sec demo? - Joseph, ${BRAND}`,
  },
  {
    step: 2,
    delayDays: 2,
    body: `Hey, just following up about {businessName}. I've got a live demo you can try right now at ${BRAND_DOMAIN} — most contractors see their first lead within 48 hours of going live. Want me to mock up a free design for your business? - Joseph`,
  },
]

/** Count SMS outreach messages successfully sent today (UTC day boundary). */
export async function countSmsSentToday(): Promise<number> {
  const admin = getSupabaseAdmin()
  const start = new Date()
  start.setUTCHours(0, 0, 0, 0)

  const { count, error } = await admin
    .from('sms_outreach_events')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'sent')
    .gte('created_at', start.toISOString())

  if (error) {
    console.error('countSmsSentToday failed:', error.message)
    return 0
  }
  return count || 0
}

/**
 * SMS send window: Mon–Fri 9–17 America/Chicago (mirrors email campaign schedule).
 * Override with SMS_SEND_WINDOW_ENFORCE=false to disable.
 */
export function isWithinSmsSendWindow(now = new Date()): boolean {
  if (process.env.SMS_SEND_WINDOW_ENFORCE === 'false') return true

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(now)

  const weekday = parts.find((p) => p.type === 'weekday')?.value || ''
  const hour = Number.parseInt(parts.find((p) => p.type === 'hour')?.value || '', 10)

  const isWeekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(weekday)
  if (!isWeekday) return false
  if (!Number.isFinite(hour)) return false
  return hour >= 9 && hour < 17
}
