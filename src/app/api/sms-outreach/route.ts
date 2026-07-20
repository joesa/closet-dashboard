import { NextResponse } from 'next/server'

import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { assertWebhookToken } from '@/lib/webhook-auth'
import {
  normalizePhone,
  isPhoneSuppressed,
  sendSms,
  personalizeTemplate,
  PIPELINE_B_SMS_TEMPLATES,
  countSmsSentToday,
  isWithinSmsSendWindow,
  type SmsTemplate,
} from '@/lib/twilio-sms'

export const runtime = 'nodejs'

type IncomingLead = {
  businessName?: string | null
  websiteUrl?: string | null
  phoneNumber?: string | null
  sourceLocation?: string | null
  address?: string | null
  enrichment?: {
    pipeline?: 'PIPELINE_A' | 'PIPELINE_B'
    reason?: string | null
  }
}

type IncomingPayload = {
  runId: string
  idempotencyKey?: string
  pipeline: 'PIPELINE_A' | 'PIPELINE_B'
  batchIndex: number
  totalBatches: number
  count: number
  leads: IncomingLead[]
  campaign?: {
    smsTemplates?: SmsTemplate[]
  }
}

function isValidPayload(payload: unknown): payload is IncomingPayload {
  if (!payload || typeof payload !== 'object') return false
  const p = payload as Record<string, unknown>
  if (typeof p.runId !== 'string' || !p.runId.trim()) return false
  if (!Array.isArray(p.leads)) return false
  return true
}

function extractCity(lead: IncomingLead): string {
  if (lead.sourceLocation) {
    const city = lead.sourceLocation.split(',')[0]?.trim()
    if (city) return city
  }
  if (lead.address) {
    const parts = lead.address.split(',')
    if (parts.length >= 2) return parts[parts.length - 2]?.trim() || 'your area'
  }
  return 'your area'
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function resolveStep1Template(payload: IncomingPayload): SmsTemplate {
  const fromCampaign = payload.campaign?.smsTemplates?.find((t) => t.step === 1)
  if (fromCampaign?.body) return fromCampaign
  return PIPELINE_B_SMS_TEMPLATES[0]
}

export async function POST(req: Request) {
  try {
    const authError = assertWebhookToken(req, process.env.INSTANTLY_RECEIVER_AUTH_TOKEN, {
      missingEnvMessage: 'INSTANTLY_RECEIVER_AUTH_TOKEN is not configured',
    })
    if (authError) return authError

    const payload = await req.json()
    if (!isValidPayload(payload)) {
      return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 })
    }

    if (!isWithinSmsSendWindow()) {
      return NextResponse.json(
        {
          ok: true,
          skipped: 'outside_send_window',
          runId: payload.runId,
          batchIndex: payload.batchIndex,
          totalLeads: payload.leads.length,
        },
        { status: 200 }
      )
    }

    const maxDaily = Number.parseInt(process.env.SMS_MAX_DAILY || '50', 10) || 50
    let sentToday = await countSmsSentToday()
    if (sentToday >= maxDaily) {
      return NextResponse.json(
        {
          ok: true,
          skipped: 'daily_cap',
          runId: payload.runId,
          sentToday,
          maxDaily,
          totalLeads: payload.leads.length,
        },
        { status: 200 }
      )
    }

    const admin = getSupabaseAdmin()
    const template = resolveStep1Template(payload)

    let sent = 0
    let skippedNoPhone = 0
    let skippedSuppressed = 0
    let skippedDuplicate = 0
    let skippedCap = 0
    let failed = 0

    for (const lead of payload.leads) {
      if (sentToday >= maxDaily) {
        skippedCap++
        continue
      }

      const rawPhone = lead.phoneNumber || ''
      const phone = normalizePhone(rawPhone)

      if (!phone) {
        skippedNoPhone++
        continue
      }

      const eventKey = `${payload.runId}:sms:${phone}:step1`
      const { error: insertError } = await admin.from('sms_outreach_events').insert({
        event_key: eventKey,
        run_id: payload.runId,
        phone_number: phone,
        business_name: (lead.businessName || '').trim(),
        source_location: (lead.sourceLocation || '').trim(),
        message_step: 1,
        message_body: '',
        status: 'pending',
      })

      if (insertError) {
        if (insertError.code === '23505') {
          skippedDuplicate++
          continue
        }
        console.error('Failed to insert sms_outreach_event:', insertError.message)
        failed++
        continue
      }

      const suppressed = await isPhoneSuppressed(phone)
      if (suppressed) {
        await admin
          .from('sms_outreach_events')
          .update({ status: 'suppressed', updated_at: new Date().toISOString() })
          .eq('event_key', eventKey)
        skippedSuppressed++
        continue
      }

      const city = extractCity(lead)
      const messageBody = personalizeTemplate(template.body, {
        businessName: (lead.businessName || 'your business').trim(),
        city,
      })

      await admin
        .from('sms_outreach_events')
        .update({ message_body: messageBody })
        .eq('event_key', eventKey)

      const result = await sendSms(phone, messageBody)

      if (result.success) {
        await admin
          .from('sms_outreach_events')
          .update({
            status: 'sent',
            twilio_message_sid: result.messageSid,
            updated_at: new Date().toISOString(),
          })
          .eq('event_key', eventKey)
        sent++
        sentToday++
      } else {
        await admin
          .from('sms_outreach_events')
          .update({
            status: 'failed',
            error: result.error,
            updated_at: new Date().toISOString(),
          })
          .eq('event_key', eventKey)
        failed++
      }

      await delay(500)
    }

    return NextResponse.json(
      {
        ok: true,
        runId: payload.runId,
        batchIndex: payload.batchIndex,
        totalLeads: payload.leads.length,
        sent,
        skippedNoPhone,
        skippedSuppressed,
        skippedDuplicate,
        skippedCap,
        failed,
        sentToday,
        maxDaily,
      },
      { status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('SMS outreach webhook error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
