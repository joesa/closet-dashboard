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

export const PIPELINE_B_SMS_TEMPLATES = [
  {
    step: 1,
    delayDays: 0,
    body: `Hi! I found {businessName} on Google Maps while searching for closet contractors in {city}. Noticed you don't have a website yet — I build premium sites for contractors that come with a built-in quote calculator. It texts leads straight to your phone. Want to see a 60-sec demo? - Joseph, ClosetQuote`,
  },
  {
    step: 2,
    delayDays: 2,
    body: `Hey, just following up about {businessName}. I've got a live demo you can try right now at closetquotes.com — most contractors see their first lead within 48 hours of going live. Want me to mock up a free design for your business? - Joseph`,
  },
]
